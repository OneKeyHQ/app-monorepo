# WebView and Security

## WebView Layers

- Browser content: `packages/kit/src/views/Discovery/components/WebContent/`.
- Shared wrapper: `packages/kit/src/components/WebView/index.tsx`.
- Native/desktop details: `InpageProviderWebView.native.tsx`, `NativeWebView.tsx`, `InpageProviderWebView.desktop.tsx`, `DesktopWebView.tsx`.

## Ref Management

- Runtime webview refs are stored in `webviewRefs` from `utils/explorerUtils.ts`.
- `WebContent` sets `refReady: true` when a ref first arrives.
- Always delete `webviewRefs[tabId]` when closing/removing a tab.
- Native screenshot refs are stored in `captureViewRefs`.

## URL Validation

- Use `validateWebviewSrc` before loading or opening untrusted URLs.
- `validateWebviewSrc` returns `Valid`, `ValidDeeplink`, `InvalidUrl`, `NotSupportProtocol`, or `InvalidPunycode`.
- `ValidDeeplink` should call `handleDeepLinkUrl` and prevent WebView navigation.
- Invalid or unsupported URLs should show `BlockAccessView` and offer close behavior.
- URL rejection should log through `defaultLogger.discovery.browser.logRejectUrl`.

## Native WebView

- `WebContent.native.tsx` handles navigation state, progress bar, `onShouldStartLoadWithRequest`, `onOpenWindow`, pull-to-refresh, native back handling, and `BlockAccessView`.
- Native `onLoadEnd` calls translation navigation end and injects Bitrefill bridge when needed.
- Avoid crashing older devices when injecting JS: keep `injectJavaScript` in `try/catch`.
- Android back should prefer webview `goBack()` when the active tab can go back; otherwise return to Discovery home.

## Desktop WebView

- `WebContent.desktop.tsx` listens to Electron load, navigation, title, favicon, and DOM-ready events.
- Keep the `webview` `useMemo` dependencies narrow. Adding `url` can recreate Electron webviews and wipe in-flight DApp state.
- Use `latestUrlRef` if a callback needs the newest URL without invalidating the WebView element.
- Desktop `onDomReady` is the right time for JS bridge injection that depends on DOM readiness.

## Cleanup Rules

- Desktop tab unmount should stop timers/media/devtools/history and remove refs.
- Do not call shared session cache/storage clearing from per-tab cleanup; all Electron webviews share the same persistent session.
- Full cache clearing belongs in `ServiceDiscovery.clearCache()`.
- Pausing inactive DApps should use `pauseDappInteraction`/`resumeDappInteraction`, which disables JSBridge messages and temporarily patches `WebSocket.prototype.send`.

## Browser-Initiated Windows

- Native `onOpenWindow` validates `targetUrl`; deep links are handled externally and valid URLs go through `gotoSite`.
- Desktop uses `allowpopups` and Electron event handling in the shared WebView implementation.
- Do not let popup URLs bypass phishing, punycode, protocol, or deep-link checks.
