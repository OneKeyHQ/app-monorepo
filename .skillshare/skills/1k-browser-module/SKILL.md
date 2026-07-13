---
name: 1k-browser-module
description: OneKey Browser/Discovery module development guide. Use when changing 浏览器模块, Discovery browser, MultiTabBrowser, DApp browser, WebView tabs, bookmarks, history, browser search, URL risk detection, DApp connection, JSBridge, or in-app browser behavior.
allowed-tools: Read, Grep, Glob
---

# Browser Module

Use this for desktop/mobile Discovery Browser and MultiTabBrowser work: WebView lifecycle, DApp connections, bookmarks/history, search, URL validation, and analytics.

## Quick Reference

| Topic | Guide | Key Files |
|-------|-------|-----------|
| Module map | [module-map.md](references/rules/module-map.md) | `packages/kit/src/views/Discovery/`, `packages/kit-bg/src/services/ServiceDiscovery.ts` |
| Tabs and navigation | [tabs-navigation.md](references/rules/tabs-navigation.md) | `packages/kit/src/states/jotai/contexts/discovery/` |
| WebView and security | [webview-security.md](references/rules/webview-security.md) | `packages/kit/src/views/Discovery/components/WebContent/` |
| DApp connection | [dapp-connection.md](references/rules/dapp-connection.md) | `packages/kit-bg/src/services/ServiceDApp.ts`, `packages/kit/src/views/DAppConnection/` |
| Data, search, bookmarks | [data-search-bookmarks.md](references/rules/data-search-bookmarks.md) | `ServiceDiscovery.ts`, `useSearchModalData.ts`, SimpleDB browser entities |
| Testing and review | [testing-review.md](references/rules/testing-review.md) | `*.test.ts`, `*.test.tsx`, discovery logger scenes |

## Default Workflow

1. Identify the enabled platform surface: native mobile Discovery tab or desktop MultiTabBrowser.
2. Read [module-map.md](references/rules/module-map.md), then open only the rule file matching the requested change.
3. Trace state through `useBrowserTabActions`, `useBrowserAction`, and `ServiceDiscovery` before UI edits.
4. Preserve platform-specific files: `.native.tsx`, `.desktop.tsx`, `.ext.tsx`, and unsuffixed fallbacks have different behavior.
5. Treat extension/web paths as fallback or shared infrastructure unless the request explicitly enables browser behavior there.
6. Verify URL validation, deep link handling, DApp provider notifications, and persisted SimpleDB data are still coherent.

## Hard Rules

- Do not bypass `uriUtils.validateUrl`, `parseDappRedirect`, `validateWebviewSrc`, or deep link handling when loading arbitrary URLs.
- Do not mutate tabs without `buildWebTabs`/`setWebTabData`; persistence and active-tab maps depend on that path.
- Do not clear shared Electron webview session cache from per-tab cleanup; webviews share `partition="persist:onekey"`.
- Do not pass secrets, raw clipboard text, or unbounded payloads through modal params or `defaultLogger`.
- For analytics changes, also use `/1k-analytics`.

## Related Skills

- `/1k-cross-platform` - Platform suffixes.
- `/1k-state-management` - Jotai atoms.
- `/1k-feature-guides` - Routes/modals.
- `/1k-i18n` - Translations.
- `/1k-analytics` - Discovery logging.
- `/1k-performance` - WebView/tab/list performance.
