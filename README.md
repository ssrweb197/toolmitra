# ToolMitra

ToolMitra is a free preliminary website AdSense-readiness checker.

## Cloudflare Pages deployment

- Framework preset: None
- Build command: leave empty
- Build output directory: `public`
- Root directory: `/`

The Pages Function at `functions/api/adsense-check.js` exposes the checker API at `POST /api/adsense-check`.

## Important

This tool provides heuristic checks of publicly accessible website signals. It does not guarantee Google AdSense approval and is not affiliated with Google.

Keep API secrets out of the repository. The current checker does not require API keys.
