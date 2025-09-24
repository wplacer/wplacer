# Auto Login

1. Install the required Python dependencies. `install.bat`
2. Install camoufox. `camoufox fetch`
3. Create a list of email addresses and passwords to be used for auto-login. `emails.txt`
4. Create a list of proxy servers to be used for the auto-login process. `proxies.txt`
5. (If still on upstream) Fix `autologin.py`
    `autologin.py#L138`

    ```diff
    ...
        try:
    -        async with httpx.AsyncClient(proxies=proxies, follow_redirects=True) as client:
    +        async with httpx.AsyncClient(proxy=proxy_http, follow_redirects=True) as client:
                r = await client.get(backend_url, timeout=15)
    ...
    ```

6. Run the auto-login server. `python api_server.py`
7. Run the auto-login client. `python autologin.py`

## install.bat

This file is a batch script that installs the required Python dependencies for the auto-login process.

### requirements.txt

This file contains the list of Python dependencies required for the auto-login process.

## emails.txt

The `emails.txt` file contains a list of email addresses and passwords to be used for auto-login. Each line should be in the format `email|password|recovery_email`, with the recovery_email field being optional. Lines starting with `#` are ignored.

Example:

```plaintext
user1@gmail.com|password123|recovery@example.com
user2@gmail.com|password456
user3@gmail.com|password789|recovery@example.com
```

## State file

The `data.json` file contains the state of the auto-login process. It is used to track the progress of the auto-login process and to store the results of each login attempt.

## proxies.txt

The `proxies.txt` file contains a list of proxy servers to be used for the auto-login process. Each line should be in the format `protocol://username:password@host:port`

Example:

```plaintext
socks5://user:pass@127.0.0.1:9050
http://user:pass@127.0.0.1:80
```

## api_server.py

The `api_server.py` file is a FastAPI server that exposes a local API to solve Cloudflare Turnstile challenges.

## autologin.py

The `autologin.py` file is the main script that handles the auto-login process. It is responsible for:

1. Polling the local Turnstile solver API for a solved token.
2. Fetching the Google OAuth login URL from `backend.wplace.live` using the token, then launching a browser.
3. Navigating to the Google login page and entering the email and password.
4. Waiting for the password field to appear, typing the password, and clicking the "Next" button.
5. Waiting for the post-login transition to complete.
6. POSTing the Google session cookie `j` to the wplacer server's `/user` endpoint.
