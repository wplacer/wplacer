#!/usr/bin/env bash

cd "$(dirname "$0")"

if ! [[ -d "data/" ]]; then mkdir "data"; fi
if [[ -f "users.json" ]]; then mv "users.json" "data/users.json"; fi
if [[ -f "templates.json" ]]; then mv "templates.json" "data/templates.json"; fi

if ! [[ -d "node_modules/" || "$NEED_INSTALL" == 1 ]]; then
  echo [setup] Installing dependencies…
  if [[ -f "package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi
else
  npm ls --depth=1 &>/dev/null
  if [[ $? != 0 ]]; then NEED_INSTALL=1; fi
fi

echo [run] npm start
npm start
