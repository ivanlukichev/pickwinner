# PickWinner Tools

PickWinner Tools is a lightweight collection of browser-based randomizers and quick decision tools.

Website:
https://pickwinner.tools/

Public GitHub repo:
https://github.com/ivanlukichev/pickwinner

## What is PickWinner Tools?

PickWinner Tools is built for fast everyday decisions:

- choose a random name
- flip a coin
- roll dice
- generate a random number
- spin a wheel
- split people into teams
- run simple pick-a-card, pick-a-door, and mystery-box style choices

The goal is simple:

open a tool, get a result, move on.

## Why this project exists

Many randomizer websites are overloaded with clutter, ads, extra steps, or slow UI.

PickWinner Tools focuses on:

- instant use
- clean interfaces
- mobile-friendly pages
- no account requirement
- fast static delivery

## Core tools

Current tool set includes:

- Random Name Picker
- Spin the Wheel
- Dice Roller
- Coin Flip
- Random Number Generator
- Random Team Generator
- Pick a Card
- Pick a Door
- Mystery Box Picker

Tool pages live in [`tools/`](./tools).

## Browser extensions

This repository also includes browser extension builds for the Coin Flip tool.

Supported packages:

- Chrome: [`extension/chrome`](./extension/chrome)
- Opera: [`extension/opera`](./extension/opera)
- Firefox: [`extension/firefox`](./extension/firefox)

Current extension behavior:

- opens from the browser toolbar
- shows a compact Coin Flip popup
- runs a simple 50/50 Heads or Tails result
- keeps the UI local and lightweight
- links users back to PickWinner Tools for more randomizers

Extension privacy policy:

- [`extension/privacy-policy.md`](./extension/privacy-policy.md)

Store submission notes:

- [`extension/store/chrome-web-store.md`](./extension/store/chrome-web-store.md)
- [`extension/store/opera-addons.md`](./extension/store/opera-addons.md)
- [`extension/store/firefox-addons.md`](./extension/store/firefox-addons.md)
- [`extension/store/submission-checklist.md`](./extension/store/submission-checklist.md)

## Project structure

```text
.
|-- css/
|-- guides/
|-- img/
|-- js/
|-- tools/
|-- extension/
|   |-- chrome/
|   |-- opera/
|   |-- firefox/
|   |-- privacy-policy.md
|   `-- store/
|-- index.html
|-- _headers
|-- _redirects
`-- wrangler.jsonc
```

## Tech overview

- Plain HTML, CSS, and JavaScript
- No framework
- No build step
- Static deploy setup for Cloudflare Pages / Workers Assets

## Local preview

Run a static server from the repository root:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deployment

### Cloudflare Pages

Recommended settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `/`
- Root directory: `/`
- Production branch: `main`

If Cloudflare requires a build command, use:

```bash
exit 0
```

Cloudflare-specific behavior is defined in:

- [`_headers`](./_headers)
- [`_redirects`](./_redirects)

### Cloudflare Workers Builds

If the project is connected through Workers Builds instead of Pages, use:

- Build command: `exit 0` or leave empty
- Deploy command: `npx wrangler deploy`
- Non-production deploy command: `npx wrangler versions upload`
- Path: `/`

Supporting files:

- [`wrangler.jsonc`](./wrangler.jsonc)
- [`.assetsignore`](./.assetsignore)

## Philosophy

PickWinner Tools is built around small, focused utilities.

No sign-up walls.
No unnecessary setup.
No heavy app shell.

Just useful random tools that open fast and do one job well.

## Author

Created by Ivan Lukichev.

More projects:
https://lukichev.biz/
