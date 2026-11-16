# Developer guide

## Start and test

Open the extracted `pocket-perks/` folder in VS Code. Codex will find the root AGENTS.md. No npm install is needed.

```bash
npm test
npm run check
cd web
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000/`. For phone tests, upload to an HTTPS staging directory. Keep test profiles visibly marked sample. The entire deployable artifact is the contents of web/.

## Data flow

1. Browser loads index.html, CSS, and ES modules.
2. app.js fetches config/app.json without browser caching, validates it, and resolves the selected profile URL relative to that manifest.
3. It fetches and validates the selected profile. Failed profile loads clear old recommendations. A monotonically increasing sequence number prevents stale asynchronous responses from winning a profile switch.
4. On a location button click, the browser requests coordinates. places.js sends a bounded POST query to Overpass, requesting shops and selected amenities/tourism objects within the radius.
5. Nodes provide coordinates directly; ways and relations use returned centers. Business names and tags are read, unnamed/vacant objects are skipped, and near-identical duplicates within 40 m are collapsed. Distances to centers are approximate, particularly for large buildings.
6. The app maps OSM tags to internal categories and applies the user's name/brand category overrides.
7. On selection, core.js matches offers and computes reward values. The UI renders text safely through DOM textContent.
8. Only selected profile IDs and marked-used offer IDs persist locally. Search coordinates/results stay in memory.

## Merchant data

OpenStreetMap is the database; Overpass is the query API. Nominatim is not used. Current search includes all shop objects, selected purchase-relevant amenities, and selected tourism objects. It is not a complete catalog of every merchant type (for example, many professional services are not queried). Extend `makeQuery()` if you need more tags, keeping the search bounded.

`inferCategory()` is a heuristic mapping. It does not discover bank MCCs. Convenience stores stay other by default. `applyOverrides()` uses the first matching brand/name override. A user's on-screen category choice takes precedence for the current selection only.

The cache reuses results for up to five minutes if the next requested position is within 60 m and the radius matches. Recomputed distances are approximate; the reused result set can omit businesses just beyond the earlier circle. It is a convenience cache, not a precise geofence. There is no automatic background polling. The public service can time out, throttle, or become unavailable. Each configured endpoint gets a bounded attempt; the app then offers manual category/name selection.

The default endpoint accepts ordinary browser CORS requests in its supported configuration. Host/browser/network policies can still block access. Keep the endpoint configurable instead of embedding credentials or adding a proxy just to hide errors.

## Reward-engine extension points

The `rankCards` function is pure and accepts an explicit date for deterministic tests. It returns raw dollar values and a breakdown, leaving display rounding to the UI. Base/category rates are independent of purchase channel; offers can restrict their channel. Each card has a single point valuation.

Replacement total_rate promotions compete by incremental dollar value, including their caps. Additive offers without groups all stack. Each additive exclusiveGroup contributes only its best bonus. The algorithm does not solve general cross-offer constraints or enforce issuer eligibility rules from natural language. See CONFIGURATION.md before adding new kinds.

Potential future features include an in-browser config editor/export, shareable central usage state (would require storage beyond this static design), additional place providers, and more detailed reward eligibility rules. Keep these opt-in. A service worker would require an explicit cache/update/privacy design, particularly for protected hosting and remote config freshness.

## Browser QA checklist

- Both profiles load, with independent used states; returning to a profile restores history.
- Chevron $50 sample returns Chase $5.50 for Truong.
- Publix $49 excludes the 1,000-point bonus; $50 includes it and yields $11 on the sample Capital One card.
- Marking the Publix offer used changes the recommendation to the sample cashback card; Undo restores it.
- Online channel removes the sample in-store merchant offer.
- Missing/negative amount does not include bonuses.
- Manual merchant plus category works without location or an API call.
- Category override changes applicable rewards.
- Config syntax error, 404, and CORS failure yield a visible error, not a stale wallet.
- Denied geolocation and failed business lookup leave the manual fallback available.
- 375–390 px mobile view has no horizontal overflow; touch controls remain usable; 200% zoom works.
- Keyboard navigation, visible focus, text labels, and reduced-motion settings work.
- Test deployment within a subfolder as well as at the host root.

Do not commit private real-world card configs accidentally if moving this project to GitHub. Public sample configs are intentionally synthetic. There are no secrets in the delivered project.
