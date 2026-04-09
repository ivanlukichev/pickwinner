# Public Repo Notes

## Goal

Keep `pickwinner.tools` ready to function as a real public source repository that can be linked directly from the live site.

## Safe publication scope

- `deploy/**`
- `src/browser-extension/**`
- `scripts/serve-deploy.sh`
- `scripts/validate-deploy.sh`
- `wrangler.jsonc`
- `README.md`
- `docs/browser-extension/**`
- `docs/project-audit.md`

## Local-only or non-public concerns

- `.env*`
- `.wrangler/`
- `backups/`
- local caches and temp files

## Notes

- The repo contains the real production site bundle, not just a showcase README.
- Browser-extension source is included and helps support a transparency angle.
- No tracked secrets were found during the audit and follow-up scans.
- `docs/legacy/` is safe to keep, but it is optional if you ever want a leaner public-facing repo.
