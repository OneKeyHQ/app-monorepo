// Single source of truth for the dev-only gate that decides whether this
// desktop build + runtime may serve the experimental Native Messaging host.
// It is dev-only on two axes that must agree, or a stale/broken host
// registration gets left in the real browser's NativeMessagingHosts dir:
//
//  - build (process.env.NODE_ENV, substituted by esbuild at build time): the
//    production appBootstrap branch dead-code-eliminates the host entry, so a
//    production bundle can never actually serve the host — not even an
//    unpackaged `electron app/dist/app.js` smoke / bench run (where
//    process.defaultApp is true). Registering from such a run would point the
//    browser at a host that just exits.
//  - runtime (process.defaultApp): only a genuine unpackaged/dev run should
//    register or run the host. OneKey's dev desktop reports app.isPackaged ===
//    true even when launched unpackaged via `electron <script>`, so
//    process.defaultApp is the reliable "interactive dev run" signal.
//
// Used by both the manifest install gate (nativeMessagingHostInstall.ts) and the
// host runtime guard (nativeMessagingHost.ts) so the two can never drift.
// appBootstrap.ts mirrors the NODE_ENV clause inline because esbuild needs a literal
// there to eliminate the host import from production bundles.
export function isDesktopNativeMessagingHostServiceable(): boolean {
  return process.env.NODE_ENV !== 'production' && process.defaultApp === true;
}
