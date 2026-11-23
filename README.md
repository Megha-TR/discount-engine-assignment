# Opptra Discount Engine

A working extension of [Opptra's starter](https://github.com/opptra/discount-engine-assignment): cart-level offers, LLM rule preview/confirmation, CSV and PDF cart input, and a responsive checkout summary. All cart and rule state is in memory.

**Repository:** [Megha-TR/discount-engine-assignment](https://github.com/Megha-TR/discount-engine-assignment)

**Live demo:** [opptra-discount-engine-beta.vercel.app](https://opptra-discount-engine-beta.vercel.app)

## Run locally (3 steps)

Requires Node.js 20.19+ (22 LTS recommended).

1. `npm ci`
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` for natural-language parsing. Gemini is the default provider; `GEMINI_MODEL` defaults to `gemini-2.5-flash`. To use OpenAI instead, set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` (`OPENAI_MODEL` defaults to `gpt-4o-mini`). CSV, PDF and pricing work without a key.
3. `npm run dev` and open http://localhost:5173.

Never use a `VITE_` prefix for secrets: those variables are bundled into the browser.

## Try it

- Click **Try sample cart** to load all four assignment rules and six items.
- Or upload `sample-data/rules.csv`, followed by `sample-data/cart.csv` or `sample-data/cart.pdf`.
- Enter `20% off for Natura Casa brand, stackable with other offers`, preview the structured fields, then confirm or discard. Confirmation adds a uniquely identified rule and recalculates the existing cart.
- Try `Rs.100 flat discount on all Flipkart items` or `10% off if cart value is more than Rs.5,000`.
- `Give a discount for big orders` should ask for a value and qualifying condition.
- Replacing the cart retains active rules. Uploading rules replaces the active rules. Failed imports preserve the previous state.

## Vercel deployment

1. After reviewing local changes, create your own fork of the starter and publish this code to it. Import that fork into Vercel, selecting the Vite framework. The checked-in `vercel.json` sets the build command, `dist` output and serverless endpoint.
2. Set `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in Vercel's project environment variables. Select Node.js 22 in project settings, then deploy. No separate database, PDF server or file storage is needed.
3. Test both upload formats and a real natural-language offer on the live site. Record the live URL above before submission. If a walkthrough is required, record it against that deployment.

`npm run build` creates the static client. **Do not deploy only `dist/` to a static host for the complete app**: natural-language parsing also requires `api/parse-rule.js`. `npm run preview` previews static assets only; use `npm run dev` to exercise the local API.

The endpoint is an assignment prototype with bounded requests and a provider timeout. Before a broad public release, add deployment-level rate limits/budget controls or authentication to the paid parsing endpoint.

## Pricing decisions

The original pure item calculator is retained, with discount amounts capped at the current price so prices cannot go negative. A separate `priceCart` orchestration function handles cart offers.

- Match brands/platforms by trimmed, case-insensitive equality.
- Compare non-stackable item offers by saving in rupees. Stable ties favor input order.
- Apply the winning non-stackable rule first, then all stackable rules in input order. A stackable offer also works alone.
- Preserve starter rounding: whole-rupee base prices and each discount rounded with `Math.round`. This intentionally matches the assignment's expected totals instead of introducing paise accounting.
- Test cart thresholds against the sum of final item prices, **inclusive of the threshold**, before cart offers. As in the brief's example, “more than” is interpreted as an inclusive minimum and the confirmation explicitly shows this.
- Multiple non-stackable cart rules compete on savings; eligible stackable cart rules apply afterward in input order. Each cart rule's eligibility uses the same original item subtotal. These additional cases are documented because the brief only supplies one cart rule.
- Cart offers are separate summary rows, never per-item discounts. No eligible saving means no cart offer row.

| Item           |   Base | Final before cart offer |
| -------------- | -----: | ----------------------: |
| Cushion Cover  | ₹1,299 |                  ₹1,104 |
| Bed Sheet Set  |   ₹849 |                    ₹629 |
| Wall Shelf     |   ₹599 |                    ₹509 |
| Ceramic Vase   | ₹2,499 |                  ₹2,499 |
| Cutting Board  |   ₹449 |                    ₹382 |
| Desk Organiser |   ₹899 |                    ₹809 |

Subtotal **₹5,932**, cart saving **₹593**, final total **₹5,339**. No-offer items explicitly show “No offers available.”

## Input and LLM tradeoffs

- CSV and AI rule responses share `validation.js`: finite values, percentages in `(0,100]`, strict booleans, valid scopes/types, cart thresholds, required fields and unique CSV IDs. Prices may be zero, but cannot be negative. IDs for confirmed AI rules are generated by the app.
- CSV imports are atomic: any invalid row rejects the entire replacement with row-specific errors. This avoids quietly dropping products at checkout.
- Browser PDF.js reads text-based, simple tables with separate cell text runs and the columns **Product, Brand, Platform, Base Price**. The adapter uses header coordinates to retain multiword fields, handles repeated headers across pages, creates sequential item IDs and validates all rows before replacing the cart. Malformed rows reject the import. Images/scans, encrypted PDFs, merged cells, complex layouts and wrapped rows are not supported; use CSV or export a simple text PDF. Files are limited to 10 MB and PDFs to 30 pages. PDF bytes stay in the browser.
- The LLM returns a strict JSON-schema response via [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) by default, with the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/structured-outputs) as an optional provider. The server validates business constraints independently, then the client validates again before preview. Model refusals, missing configuration, incomplete/malformed outputs, rate limits and timeouts surface as actionable errors. The prompt rejects unsupported conditions instead of silently discarding them.
- Although the brief allows client-only implementation, a minimal serverless endpoint is used to keep the paid LLM API key private. Only offer descriptions leave the browser; cart/PDF data is not sent to the LLM. OpenAI requests set `store: false`; Gemini data handling follows the configured Google API account terms.
- No deterministic parser masquerades as an LLM. Without a key the interface explicitly reports that parsing is unavailable. Tests use controlled provider responses and do not prove live model accuracy.

## Architecture

```
CSV adapter ─┐
PDF adapter ─┴─> validated CartItem[] ─┐
                                    ├─> item calculator ─> cart offers ─> checkout
Rules CSV ──────────────────────────┤
English ─> API ─> LLM ─> validation ─> preview ─> confirmed DiscountRule[]
```

- `src/engine/discountEngine.js`: pure original calculator plus cart orchestration.
- `src/engine/csvParser.js`, `pdfParser.js`, `pdfRows.js`: independent adapters.
- `src/engine/validation.js`: shared input contract.
- `server/ruleParser.js`: provider request and response validation, independent of UI.
- `api/parse-rule.js`: Vercel function; `server/devPlugin.js` provides the same handler locally.
- `src/components/RuleInput.jsx`: preview/confirm/discard state; `src/App.jsx`: session state and derived checkout totals.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

Unit tests cover all sample prices, cart thresholds at/below the boundary, post-discount eligibility, stackable-only and competing rules, capped discounts, invalid CSV/LLM data and PDF row extraction. Browser tests cover actual CSV/PDF uploads, automatic recalculation, preserving state on errors, preview/confirm/discard, clarification errors and mobile overflow.

Browser tests use local Google Chrome if installed, or Playwright Chromium. On machines without Chrome, run `npx playwright install chromium` first. LLM browser tests mock the API; live provider verification still requires an API key. The server uses native `fetch`; no provider SDK is needed.

Live Gemini smoke check (23 November 2026): `gemini-2.5-flash` correctly parsed the assignment brand, flat-platform and cart-threshold examples, and returned a clarification for the ambiguous big-orders example. Credentials are configured server-side in the ignored local `.env` and Vercel environment variables; they are never committed. These four checks are a smoke test, not a general accuracy evaluation.

Production verification: the public Vercel site passed sample pricing (₹5,339), actual PDF cart upload, live Gemini preview/confirmation with recalculation (₹5,026 after the sample 20% brand offer), and ambiguous-input clarification. No application errors were observed in the browser.

The current deployment was published with the Vercel CLI. To publish future changes after linking the project and signing in, run `vercel --prod`; automatic deployments from GitHub are not currently connected.
