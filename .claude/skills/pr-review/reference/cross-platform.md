# Cross-platform pitfalls

## Extension
- MV3 service worker lifecycle: avoid relying on long-lived state
- CSP restrictions: no eval/dynamic script injection
- Permissions: least-privilege; validate host permissions

## Mobile (RN)
- Background/foreground transitions; async storage consistency
- Secure storage usage for secrets
- WebView security: origin isolation, message bridge validation

## Desktop (Electron)
- IPC validation; avoid exposing privileged APIs to renderer
- Hardening: nodeIntegration off unless justified; contextIsolation on

## Web
- XSS, CSP, CORS, storage leakage
- Bundle/runtime differences vs RN/Electron
