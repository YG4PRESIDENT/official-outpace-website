# Outpace website

Static, production-oriented website for Outpace's first free release. The site truthfully says the app is preparing for iPhone and Android; add download links only after actual distribution URLs are verified.

## Development

Requires Node 22.12 or later (Node 24 works). Run:

```sh
npm ci
npm run dev
```

Production checks:

```sh
npm run build
npm run check
npm audit --audit-level=high
```

The build renders eight HTML pages, including a custom 404, into `dist/`. `npm run preview` serves that output. A plain static server also works: `python3 -m http.server 8080 --directory dist`.

## Source

- `scripts/render-pages.mjs`: shared layout, home and how-it-works pages
- `content/legal.json`: privacy, terms, competition rules, support and deletion text
- `src/style.css`: responsive design system
- `src/footer-physics.js`: original decorative Canvas2D glyph springs; same-origin module, no data collection
- `public/`: original Outpace character, app calendar capture, icon and hosting metadata
- `scripts/check-site.mjs`: links/assets, metadata, headings, skip links and stale-content checks

Root HTML files are generated for review; edit the canonical source and run the build. Asset and page links are relative. Canonical URLs target outpaceapp.com. The only runtime JavaScript is a small same-origin module for the decorative footer. It uses no storage, network calls or third-party dependencies. Mouse movement displaces an anchored glyph field; spring motion sleeps after settling, offscreen and when the page is hidden. Touch devices and system reduced motion show a static field. Support/legal navigation and the faint wordmark remain semantic HTML. No external fonts, analytics, signup forms or payments are added. Native HTML disclosures power the FAQ. Email links open the visitor's email app and do not send automatically.

## Product references

The app design is based on the current React Native free-release branch. Winner photos belong only in the leaderboard header; the blue canvas continues below. The home leaderboard is labelled as an illustration with sample names/totals. The calendar is an authentic October 6 app-development capture; replace it with an accepted release capture when available. The character is an existing repository asset.

The first release is free social competition with optional non-redeemable play points. The website does not advertise cash entry, withdrawals, paid subscriptions or an available store listing. Cash functionality is a separate later release.

## Hosting

The site is intended for the existing outpaceapp.com Cloudflare setup. `_headers`, robots and sitemap are included. Preserve all unrelated DNS and email records when connecting the domain. Verify the actual production response headers, redirects, canonical paths, HTTPS and error page after deployment. Do not assume a successful build establishes deployment or visual acceptance.

This branch includes the existing PR2 website corrections and semver-compatible build-tool security updates. Review notes and evidence remain local and are excluded from repository publication.

## Browser checks

Run `npx playwright install chromium` once, then `npm test` after the production build. GitHub Actions installs Chromium on its normal runner and exercises all eight pages at 1440, 768, 390 and 320 pixels. The report includes screenshots of the homepage, privacy and support pages, plus checks for horizontal overflow, image loading, navigation, repeated FAQ controls and keyboard skip links. The `outpace-browser-report` artifact is retained for 14 days. Automated checks complement the final preview and production inspection.
