# Auto Login

This script does NOT work (automatically) with google accounts that have 2FA turned on, as 2FA requires human interaction.

## Dependencies

- Python 3
- Packages:
    - `fastapi`
    - `uvicorn[standard]`
    - `loguru`
    - `camoufox`
    - `browserforge`
    - `playwright`
    - `stem`
    - `httpx`

Install these dependencies using the following commands:

### Install Python

Windows:

```pwsh
winget.exe install --id "Python.Python.3.13" --exact --source winget --accept-source-agreements --disable-interactivity --silent --accept-package-agreements --force
```

### Install Python dependencies

from `/AUTO_LOGIN`

```sh
python -m pip install -r requirements.txt
python -m camoufox fetch
```

## Usage

1. Create a list of email addresses and passwords to be used for auto-login. [`emails.txt`](#emailstxt)
2. Create a list of proxy servers to be used for the auto-login process. [`proxies.txt`](#proxiestxt)
3. (If upstream still broken), Fix `autologin.py`
   `autologin.py#L138`

    ```diff
    ...
        try:
    -        async with httpx.AsyncClient(proxies=proxies, follow_redirects=True) as client:
    +        async with httpx.AsyncClient(proxy=proxy_http, follow_redirects=True) as client:
                r = await client.get(backend_url, timeout=15)
    ...
    ```

4. From `/AUTOLOGIN/tor`, run `./start.bat`
5. From `/AUTO_LOGIN`, run the auto-login server. `./startserver.bat` (or `python api_server.py`)
6. From `/AUTO_LOGIN`, run the auto-login client. `./starttool.bat` (or `python autologin.py`)

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

Note: the Camoufox Client does not support socks5 proxies. To simplify everything, just use http:// proxies.

<!-- ## api_server.py

The `api_server.py` file is a FastAPI server that exposes a local API to solve Cloudflare Turnstile challenges. -->

## autologin.py

The `autologin.py` file is the main script that handles the auto-login process. It is responsible for:

1. Polling the local Turnstile solver API for a solved token.
2. Fetching the Google OAuth login URL from `backend.wplace.live` using the token, then launching a browser.
3. Navigating to the Google login page and entering the email and password.
4. Waiting for the password field to appear, typing the password, and clicking the "Next" button.
5. Waiting for the post-login transition to complete.
6. POSTing the Google session cookie `j` to the wplacer server's `/user` endpoint.
