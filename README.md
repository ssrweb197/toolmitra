# ToolMitra

ToolMitra is a free preliminary website AdSense-readiness checker.

## Cloudflare Pages deployment

- Framework preset: None
- Build command: `exit 0`
- Build output directory: `.` (repository root)
- Root directory: leave blank (repository root)

The top-level `index.html` is the site homepage. The Pages Function at `functions/api/adsense-check.js` exposes the checker API at `POST /api/adsense-check`.

## Important

This tool provides heuristic checks of publicly accessible website signals. It does not guarantee Google AdSense approval and is not affiliated with Google. The checker blocks private/local network hostnames and does not require API keys.
