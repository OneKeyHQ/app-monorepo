# Testing and Review

## Existing Tests

Start from `ServiceDiscovery.test.ts`, `useSearchModalData.test.tsx`, `searchResultRanking.test.ts`, `bitrefillHandler.test.ts`, and `bitrefillUtils.test.ts`.

## What to Test

- URL handling: normal URL, invalid protocol, punycode, deep link, phishing redirect, popup.
- Tab state: add, switch, close, close all, reopen, pin/unpin, desktop top ordering.
- Persistence: initial rebuild lock, SimpleDB writes, bookmark cloud-sync skip flags, history de-duplication.
- Search: local bookmark/history ranking, remote-search skip threshold, trending merge, match highlighting.
- DApp connection: connect, disconnect, same-origin navigation, notification throttling, WalletConnect vs injected.
- Platform-specific behavior: native Discovery tab and desktop MultiTabBrowser; check extension/web fallback only when touched.

## Commands

- Prefer targeted Jest for changed test files, for example:
  - `npx jest packages/kit-bg/src/services/ServiceDiscovery.test.ts`
  - `npx jest packages/kit/src/views/Discovery/utils/searchResultRanking.test.ts`
  - `npx jest packages/kit/src/views/Discovery/hooks/useSearchModalData.test.tsx`
- For broader validation, use the repo's lint/type/test commands from `/1k-dev-commands`.

## Manual QA Checklist

- Opening from dashboard/search/bookmark/history lands on the expected platform tab.
- Native browser home/dashboard transitions do not leave the bottom tab bar hidden.
- Android hardware back goes back inside the active webview before returning to browser home.
- Desktop tab close releases its webview ref and keeps other tabs' session data.
- DApp account/network changes notify the active origin once and avoid duplicate spam.
- Blocked URL view can close the tab and recover navigation state.
- Bookmarks refresh after add/remove/rename/sort and remain cloud-sync compatible.

## Analytics

- Browser events live in `packages/shared/src/logger/scopes/discovery/scenes/browser.ts`.
- DApp events live in `packages/shared/src/logger/scopes/discovery/scenes/dapp.ts`.
- Bitrefill local diagnostics live in `scenes/bitrefill.ts`.
- When adding server analytics, use `/1k-analytics` and keep event payloads free of secrets or large request bodies.

## Review Risks

- Import hierarchy violations: `kit-bg` must not import from `kit` UI or `components`.
- WebView remount regressions: broad `useMemo` dependencies can recreate webviews and lose DApp state.
- URL validation bypass: every route to arbitrary URL loading must pass validation.
- State mutation drift: direct tab array mutation must still end through `buildWebTabs` so maps and SimpleDB stay synced.
- Race conditions: modal dismiss, tab switch, and URL open should be serialized like `handleOpenWebSite`.
