import time
import uuid
import asyncio
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
from loguru import logger
from camoufox import DefaultAddons
from camoufox.async_api import AsyncCamoufox
import uvicorn

class TurnstileAPIServer:
    HTML_TEMPLATE = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>body's solver</title>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback" async="" defer=""></script>
    </head>
    <body>
        <p id="ip-display"></p>
    </body>
    </html>
    """

    def __init__(self, headless: bool, thread: int, page_count: int, proxy_support: bool):
        self.app = FastAPI()
        self.headless = headless
        self.thread_count = thread
        self.page_count = page_count
        self.proxy_support = proxy_support
        self.page_pool = asyncio.Queue()
        self.browser_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
        ]
        self.camoufox = None
        self.results = {}
        self.proxies = []
        self.max_task_num = self.thread_count * self.page_count
        self.current_task_num = 0
        
        self.app.add_event_handler("startup", self._startup)
        self.app.add_event_handler("shutdown", self._shutdown)
        self.app.get("/turnstile")(self.process_turnstile)
        self.app.get("/result")(self.get_result)

    async def _cleanup_results(self):
        while True:
            await asyncio.sleep(3600)
            expired = [
                tid for tid, res in self.results.items()
                if isinstance(res, dict) and res.get("status") == "error"
                   and time.time() - res.get("start_time", 0) > 3600
            ]
            for tid in expired:
                self.results.pop(tid, None)
                logger.debug(f"Cleaned expired task: {tid}")

    async def _periodic_cleanup(self, interval_minutes: int = 60):
        while True:
            await asyncio.sleep(interval_minutes * 60)
            logger.info("Starting periodic page cleanup")

            total = self.max_task_num
            success = 0
            for _ in range(total):
                try:
                    page, context = await self.page_pool.get()
                    try:
                        await page.close()
                    except:
                        pass
                    try:
                        await context.close()
                    except Exception as e:
                        logger.warning(f"Error cleaning page: {e}")

                    context = await self._create_context_with_proxy()
                    page = await context.new_page()
                    await self.page_pool.put((page, context))
                    success += 1
                    await asyncio.sleep(1.5)
                except Exception as e:
                    logger.warning(f"Page cleanup failed: {e}")
                    continue
            logger.success(f"Cleanup completed. Processed {success}/{total} pages")

    async def _startup(self) -> None:
        logger.info("Initializing browser")
        try:
            await self._initialize_browser()
        except Exception as e:
            logger.error(f"Browser initialization failed: {str(e)}")
            raise

    async def _shutdown(self) -> None:
        logger.info("Cleaning up browser resources")
        try:
            await self.browser.close()
        except Exception as e:
            logger.warning(f"Browser close error: {e}")
        logger.success("Browser resources cleaned up")

    async def _create_context_with_proxy(self, proxy: str = None):
        if not proxy:
            return await self.browser.new_context()

        parts = proxy.split(':')
        if len(parts) == 3:
            return await self.browser.new_context(proxy={"server": proxy})
        elif len(parts) == 5:
            proxy_scheme, proxy_ip, proxy_port, proxy_user, proxy_pass = parts
            return await self.browser.new_context(
                proxy={
                    "server": f"{proxy_scheme}://{proxy_ip}:{proxy_port}",
                    "username": proxy_user,
                    "password": proxy_pass
                }
            )
        else:
            logger.warning(f"Invalid proxy format: {proxy}, using no proxy")
            return await self.browser.new_context()

    async def _initialize_browser(self):
        self.camoufox = AsyncCamoufox(
            headless=self.headless,
            exclude_addons=[DefaultAddons.UBO],
            args=self.browser_args
        )
        self.browser = await self.camoufox.start()

        for _ in range(self.thread_count):
            context = await self._create_context_with_proxy()
            for _ in range(self.page_count):
                page = await context.new_page()
                await self.page_pool.put((page, context))

        logger.success(f"Page pool initialized with {self.page_pool.qsize()} pages")
        asyncio.create_task(self._cleanup_results())
        asyncio.create_task(self._periodic_cleanup())

    async def _solve_turnstile(self, task_id: str, url: str, sitekey: str, action: str = None, cdata: str = None):
        start_time = time.time()
        page, context = await self.page_pool.get()
        try:
            url_with_slash = url + "/" if not url.endswith("/") else url
            turnstile_div = (f'<div class="cf-turnstile" style="background: white;" data-sitekey="{sitekey}"' +
                             (f' data-action="{action}"' if action else '') +
                             (f' data-cdata="{cdata}"' if cdata else '') + '></div>')
            page_data = self.HTML_TEMPLATE.replace("<p id=\"ip-display\"></p>", turnstile_div)
            await page.route(url_with_slash, lambda route: route.fulfill(body=page_data, status=200))
            await page.goto(url_with_slash)
            await page.eval_on_selector("//div[@class='cf-turnstile']", "el => el.style.width = '70px'")

            for attempt in range(30):
                try:
                    turnstile_check = await page.input_value("[name=cf-turnstile-response]", timeout=400)
                    if turnstile_check == "":
                        await page.locator("//div[@class='cf-turnstile']").click(timeout=400)
                        await asyncio.sleep(0.2)
                    else:
                        elapsed_time = round(time.time() - start_time, 3)
                        self.results[task_id] = {
                            "status": 'success',
                            "elapsed_time": elapsed_time,
                            "value": turnstile_check
                        }
                        logger.info(f"Captcha solved successfully. Task ID: {task_id}, Time: {elapsed_time}s")
                        break
                except Exception as e:
                    logger.debug(f"Attempt {attempt + 1} failed: {e}")

            if self.results.get(task_id) == {"status": "process", "message": 'solving captcha'}:
                elapsed_time = round(time.time() - start_time, 3)
                self.results[task_id] = {
                    "status": "error",
                    "elapsed_time": elapsed_time,
                    "value": "captcha_fail"
                }
                logger.warning(f"Captcha solve failed. Task ID: {task_id}, Time: {elapsed_time}s")

        except Exception as e:
            elapsed_time = round(time.time() - start_time, 3)
            self.results[task_id] = {
                "status": "error",
                "elapsed_time": elapsed_time,
                "value": "captcha_fail"
            }
            logger.error(f"Captcha solve error. Task ID: {task_id}: {e}")
        finally:
            self.current_task_num -= 1
            await self.page_pool.put((page, context))

    async def process_turnstile(self, url: str = Query(...), sitekey: str = Query(...), action: str = Query(None),
                                cdata: str = Query(None)):
        if not url or not sitekey:
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "error": "'url' and 'sitekey' parameters are required"}
            )

        if self.current_task_num >= self.max_task_num:
            logger.warning(f"Server at full capacity. Current tasks: {self.current_task_num}/{self.max_task_num}")
            return JSONResponse(
                content={"status": "error", "error": "Server at maximum capacity, please try again later"},
                status_code=429
            )

        task_id = str(uuid.uuid4())
        logger.info(f"New task received. task_id: {task_id}, url: {url}, sitekey: {sitekey}")

        self.results[task_id] = {
            "status": "process",
            "message": 'solving captcha',
            "start_time": time.time()
        }

        try:
            asyncio.create_task(
                self._solve_turnstile(
                    task_id=task_id,
                    url=url,
                    sitekey=sitekey,
                    action=action,
                    cdata=cdata
                )
            )
            self.current_task_num += 1
            return JSONResponse(
                content={"task_id": task_id, "status": "accepted"},
                status_code=202
            )
        except Exception as e:
            logger.error(f"Unexpected error processing request: {str(e)}")
            self.results.pop(task_id, None)
            return JSONResponse(
                content={"status": "error", "message": f"Internal server error: {str(e)}"},
                status_code=500
            )

    async def get_result(self, task_id: str = Query(..., alias="id")):
        if not task_id:
            return JSONResponse(
                content={"status": "error", "message": "Missing task_id parameter"},
                status_code=400
            )

        if task_id not in self.results:
            return JSONResponse(
                content={"status": "error", "message": "Invalid task_id or task expired"},
                status_code=404
            )

        result = self.results[task_id]

        if result.get("status") == "process":
            start_time = result.get("start_time", time.time())
            if time.time() - start_time > 300:
                self.results[task_id] = {
                    "status": "error",
                    "elapsed_time": round(time.time() - start_time, 3),
                    "value": "timeout",
                    "message": "Task timeout"
                }
                result = self.results[task_id]
            else:
                return JSONResponse(content=result, status_code=202)

        result = self.results.pop(task_id)

        if result.get("status") == "success":
            status_code = 200
        elif result.get("value") == "timeout":
            status_code = 408
        elif "captcha_fail" in result.get("value", ""):
            status_code = 422
        else:
            status_code = 500

        return JSONResponse(content=result, status_code=status_code)

def create_app(headless: bool, thread: int, page_count: int, proxy_support: bool) -> FastAPI:
    server = TurnstileAPIServer(headless=headless, thread=thread, page_count=page_count, proxy_support=proxy_support)
    return server.app

if __name__ == '__main__':
    headless = True
    thread = 20
    page_count = 1
    proxy_support = True
    host = "127.0.0.1"
    port = 8080
    app = create_app(headless=headless, thread=thread, page_count=page_count, proxy_support=proxy_support)
    uvicorn.run(app, host=host, port=port)