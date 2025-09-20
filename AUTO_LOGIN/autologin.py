import asyncio
import sys
import pathlib
import os
import json
import itertools
import httpx
import random

from camoufox.async_api import AsyncCamoufox
from playwright.async_api import TimeoutError as PWTimeout, Page
from browserforge.fingerprints import Screen
from stem import Signal
from stem.control import Controller

# --- Configuration ---
CONSENT_BTN_XPATH = '/html/body/div[2]/div[1]/div[2]/c-wiz/main/div[3]/div/div/div[2]/div/div/button'
STATE_FILE = "data.json"
EMAILS_FILE = "emails.txt"
PROXIES_FILE = "proxies.txt"
POST_URL = "http://127.0.0.1:80/user"
CTRL_HOST, CTRL_PORT = "127.0.0.1", 9151
SOCKS_HOST, SOCKS_PORT = "127.0.0.1", 9150

# --- Custom Exceptions ---
class AccountFailedLoginError(Exception):
    pass

# ===================== PROXY HANDLING =====================
def load_proxies(path=PROXIES_FILE):
    p = pathlib.Path(path)
    if not p.exists():
        print(f"[ERROR] Proxies file not found: {path}")
        sys.exit(1)
    proxies = []
    for ln in p.read_text(encoding="utf-8").splitlines():
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        if not s.startswith(('http://', 'https://', 'socks5://')):
            proxies.append(f"http://{s}")
        else:
            proxies.append(s)
    if not proxies:
        print("[ERROR] no valid proxies found")
        sys.exit(1)
    return itertools.cycle(proxies)

proxy_pool = load_proxies()

# ===================== GOOGLE LOGIN HELPERS (ASYNC) =====================
async def find_visible_element_in_frames(page: Page, selector: str):
    """Robustly finds a VISIBLE element on the main page or in any iframe."""
    # Check main page first
    locator = page.locator(selector).first
    if await locator.count() > 0 and await locator.is_visible():
        return page

    # Check all frames
    for frame in page.frames:
        try:
            frame_locator = frame.locator(selector).first
            if await frame_locator.count() > 0 and await frame_locator.is_visible():
                return frame
        except Exception:
            # Frame might have detached, ignore and continue
            pass
    return None

async def click_consent_xpath(gpage, timeout_s=20):
    try:
        btn = gpage.locator(f'xpath={CONSENT_BTN_XPATH}').first
        # The click action auto-waits for the button to be visible and enabled.
        await btn.click(timeout=timeout_s * 1000)
        return True
    except PWTimeout:
        return False
    except Exception:
        return False

async def poll_cookie_any_context(browser, name="j", timeout_s=180):
    t0 = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - t0 < timeout_s:
        try:
            for ctx in browser.contexts:
                for c in await ctx.cookies():
                    if c.get("name") == name:
                        return c
        except Exception:
            pass
        await asyncio.sleep(0.05)
    return None

# ===================== TURNSTILE SOLVER (ASYNC) =====================
async def get_solved_token(api_url="http://localhost:8080/turnstile", target_url="https://backend.wplace.live", sitekey="0x4AAAAAABpHqZ-6i7uL_nmG"):
    proxy = next(proxy_pool)
    try:
        async with httpx.AsyncClient() as client:
            params = {"url": target_url, "sitekey": sitekey, "proxy": proxy}
            r = await client.get(api_url, params=params, timeout=30)
            if r.status_code != 202:
                raise RuntimeError(f"Bad status {r.status_code}: {r.text}")
            
            task_id = r.json().get("task_id")
            if not task_id:
                raise RuntimeError("No task_id returned")

            for _ in range(60):
                await asyncio.sleep(2)
                res = await client.get(f"http://localhost:8080/result", params={"id": task_id}, timeout=20)
                res_json = res.json()
                if res_json.get("status") == "success":
                    return res_json.get("value")
                elif res_json.get("status") == "error":
                    raise RuntimeError(f"Solver error: {res_json.get('value')}")
            raise RuntimeError("Captcha solving timed out")
    except httpx.ConnectError as e:
        raise RuntimeError(f"Captcha solver failed: Could not connect to the API server at {api_url}. Is api_server.py running? Error: {e}")
    except Exception as e:
        raise RuntimeError(f"Captcha solver failed: {e}")

# ===================== LOGIN (ASYNC) =====================
async def login_once(email, password, recovery_email=None):
    print(f"[{email}] 1. Getting captcha token (using proxy)...")
    token = await get_solved_token()
    backend_url = f"https://backend.wplace.live/auth/google?token={token}"

    print(f"[{email}] 2. Getting Google login URL (using proxy)...")
    proxy_http = next(proxy_pool)
    proxies = {"http://": proxy_http, "https://": proxy_http}
    try:
        async with httpx.AsyncClient(proxies=proxies, follow_redirects=True) as client:
            r = await client.get(backend_url, timeout=15)
            google_login_url = str(r.url)
    except Exception as e:
        raise RuntimeError(f"Failed to get Google login URL via proxy {proxy_http}: {e}")

    print(f"[{email}] 3. Launching browser on YOUR LOCAL IP...")
    custom_fonts = ["Arial", "Helvetica", "Times New Roman"]
    
    async with AsyncCamoufox(
        headless=False,
        humanize=True,
        block_images=False,
        disable_coop=True,
        screen=Screen(min_width=1920, max_width=1920, min_height=1080, max_height=1080),
        fonts=custom_fonts,
        os=["windows", "macos", "linux"],
        geoip=True,
        i_know_what_im_doing=True
    ) as browser:
        page = await browser.new_page()
        page.set_default_timeout(120000)
        
        print(f"[{email}] 5. Navigating to Google login page...")
        await page.goto(google_login_url, wait_until="domcontentloaded")

        print(f"[{email}] 6. Finding and typing email...")
        email_frame = await find_visible_element_in_frames(page, 'input[type="email"]')
        if not email_frame: raise RuntimeError("Could not find email input field.")
        await email_frame.type('input[type="email"]', email, delay=random.uniform(50, 120))
        
        print(f"[{email}] 7. Clicking 'Next' after email...")
        # Bring window to front to ensure click registers (unfortunately sometimes fails if you don't do)
        await page.bring_to_front()
        await email_frame.locator('#identifierNext').click()
        
        print(f"[{email}] 8. Waiting for password field OR for you to solve captcha...")
        password_selector = 'input[type="password"]'
        password_frame = None
        total_wait_time = 120
        start_time = asyncio.get_event_loop().time()

        while asyncio.get_event_loop().time() - start_time < total_wait_time:
            if await find_visible_element_in_frames(page, 'text=/Your account has been disabled/i'):
                raise AccountFailedLoginError(f"Account '{email}' is disabled (pre-password).")
            password_frame = await find_visible_element_in_frames(page, password_selector)
            if password_frame:
                print(f"[{email}] VISIBLE password field detected. Continuing automatically.")
                break
            await asyncio.sleep(1)

        if not password_frame:
            raise RuntimeError(f"Timed out after {total_wait_time} seconds waiting for password field.")
        
        print(f"[{email}] 9. Typing password...")
        await password_frame.type(password_selector, password, delay=random.uniform(60, 150))
        
        print(f"[{email}] 10. Clicking 'Next' after password...")
        await page.bring_to_front()
        await password_frame.locator('#passwordNext').click()

        # --- NEW UNIFIED POST-LOGIN LOOP ---
        print(f"[{email}] 11. Waiting for post-login transition...")
        total_wait_time = 60  # Wait up to 60 seconds for the entire post-login flow
        start_time = asyncio.get_event_loop().time()

        while asyncio.get_event_loop().time() - start_time < total_wait_time:
            # Priority 1: Check for SUCCESSFUL redirect (highest priority)
            if "accounts.google.com" not in page.url:
                print(f"[{email}] Successfully redirected.")
                break  # Exit the loop on success

            # Priority 2: Check for RECOVERY challenge
            recovery_challenge_selector = 'div[data-challengetype="12"]'
            recovery_frame = await find_visible_element_in_frames(page, recovery_challenge_selector)
            if recovery_frame:
                print(f"[{email}] Verification page detected. Handling recovery email.")
                if not recovery_email:
                    raise AccountFailedLoginError(f"Account '{email}' requires verification, but no recovery email was provided.")
                
                await page.bring_to_front()
                await recovery_frame.locator(recovery_challenge_selector).click()
                
                recovery_email_selector = 'input[type="email"]'
                recovery_input_frame = None
                for _ in range(10):
                    recovery_input_frame = await find_visible_element_in_frames(page, recovery_email_selector)
                    if recovery_input_frame: break
                    await asyncio.sleep(1)

                if not recovery_input_frame:
                    raise RuntimeError("Could not find recovery email input field after clicking verification option.")
                
                await recovery_input_frame.type(recovery_email_selector, recovery_email, delay=random.uniform(50, 120))
                
                next_button_selector = 'button[jsname="LgbsSe"].VfPpkd-LgbsSe-OWXEXe-k8QpJ'
                next_button_frame = await find_visible_element_in_frames(page, next_button_selector)
                if not next_button_frame:
                    raise RuntimeError("Could not find 'Next' button after entering recovery email.")

                next_button = next_button_frame.locator(next_button_selector)
                print(f"[{email}] Clicking 'Next' after recovery email.")
                await page.bring_to_front()
                await next_button.click()
                
                # Reset timer and continue loop to see what page comes next (e.g., consent or redirect)
                start_time = asyncio.get_event_loop().time()
                await asyncio.sleep(2) # Give page time to transition
                continue

            # Priority 3: Check for CONSENT page
            consent_frame = await find_visible_element_in_frames(page, f'xpath={CONSENT_BTN_XPATH}')
            if consent_frame:
                print(f"[{email}] Consent page detected. Clicking consent button.")
                await page.bring_to_front()
                await click_consent_xpath(consent_frame, timeout_s=10)
                # Reset timer and continue loop to wait for redirect
                start_time = asyncio.get_event_loop().time()
                await asyncio.sleep(2)
                continue

            # Priority 4: Check for FAILURE conditions
            if await find_visible_element_in_frames(page, 'input[type="tel"]'):
                raise AccountFailedLoginError(f"Account '{email}' requires phone number verification, which cannot be automated.")
            
            disabled_selector = 'text=/Couldn\'t sign you in|account disabled|unusual activity/i'
            if await find_visible_element_in_frames(page, disabled_selector):
                raise AccountFailedLoginError(f"Account '{email}' is disabled or suspended (post-password).")

            # If nothing found, wait and retry
            await asyncio.sleep(1)

        # After the loop, check if we successfully redirected. If not, we're stuck.
        if "accounts.google.com" in page.url:
            raise AccountFailedLoginError(f"Account '{email}' got stuck on a Google page after login attempt. Final URL: {page.url}")

        print(f"[{email}] 13. Polling for final cookie...")
        cookie = await poll_cookie_any_context(browser, name="j", timeout_s=180)
        print(f"[{email}] 14. Login sequence complete.")
        return cookie

# ===================== EMAIL & STATE HANDLING =====================
def remove_user_from_emails_file(email_to_remove, path=EMAILS_FILE):
    p = pathlib.Path(path)
    if not p.exists(): return
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
        updated_lines = [line for line in lines if not line.strip().startswith(email_to_remove)]
        
        tmp_path = p.with_suffix(f"{p.suffix}.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write("\n".join(updated_lines))
        os.replace(tmp_path, p)
        print(f"[INFO] Removed {email_to_remove} from {path}")
    except Exception as e:
        print(f"[ERROR] Could not remove user from emails file: {e}")

def parse_emails_file(path=EMAILS_FILE):
    p = pathlib.Path(path)
    if not p.exists():
        print(f"[ERROR] file not found: {path}"); sys.exit(1)
    pairs = []
    for ln in p.read_text(encoding="utf-8").splitlines():
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        
        parts = s.split("|")
        if len(parts) == 2:
            email, password = parts
            pairs.append((email.strip(), password.strip(), None))
        elif len(parts) == 3:
            email, password, recovery_email = parts
            pairs.append((email.strip(), password.strip(), recovery_email.strip()))
            
    if not pairs:
        print("[ERROR] no valid credentials found"); sys.exit(1)
    return pairs

def load_state():
    if pathlib.Path(STATE_FILE).exists():
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    pairs = parse_emails_file()
    return {
        "version": 1,
        "config": {"socks_host": SOCKS_HOST, "socks_port": SOCKS_PORT, "ctrl_host": CTRL_HOST, "ctrl_port": CTRL_PORT},
        "cursor": {"next_index": 0},
        "accounts": [{"email": e, "password": p, "recovery_email": re, "status": "pending", "tries": 0, "last_error": "", "result": None} for e, p, re in pairs],
    }

def save_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_FILE)

# ===================== TOR HELPERS (ASYNC WRAPPER) =====================
def _sync_tor_newnym(host=CTRL_HOST, port=CTRL_PORT):
    try:
        with Controller.from_port(address=host, port=port) as c:
            c.authenticate()
            if not c.is_newnym_available():
                import time
                time.sleep(c.get_newnym_wait())
            c.signal(Signal.NEWNYM)
            return True
    except Exception as e:
        print(f"[WARN] Could not signal Tor for new identity: {e}")
        return False

async def tor_newnym():
    await asyncio.to_thread(_sync_tor_newnym)

# ===================== ACCOUNT PROCESSING (ASYNC) =====================
async def process_account(state, idx):
    acc = state["accounts"][idx]
    state["cursor"]["next_index"] = idx
    save_state(state)
    acc["tries"] += 1
    try:
        c = await login_once(acc["email"], acc["password"], acc.get("recovery_email"))
        if not c:
            raise RuntimeError("cookie_not_found")
        
        payload = {"cookies": {"j": c.get("value", "")}, "expirationDate": 999999999}
        async with httpx.AsyncClient() as client:
            await client.post(POST_URL, json=payload, timeout=10)
            
        acc["status"] = "ok"
        acc["last_error"] = ""
        acc["result"] = {"domain": c.get("domain", ""), "value": c.get("value", "")}
        print(f"[OK] {acc['email']}")
    except AccountFailedLoginError as e:
        print(f"[WARN] {e}")
        remove_user_from_emails_file(acc["email"])
        acc["status"] = "login_failed"
        acc["last_error"] = str(e)
        print(f"[SKIP] Skipping {acc['email']} permanently and removing from emails.txt.")
    except Exception as e:
        acc["status"] = "error"
        acc["last_error"] = f"{type(e).__name__}: {e}"
        print(f"[ERR] {acc['email']} | {acc['last_error']}")
    finally:
        save_state(state)
        await tor_newnym()
        await asyncio.sleep(3)

def indices_by_status(state, statuses: set[str]) -> list[int]:
    out = []
    for i, a in enumerate(state["accounts"]):
        st = (a.get("status") or "pending").lower()
        if st in statuses:
            out.append(i)
    return out

# ===================== MAIN (ASYNC) =====================
async def main():
    state = load_state()
    q = indices_by_status(state, {"error", "errored"}) + indices_by_status(state, {"pending"})
    seen = set()
    ordered = [i for i in q if not (i in seen or seen.add(i))]

    if not ordered:
        print("[DONE] nothing to process")
        return

    for idx in ordered:
        await process_account(state, idx)

    state["cursor"]["next_index"] = len(state["accounts"])
    save_state(state)
    print("[DONE]")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[INTERRUPTED]")
    except Exception as e:
        print(f"\n[FATAL ERROR] An unexpected error occurred: {e}")