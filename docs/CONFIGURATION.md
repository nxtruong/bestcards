# Configuration reference — schema version 1

The app reads `config/app.json`, then the chosen person's profile. All money amounts are USD. All numeric fields must be JSON numbers, not strings. This release has runtime validation but no external schema validator dependency.

## App configuration

```json
{
  "schemaVersion": 1,
  "appName": "Pocket Perks",
  "users": [
    {"id":"truong","name":"Truong"},
    {"id":"wife","name":"Wife"}
  ],
  "profileUrlTemplate": "./profiles/{id}.json",
  "radiusMeters": 200,
  "overpassEndpoints": ["https://overpass-api.de/api/interpreter"]
}
```

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Required; must be `1`. |
| `appName` | Optional browser page-title prefix. Visible branding remains in index.html. |
| `users` | Required nonempty fixed list. Each entry has a unique `id` and display `name`. IDs allow letters, digits, hyphens, underscores. |
| `users[].configUrl` | Optional complete or relative profile URL; overrides the template for that user. |
| `profileUrlTemplate` | Required string containing `{id}`; all occurrences are replaced with the selected ID. Relative paths resolve against the app.json URL, not index.html. |
| `radiusMeters` | Default search radius: `200`, `500`, or `1000`. Defaults to 200. |
| `overpassEndpoints` | Optional nonempty list of HTTPS Overpass interpreter URLs. Defaults to the one above. If multiple are explicitly configured, they are attempted sequentially on failure. Respect each operator's current policy. |

### Public server or GitHub URLs

Once your files are ready, either set:

```json
"profileUrlTemplate": "https://config.example.net/rewards/{id}.json"
```

or give individual URLs:

```json
"users": [
  {"id":"truong","name":"Truong","configUrl":"https://config.example.net/my-rules.json"},
  {"id":"wife","name":"Wife","configUrl":"https://config.example.net/her-rules.json"}
]
```

For a public GitHub repository, use the raw-file endpoint, for example the URL shape `https://raw.githubusercontent.com/OWNER/REPO/main/config/{id}.json`. Replace OWNER, REPO, branch, and path with your actual values. Do not use a `github.com/.../blob/...` HTML page. Confirm that the response is JSON and permits cross-origin reads in your deployed browser.

External config hosts must allow CORS, typically `Access-Control-Allow-Origin: *` for public files or your exact app origin. A URL working in a browser tab does not establish that JavaScript on another origin can fetch it. This app uses normal CORS requests, not `no-cors`, and does not use a proxy or embed tokens. Do not put GitHub personal access tokens in URLs or browser code.

Same-origin relative configs avoid cross-origin CORS setup. Serve updated JSON with a short/no-cache policy if possible; the app requests `cache: no-store` but cannot control upstream CDN freshness. Open DevTools Network to inspect failures.

## Profile structure

```json
{
  "schemaVersion": 1,
  "sample": false,
  "updated": "2026-11-07",
  "cards": [
    {
      "id": "points-card",
      "name": "My points card",
      "unit": "points",
      "baseRate": 1,
      "centsPerPoint": 1.2,
      "categoryRates": {"dining":3,"groceries":2}
    },
    {"id":"cash-card","name":"My cashback card","unit":"cashback","baseRate":2}
  ],
  "categoryOverrides": [
    {"merchants":["Costco","Sam's Club"],"category":"wholesale"}
  ],
  "offers": []
}
```

`sample: true` displays a prominent sample-wallet notice. `updated` is an optional human-readable freshness label; it has no effect on offer eligibility.

### Cards

| Field | Meaning |
| --- | --- |
| `id` | Required unique stable ID within the profile. Same safe characters as user IDs. |
| `name` | Required display label; no account numbers are needed. |
| `unit` | Required `points` or `cashback`. Treat miles as points. |
| `baseRate` | Required nonnegative number. Points per dollar for a points card; percentage for a cashback card. |
| `centsPerPoint` | Required positive number for a points card. `1.2` means one point is worth 1.2 cents. Ignored for cashback cards. |
| `categoryRates` | Optional map of category IDs to **total ordinary rates**, not additional bonuses. Rates have the same units as baseRate. |

An absent category uses baseRate. Category rates describe your currently applicable ordinary rewards. For a capped permanent category, update the rate when its cap is exhausted, or model the capped category benefit as a total_rate offer instead. The app never infers year-to-date spending. Do not represent the same benefit both as a categoryRate and an additive offer.

### Supported category IDs

| ID | Label | Typical automatic source |
| --- | --- | --- |
| `groceries` | Groceries | OSM shop=supermarket |
| `gas` | Gas stations | amenity=fuel |
| `dining` | Dining & cafés | Restaurants, cafés, fast food, bars, pubs, ice cream |
| `pharmacy` | Pharmacies | amenity=pharmacy, shop=chemist |
| `wholesale` | Warehouse clubs | Wholesale tags or recognized warehouse brands |
| `department` | Department stores | shop=department_store |
| `home_improvement` | Home improvement | Hardware, DIY, trade shops |
| `electronics` | Electronics | Electronics/computer/mobile phone stores |
| `clothing` | Clothing | Clothes, shoes, fashion |
| `hotel` | Hotels | Hotels, motels, hostels, guest houses |
| `travel` | Travel | Travel agencies and car rental |
| `entertainment` | Entertainment | Cinemas, theatres, museums, theme parks |
| `other` | Other purchases | Unclassified businesses and convenience stores |

These mappings are estimates. They are not issuer-certified reward categories or MCC lookups. `src/places.js` contains the automatic mapping. `src/core.js` defines the friendly category IDs. Custom category IDs require changing both code and validation.

### Merchant category overrides

`categoryOverrides` is an ordered list. Each entry has a nonempty `merchants` list and a category. The first matching override wins. It applies to every branch matching that name/brand, including potentially an attached fuel station, so create only broad overrides you intend. No coordinates are required. The on-screen category selector can override a single merchant selection without changing the file.

## Offers

```json
{
  "id": "gas-q4-2026",
  "card": "points-card",
  "title": "Gas: 5× total points",
  "kind": "total_rate",
  "value": 5,
  "match": {"categories":["gas"],"excludeMerchants":["Costco","Sam's Club"]},
  "starts": "2026-10-01",
  "expires": "2026-12-31",
  "spendCap": 150,
  "channel": "in_store",
  "enabled": true,
  "note": "Activate with the issuer first. $150 of eligible spending remains."
}
```

### Offer kinds and units

| `kind` | `value` means | How it combines |
| --- | --- | --- |
| `total_rate` | Total points per dollar or total cashback percentage, using the card's unit | Competes with ordinary category rewards; adds only the improvement. Only the best eligible total_rate offer is applied per card. |
| `extra_rate` | Additional points per dollar or additional cashback percentage, using the card's unit | Adds to ordinary rewards and any winning replacement improvement. |
| `fixed_points` | A fixed number of bonus points | Adds cash value using the card's centsPerPoint; only allowed on points cards. |
| `fixed_cash` | Fixed US-dollar bonus | Adds the given dollar amount to either kind of card. |
| `percent_cashback` | Extra percentage cashback, regardless of the card's unit | Adds cash value; `5` means an extra 5% of eligible spending. |

Use total_rate for "earn 5× total", extra_rate for "earn 4× extra", and percent_cashback for "get 5% back" on a points card. Misclassifying a total rate as an additional rate overstates rewards.

### Offer fields

| Field | Required? | Meaning |
| --- | --- | --- |
| `id` | Yes | Unique stable ID. New promotion/renewal should get a new ID. |
| `card` | Yes | Exact ID of a card in this profile. |
| `title` | Yes | Short display description. |
| `kind`, `value` | Yes | One of the kinds above and a nonnegative number. |
| `match` | No | Matching selectors; omitted or `{}` means all merchants. |
| `minSpend` | No | Minimum amount of the **current purchase**, inclusive, in USD. Defaults to 0. |
| `spendCap` | No | Remaining eligible **USD spending**, for total_rate, extra_rate, or percent_cashback only. Excess spending still earns ordinary rewards. |
| `rewardCap` | No | Remaining **incremental offer reward** cap. Points for total_rate/extra_rate/fixed_points on a points card; USD for all other cases. It does not cap ordinary rewards. |
| `starts`, `expires` | No | Real YYYY-MM-DD dates, inclusive, evaluated using the browser's local date. |
| `channel` | No | `in_store`, `online`, or `both` (default). This filters offers, not ordinary category rates. |
| `enabled` | No | Defaults true. Set false to disable for everyone reading that config. |
| `exclusiveGroup` | No | Additive offers with the same group on a card compete; only the largest cash-value bonus applies. Not allowed for total_rate, which already has its own competition. |
| `note` | No | Display-only reminder about activation, exclusions, or eligibility. Notes do not change calculations. |

### Matching rules

```json
"match": {
  "merchants": ["Chevron", "Texaco"],
  "categories": ["gas"],
  "excludeMerchants": ["Excluded brand"]
}
```

- Values within a list are **OR**. Different selector types are **AND**.
- The example requires gas category AND either Chevron or Texaco AND no excluded merchant.
- Merchant text is compared against OSM name, brand, operator, and available alternate names.
- Matching ignores case, accents, and punctuation and uses whole-word phrases. `Chevron` matches `Chevron Food Mart`; `Shell` does not match `Shellfish Kitchen`.
- OSM alternate names are supported. For other aliases, put each spelling in the merchants list.
- It is phrase matching, not fuzzy matching or arbitrary regex. Misspellings need an explicit alias or manual name entry.
- Selectors accept nonempty lists. Omit a selector instead of setting it to an empty list.

### Stacking and caps

The engine starts with the card's category rate (or baseRate), chooses the total_rate offer with the highest **incremental dollar benefit for this purchase**, and adds eligible additive offers. For additive offers sharing exclusiveGroup, it adds only the most valuable one in that group. Ungrouped additive offers stack independently.

For example: $100 purchase, ordinary 2×, a total 5× promotion, an extra 1× offer, and 5% extra cash back results in 6× points plus $5 cashback, if all terms allow stacking.

Use explicit groups for mutually exclusive additive promotions. More complex exclusions between replacement rates and additive offers, arbitrary combinations, and conditional cross-card requirements are not supported; model only combinations you know are eligible or disable conflicting rules. The app cannot infer these restrictions from offer text.

With a total 5× offer and ordinary 1×, spendCap $50 on a $100 purchase gives ordinary 1× on all $100 plus an extra 4× on $50. A rewardCap of 100 points caps the **extra points**, not the total purchase earnings. If your issuer caps total points instead, translate its terms to a remaining incremental cap or use spendCap.

For a cashback card, total_rate value 5, baseRate 2, rewardCap 3 means at most $3 additional cashback, in addition to ordinary rewards. Do not enter `5` for a $5 cap on a points rate offer: that means 5 points. Use percent_cashback or fixed_cash for dollar bonuses.

## Additional examples

### Fixed merchant bonus

```json
{
  "id":"publix-1000-2026-11",
  "card":"points-card",
  "title":"Publix: 1,000 bonus points on $50",
  "kind":"fixed_points",
  "value":1000,
  "minSpend":50,
  "match":{"merchants":["Publix"]},
  "channel":"in_store",
  "expires":"2026-11-30"
}
```

This only checks the present purchase amount. For an offer requiring cumulative spending, track progress yourself and model the remaining threshold only if the next qualifying transaction really triggers the whole bonus. The app has no cumulative transaction ledger.

### Extra cashback on a points card, capped in dollars

```json
{
  "id":"chevron-cashback-2026-11",
  "card":"points-card",
  "title":"Chevron: extra 5% back, up to $5",
  "kind":"percent_cashback",
  "value":5,
  "rewardCap":5,
  "match":{"merchants":["Chevron"],"categories":["gas"]},
  "channel":"in_store",
  "expires":"2026-11-30"
}
```

### Two additive coupons that cannot combine

Give both offers `"exclusiveGroup":"merchant-coupon"`. The engine chooses the larger incremental cash value for that card and purchase. Group names are local to each card evaluation, so the same name on different cards does not stop either card from being compared.

## Calculation and display details

- Points value = spend × points-per-dollar × centsPerPoint ÷ 100.
- Cashback value = spend × percentage ÷ 100.
- Effective return = total estimated dollar value ÷ purchase amount × 100.
- Rates and comparisons use unrounded floating-point values; amounts are rounded to cents only for display. Issuer point rounding and statement timing can differ.
- A blank amount excludes all special offers; ordinary rates are compared on an equivalent percentage basis. No fictitious fixed bonus is shown without a purchase amount.
- Ties are resolved alphabetically for stable ordering, with a same-value label. There is no automatic card charging or Apple Pay selection.
- Expired, upcoming, disabled, and locally used offers are excluded but remain visible in the offer list.
- The app does not account for taxes excluded by an offer, gift-card restrictions, merchant fees, annual fees, transfer bonuses, redemption availability, or payment-method exclusions unless you manually adjust the eligible amount or rules.
