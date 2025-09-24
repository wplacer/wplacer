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
# MFA_EMAILS_FILE = "mfa_emails.txt"
PROXIES_FILE = "proxies.txt"
POST_URL = "http://10.0.1.3:3031/user"  # IMPORTANT: Update this to your wplacer controller's port (e.g., 3000)
CTRL_HOST, CTRL_PORT = "127.0.0.1", 9151
SOCKS_HOST, SOCKS_PORT = "127.0.0.1", 9150

ADDONS = []

ADDONS_ABS = [os.path.abspath(addon) for addon in ADDONS]

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
async def get_solved_token(api_url="http://localhost:8080/turnstile", target_url="https://backend.wplace.live", sitekey="0x4AAAAAABpHqZ-6i7uL0nmG"): # CORRECTED sitekey
    proxy = next(proxy_pool)
    try:
        async with httpx.AsyncClient() as client:
            params = {"url": target_url, "sitekey": sitekey, "proxy": proxy}
            print("    - Requesting captcha task from API server...")
            r = await client.get(api_url, params=params, timeout=30)
            if r.status_code != 202:
                raise RuntimeError(f"API server returned bad status {r.status_code}: {r.text}")

            task_id = r.json().get("task_id")
            if not task_id:
                raise RuntimeError("API server did not return a task_id")

            print(f"    - Got task ID: {task_id}. Polling for result (up to 120s)...")

            for i in range(60):
                await asyncio.sleep(2)
                res = await client.get(f"http://localhost:8080/result", params={"id": task_id}, timeout=20)
                res_json = res.json()
                if res_json.get("status") == "success":
                    print("    - Captcha solved successfully.")
                    return res_json.get("value")
                elif res_json.get("status") == "error":
                    raise RuntimeError(f"Solver API returned an error: {res_json.get('value')}")
            raise RuntimeError("Captcha solving timed out after 120 seconds")
    except httpx.ConnectError as e:
        raise RuntimeError(f"Could not connect to the API server at {api_url}. Is api_server.py running? Error: {e}")
    except httpx.TimeoutException:
        raise RuntimeError(f"Request to the API server timed out. The server might be slow or hanging.")
    except Exception as e:
        raise RuntimeError(f"An unexpected error occurred in get_solved_token: {e}")



# ===================== LOGIN FLOW UTILS =====================
async def try_another_way(page: Page, email: str):
    print(f"[{email}]   - Clicking 'Try another way' button...")
    # await page.locator('button:has-text("Continue")').click()
    await page.locator('button:has-text("Try another way")').click()

async def switch_to_password(page: Page, email: str):
    print(f"[{email}]   - Switching to password login...")
    await page.locator('text=/Enter your password/i').click()

# ===================== LOGIN (ASYNC) =====================
async def login_once(email, password, recovery_email=None):
    print(f"[{email}] 1. Getting captcha token (using proxy)...")
    token = await get_solved_token()
    backend_url = f"https://backend.wplace.live/auth/google?token={token}"

    proxy_http = next(proxy_pool)
    print(f"[{email}] 2. Getting Google login URL (using proxy {proxy_http})...")
    proxies = {"http://": proxy_http, "https://": proxy_http}
    try:
        async with httpx.AsyncClient(proxy=proxy_http, follow_redirects=True) as client:
            r = await client.get(backend_url, timeout=15)
            google_login_url = str(r.url)
    except Exception as e:
        raise RuntimeError(f"Failed to get Google login URL via proxy {proxy_http}: {e}")


    custom_fonts = ["Arial", "Helvetica", "Times New Roman"]


    # turn socks5://wujnqbda-NL-2:9rsllkbfvfru@p.webshare.io:80 into { "server": "socks5://p.webshare.io:80", "username": "wujnqbda-NL-2", "password": "9rsllkbfvfru" }

    proxy_protocol = proxy_http.split("://")[0] + "://"
    proxy_server = proxy_protocol + proxy_http.split("://")[1].split("@")[1]
    proxy_username = proxy_http.split("://")[1].split(":")[0]
    proxy_password = proxy_http.split("://")[1].split(":")[1].split("@")[0]

    proxy = {"server": proxy_server, "username": proxy_username, "password": proxy_password}

    print(f"[{email}] 3. Launching browser using proxy {proxy_http}...")
    # print(f"[{email}] 3. Launching browser...")

    async with AsyncCamoufox(
        # addons=ADDONS_ABS,
        headless=False,
        humanize=True,
        block_images=False,
        disable_coop=True,
        screen=Screen(min_width=1920, max_width=1920, min_height=1080, max_height=1080),
        fonts=custom_fonts,
        os=["windows"],
        geoip=True,
        locale="en-NL",
        i_know_what_im_doing=True,
        proxy=proxy
    ) as browser:
        page = await browser.new_page()
        page.set_default_timeout(120000)

        print(f"[{email}] 5. Navigating to Google login page...")
        await page.goto(google_login_url, wait_until="domcontentloaded")

        print(f"[{email}] 6. Switching to English...")
        # append &hl=en to the end of the currently open URL
        await page.evaluate("window.location.href = window.location.href + '&hl=en';")

        print(f"[{email}] 7. Finding and typing email...")
        email_frame = await find_visible_element_in_frames(page, 'input[type="email"]')
        if not email_frame: raise RuntimeError("Could not find email input field.")
        await email_frame.type('input[type="email"]', email, delay=random.uniform(50, 120))

        # print(f"[{email}] 8. Clicking 'Next' after email...")
        # await email_frame.locator('#identifierNext').click()
        print(f"[{email}] 8. Pressing enter after email...")
        await page.keyboard.press(key='Enter', delay=random.uniform(50, 120))

        start_time = asyncio.get_event_loop().time()
        total_wait_time = 120

        password_selector = 'input[type="password"]'
        password_frame = None

        print(f"[{email}] 9. Waiting for next page...")
        while asyncio.get_event_loop().time() - start_time < total_wait_time:
            # Account has been disabled
            if await find_visible_element_in_frames(page, 'text=/Your account has been disabled/i'):
                raise AccountFailedLoginError(f"Account '{email}' is disabled (pre-password).")
            # Passkey page
            if await find_visible_element_in_frames(page, 'text=/Use your passkey to confirm it’s really you/i'):
                print(f"[{email}] > Passkey page detected. Trying another way.")
                await try_another_way(page, email)
            # Try different methods page
            if await find_visible_element_in_frames(page, 'text=/Choose how you want to sign in:/i'):
                print(f"[{email}] > Try different methods page detected. Switching to password login.")
                await switch_to_password(page, email)
            # Password field
            password_frame = await find_visible_element_in_frames(page, password_selector)
            if password_frame:
                print(f"[{email}] > Password field detected. Continuing...")
                break
            await asyncio.sleep(1)

        if not password_frame:
            raise RuntimeError(f"Timed out after {total_wait_time} seconds waiting for password field.")

        print(f"[{email}] 10. Typing password...")
        await password_frame.type(password_selector, password, delay=random.uniform(60, 150))

        print(f"[{email}] 11. Pressing enter after password...")
        await page.keyboard.press(key='Enter', delay=random.uniform(50, 120))

        # print(f"[{email}] 10. Clicking 'Next' after password...")
        # await password_frame.locator('#passwordNext').click()

        print(f"[{email}] 12. Waiting for post-login transition...")
        total_wait_time = 60
        start_time = asyncio.get_event_loop().time()

        while asyncio.get_event_loop().time() - start_time < total_wait_time:
            if "accounts.google.com" not in page.url:
                print(f"[{email}] Successfully redirected.")
                break

            recovery_challenge_selector = 'div[data-challengetype="12"]'
            recovery_frame = await find_visible_element_in_frames(page, recovery_challenge_selector)
            if recovery_frame:
                print(f"[{email}] Verification page detected. Handling recovery email.")
                if not recovery_email:
                    raise AccountFailedLoginError(f"Account '{email}' requires verification, but no recovery email was provided.")

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
                await next_button.click()

                start_time = asyncio.get_event_loop().time()
                await asyncio.sleep(2)
                continue

            consent_frame = await find_visible_element_in_frames(page, f'xpath={CONSENT_BTN_XPATH}')
            if consent_frame:
                print(f"[{email}] Consent page detected. Clicking consent button.")
                await click_consent_xpath(consent_frame, timeout_s=10)
                start_time = asyncio.get_event_loop().time()
                await asyncio.sleep(2)
                continue

            if await find_visible_element_in_frames(page, 'input[type="tel"]'):
                raise AccountFailedLoginError(f"Account '{email}' requires phone number verification, which cannot be automated.")

            disabled_selector = 'text=/Couldn\'t sign you in|account disabled|unusual activity/i'
            if await find_visible_element_in_frames(page, disabled_selector):
                raise AccountFailedLoginError(f"Account '{email}' is disabled or suspended (post-password).")

            await asyncio.sleep(1)

        if "accounts.google.com" in page.url:
            raise AccountFailedLoginError(f"Account '{email}' got stuck on a Google page after login attempt. Final URL: {page.url}")

        print(f"[{email}] 13. Polling for final cookie...")
        cookie = await poll_cookie_any_context(browser, name="j", timeout_s=180)
        print(f"[{email}] 14. Login sequence complete.")
        return cookie

# ===================== EMAIL & STATE HANDLING =====================
def remove_user_from_emails_file(email_to_remove, path=EMAILS_FILE):
    emails = pathlib.Path(path)
    # mfa_emails = pathlib.Path(mfa_emails)
    if not emails.exists(): return
    # if not mfa_emails.exists():
    #     mfa_emails.touch()
    try:
        lines = emails.read_text(encoding="utf-8").splitlines()
        # mfa_lines = mfa_emails.read_text(encoding="utf-8").splitlines()

        updated_lines = []

        for line in lines:
            if line.strip().startswith(email_to_remove):
                continue
                # mfa_lines.append(line)
            else:
                updated_lines.append(line)

        # if mfa_lines:
        #     tmp_mfa_emails = mfa_emails.with_suffix(f"{mfa_emails.suffix}.tmp")
        #     with open(tmp_mfa_emails, "w", encoding="utf-8") as f:
        #         f.write("\n".join(mfa_lines))
        #     os.replace(tmp_mfa_emails, mfa_emails)
        #     print(f"[INFO] Wrote {email_to_remove} to {mfa_emails_path}")

        tmp_path = emails.with_suffix(f"{emails.suffix}.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write("\n".join(updated_lines))
        os.replace(tmp_path, emails)
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
