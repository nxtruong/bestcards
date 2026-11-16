# Pocket Perks user guide

## 1. What it does

Pocket Perks compares the estimated cash value of your credit-card rewards for a purchase. It gets business names, brands, and general business categories from OpenStreetMap through Overpass. You supply the card rates and special offers in JSON files. You never need to maintain merchant coordinates.

You and your wife choose a name from a fixed dropdown. Each name loads a separate config file. The selected profile is remembered on that browser; switching people does not require an account or password.

## 2. Install on your web hosting server

1. Extract the ZIP. Find `pocket-perks/web/`.
2. Create a destination folder on your web host, such as `cards/`.
3. Upload everything **inside** `web/` into that folder, preserving subfolders and filenames. Your destination should contain `index.html`, not just a nested `web/` folder.
4. Enable HTTPS using your host's certificate feature.
5. Open the folder URL with a trailing slash, for example `https://your-domain.example/cards/`.
6. Confirm the page shows a sample-wallet notice and the profile dropdown contains Truong and Wife.
7. Tap **Try sample stores**, tap Chevron, and enter `50`. The fictional Truong example returns $5.50 for Chase: $0.60 ordinary points + $2.40 gas promotion + $2.50 extra Chevron cash back.
8. Test Publix at $49 and $50. At $50, the fictional 1,000-point offer becomes eligible.

This works at the root of your domain or within a subfolder. All bundled asset paths are relative. Your host must serve `.js` files with a JavaScript MIME type and `.json` files as readable JSON, without rewriting them to an HTML page. No routing configuration is needed.

### iPhone Home Screen

In Safari, open your app URL, tap Share, then Add to Home Screen. This gives you an app-like launcher. The app includes a manifest and icon, but no service worker or offline download mechanism. It needs a network connection after opening/reloading. Its browser location permission can differ from another browser or Home Screen context.

## 3. Set up the people and configs

Open `config/app.json` in a text editor. The sample list is:

```json
"users": [
  {"id":"truong","name":"Truong"},
  {"id":"wife","name":"Wife"}
]
```

Change `Wife` to your wife's preferred display name. An ID is a stable filename key, not a display label. Keep it unchanged if you want to preserve locally marked-used offers. You can add more people in the same format.

The default `profileUrlTemplate` is `./profiles/{id}.json`, resolved relative to `config/app.json`. Thus choosing `truong` loads `config/profiles/truong.json`. Choosing `wife` loads `config/profiles/wife.json`.

Later, replace the template with your public server directory:

```json
"profileUrlTemplate": "https://config.example.net/cards/{id}.json"
```

Alternatively, set a separate `configUrl` on each user entry. See the configuration reference for GitHub raw URLs and CORS.

## 4. Enter your real cards and offers

Edit the matching profile JSON files. The bundled examples are deliberately fictional and use distant expiration dates so the demonstration remains usable. They are not live Chase or Capital One terms.

For each card, set the correct ordinary reward rate and category rates. If it earns points or miles, enter your own cents-per-point valuation. If it earns cash back, enter percentages (for example, `2` means 2%). Miles can be modeled with `unit: "points"`.

Add category promotions and merchant offers as described in CONFIGURATION.md. Give each distinct promotion a unique, stable ID. Remove example offers. Update all dates and caps. Finally set `"sample": false`.

JSON does not permit comments or trailing commas. Use a JSON-aware editor such as VS Code. Invalid configs cause a visible error and clear the old recommendations; the app does not silently continue with an earlier wallet.

## 5. Use it at checkout

1. Choose the correct person.
2. Tap **Find nearby businesses** and allow browser location access.
3. Choose the actual merchant from the nearby list. The closest business may be next door or on another floor.
4. If needed, expand the radius to 500 m or 1 km and tap Find nearby businesses again. Changing the radius alone does not initiate a network request.
5. Filter the returned list by name or brand if there are many results. This filters existing results; it is not a worldwide text search.
6. Enter the expected purchase amount in US dollars. This is required to include special offers; without it, the ranking only compares ordinary category rewards.
7. Choose in-store or online. Only offers for the selected channel qualify. Card category rates themselves do not have channel restrictions; use channel-specific offers for temporary or specialized rates.
8. Check the best estimated value and its breakdown. All cards remain visible for comparison.

If an online offer requires clicking through a bank's shopping portal, this app does not perform that step. Follow the actual offer instructions before buying.

### Category uncertainty

An OpenStreetMap category is a business description, not the payment-network Merchant Category Code. The app shows an estimated category. If you know a merchant earns rewards differently, use the **Reward category** dropdown for this selection, or add a merchant-level override to the profile config. Overrides can refer to a brand across all locations, with no coordinates.

Convenience stores are deliberately classified as Other purchases unless another tag or override establishes a more suitable category. The app does not automatically assume all convenience stores earn grocery bonuses.

### Business not found

Expand **Choose a category or enter a store**, type an optional merchant/brand name, select a category, and tap Compare cards here. The name allows merchant offers to match. This is also useful when location permission is denied or Overpass is overloaded.

The sample-store button shows fictional nearby distances and is clearly labeled as sample data. It never uses your location. Tap Find nearby businesses to return to live results.

## 6. Keep offers current

- Tap **Mark used** after redeeming a one-time offer. It is removed from recommendations for that profile on this browser. Tap **Undo used** to restore it.
- For multi-use offers, only mark used when the offer is exhausted. Update the remaining cap in the JSON after partial use.
- For an offer shared across devices, set `enabled: false` in the shared profile when exhausted. Local history does not sync between your phone, your wife's phone, and computers.
- A renewal is a new offer: use a new ID. Otherwise its old local used status may still apply.
- **Reload config** retrieves the chosen profile again and clears the selected merchant. The card/offer files are requested with browser cache disabled, although your host/CDN must also serve updated content. Changing the fixed user list in app.json requires a page reload.
- Expiration dates are inclusive through the selected day, using the device's local calendar date. Re-evaluation occurs when you interact or reload; do not leave a recommendation open overnight and assume it updated at midnight.
- Update `spendCap` and `rewardCap` to remaining amounts, not original maximums. Spending is never inferred from bank transactions.
- **Reset this profile’s local offer history**, under Config & help, clears all locally marked-used IDs for that profile and source URL after confirmation.

If device storage is blocked, the app still works but used-offer history lasts only for the current page session. Private browsing may clear storage when you leave.

## 7. Privacy and access

This is a static client app: choosing a person is not a login. Anyone who can open the site can choose any profile. Public JSON files are public independently of your app's URL. Do not store full card numbers, account IDs, bank logins, balances, or other sensitive records in configs. Card nicknames and reward terms are sufficient.

For private site access, use access control supplied by your host (for example, hosting-level password protection). A password implemented only in JavaScript does not protect downloaded files. Keep files on a protected same-origin host if you also want configs private; external configs must remain accessible to the browser. Same-origin hosting protection can work with normal browser authentication, but cross-origin authenticated private APIs are outside this app's scope.

Location is requested only after you tap the search button. Coordinates and the search radius are sent to your configured Overpass service. That service sees your network request and IP address. Your hosting/config providers also receive ordinary web requests. Nearby results and coordinates are cached in memory for five minutes and are not written to local storage. Local storage contains your selected profile ID and marked-used offer IDs keyed by profile and config source. There are no analytics or bank connections.

The app shows OpenStreetMap attribution. Keep that attribution when modifying it.

## 8. Troubleshooting

| Problem | What to check |
| --- | --- |
| Location denied | Allow location for this site/browser in iPhone or browser settings. Or use the manual category fallback. |
| Location does not work | Use HTTPS. A phone opening your computer's HTTP LAN address is not a secure localhost context. |
| Wrong nearby business | Confirm the merchant yourself; GPS can be imprecise indoors. |
| Empty or incomplete business list | Try a larger radius; OSM may lack that store. Use manual category/name entry. |
| Business lookup times out or HTTP 429 | Public Overpass servers can be busy. Wait, retry later, or use manual entry. Do not repeatedly tap or add continuous polling. |
| Config fetch error | Check the actual raw JSON URL, HTTPS, public access, CORS headers, and JSON syntax. A GitHub HTML file-view link is not a raw JSON URL. |
| Syntax/module error after upload | Preserve `src/` and configure correct JavaScript MIME types. Check your browser developer console. |
| Old config | Tap Reload config; check CDN caching and whether the URL points to the branch/file you updated. |
| No offers in the ranking | Enter an amount; check date, card ID, category/name, channel, enabled flag, used status, threshold, and caps. |
| Different ranking than expected | Check cents-per-point values, category overrides, stacking groups, and whether a total rate was incorrectly entered as an extra rate. |
| Used status differs across devices | Expected: local history is device/browser-specific. Disable the offer centrally in JSON if needed. |

More advanced customization is documented in DEVELOPMENT.md and the root AGENTS.md.
