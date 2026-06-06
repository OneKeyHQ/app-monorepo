# Validation

## Static Validation

For documentation-only edits, run:

- `git diff --check`

For code edits, choose targeted checks around touched files:

- type checks for affected TypeScript files
- unit tests near touched utilities, hooks, or adapters
- lint/staged checks before commit when staging

## Runtime Payloads To Inspect

When transaction behavior changes, inspect the payloads that prove the chain:

1. quote request and quote response
2. selected provider/quote state
3. review snapshot inputs
4. build response
5. decoded transaction actions and `extraInfo` for setup or auxiliary costs
6. approval/setup response when applicable
7. send result
8. pending history item
9. status polling response
10. history detail fallback payload
11. replay/enrichment payload used to repair old or partial local rows

Do not claim runtime validation from a visible screen alone when the bug is in quote/build/send/history state.

## Surface Validation

Validate on the surface that owns the regression:

- Swap page for normal quote, selector, review, and history work.
- Swap Pro for advanced order/trading UI.
- Market detail for speed-swap, preset, token detail, and K-line issues.
- Signature Confirm for frozen review data.
- History/detail for pending, progress, final status, and price fallback.
- Account history or notification entry when a channel can be opened outside the original submit flow.
- Native mobile when host, modal, safe area, or bottom-sheet behavior is involved.
- Desktop/web/extension when popup, modal, or WebView behavior differs.

## New Channel Acceptance

For a new provider/channel, produce a short acceptance note before or after implementation:

1. Entry surface and integration style.
2. Provider/channel contract fields.
3. State owner for quote, review, build, and history.
4. Listener, local writeback, replay, and repair sources.
5. Runtime payloads needed for proof.
6. Happy path.
7. One stale quote or provider failure path.
8. One history/status path.
9. One replay/repair path when a local row is missing fields.
10. Platform surfaces that must be checked.

If the note cannot be filled, the channel contract is not ready.

## Regression Recipes

Use these recipes based on failure type:

- Quote mismatch: change amount/network/token/provider rapidly and verify stale responses cannot become selected.
- Review drift: enter review, mutate outer page state, and verify confirm still displays the frozen quote/build data.
- Fee/ETA bug: compare quote payload, build payload, review display, and history detail.
- Pending/status bug: send or simulate send success, then verify pending row identity and status polling key.
- Replay/repair bug: open from account history or notification, verify the row
  is enriched once, semantic fields are preserved, and unknown values are not
  displayed as zero.
- Setup-fee display bug: compare decoded tx actions, decoded `extraInfo`, local
  swap-history context, order detail, and detail UI rows; verify setup costs are
  shown separately and do not inflate the business transfer amount.
- Market K-line bug: verify token detail payload, chart fetch, fallback data, and WebView events separately.
- Handoff bug: start from Earn/Market/Buy, then confirm Swap owns state after quote starts.
