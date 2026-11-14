# ToolMitra

ToolMitra is a free preliminary website AdSense-readiness checker.

## Cloudflare Pages build settings

- Framework preset: None
- Build command: `exit 0`
- Build output directory: `public`
- Root directory: leave blank (repository root)

The static homepage is `public/index.html`. Pages Functions live separately in the root-level `functions/` directory. The function at `functions/api/adsense-check.js` exposes `POST /api/adsense-check`.

The `public/_routes.json` file limits Function invocation to `/api/*`; static files are served directly.

## Important

This tool provides heuristic checks of publicly accessible website signals. It does not guarantee Google AdSense approval and is not affiliated with Google.
