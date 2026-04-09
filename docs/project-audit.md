# Project Audit

## Scope

This repository is a static website plus browser-extension source files and local archive artifacts. There is no framework build step. Production should deploy from `deploy/` only.

## Classification

### Production files

- `deploy/`
  - All site HTML pages
  - Shared CSS and JavaScript
  - Images, icons, `robots.txt`, `sitemap.xml`
  - Cloudflare production config files: `deploy/_headers`, `deploy/_redirects`

### Source files

- `src/browser-extension/`
  - Chrome, Edge, Firefox, and Opera extension source packages

### Documentation

- `README.md`
- `docs/browser-extension/`
  - Privacy policy and store submission notes
- `docs/legacy/`
  - Archived Apache and legacy asset-ignore config that is no longer part of production deploys

### Temporary or backup files

- `backups/archives/`
  - Archived site snapshot zip
  - Archived browser-extension package zips
- `.wrangler/`
  - Local Cloudflare cache and temp data

### Sensitive data

- No secrets or tokens were found in tracked website files during the scan.
- `.env*` remains ignored via `.gitignore`.

### Dead or unused files removed from production

- `deploy/img/9c8df813-11ec-4976-98e1-5e1bbec2f631.png`
  - Moved to `backups/unused-assets/` because it is not referenced by the website
- `.DS_Store` files
  - Removed as junk files
- Root-level production files
  - Moved into `deploy/` so the repository root is no longer a deploy target

## Audit outcomes

- `wrangler.jsonc` now deploys from `deploy/`
- `/deploy` is self-contained for the website
- Browser-extension work is separated from website deployment
- Archive zip files are excluded from normal git flow via `.gitignore`
- A validation script exists at `scripts/validate-deploy.sh` to enforce the deploy-only standard
