# Onramper Headless SDK — native activation

The **JS side is already wired**: the dep is declared, `realClient.native.ts`
adapts the real SDK, and `createOnramperClient()` returns the real client on a
real device / the mock on the Simulator (no App Attest there). What's left is the
native install + a couple of values, all below.

Package: **`@onramper/onramper-react-native@1.1.0`** (already in
`apps/mobile/package.json`).

## ⚠️ nitro bump — verify the OneKey Nitro modules

`@onramper/onramper-react-native@1.1.0` peers: react ≥19 ✅, react-native ≥0.79 ✅,
react-native-nitro-modules ≥0.35.0. Already bumped **0.33.2 → 0.36.1** (latest
stable; 0.35.x only ships a beta) in `apps/mobile/package.json`.

That nitro version is shared by the OneKey Nitro modules
(`@onekeyfe/react-native-{keychain-module,cloud-kit-module,device-utils,perp-depth-bar}`,
pinned at 3.0.78, generated against nitro 0.33.2). **The native team must rebuild /
re-verify those after `pod install`** — a nitro minor bump can change the
nitrogen-generated native interface, so those modules may need versions built
against 0.36.x. If the iOS native build fails on one of them, this is why.

## Steps

1. **Install JS deps** (dep already declared):
   ```bash
   yarn
   ```
2. **nitro** is already bumped to `0.36.1` (only in `apps/mobile/package.json`;
   no `resolutions`). After `pod install`, confirm the 4 `@onekeyfe` Nitro modules
   still build (see the nitro note above) — rebuild them against 0.36.x if not.
3. **Delete the type shim** — `packages/shared/src/modules3rdParty/onramper/onramper-sdk.d.ts`.
   It only exists so the repo type-checks before install; the real package ships
   its own types and will conflict with it.
4. **Pod install**:
   ```bash
   cd apps/mobile/ios && pod install
   ```
   Commit the `Podfile.lock` diff (an autolinked `OnramperReactNative` pod +
   `NitroModules` dependency).
5. **App Attest entitlement** on the iOS app target (Xcode → Signing &
   Capabilities → App Attest, or add the entitlement):
   ```xml
   <key>com.apple.developer.devicecheck.appattest-environment</key>
   <string>production</string>
   ```
6. **Fill the credentials** in `realClient.native.ts` → `ONRAMPER_CLIENT_ID`
   and `ONRAMPER_API_KEY`. Verified against SDK 1.1.0: `configure()` requires
   BOTH — `apiKey` is the *publishable* `pk_...` key (the hosted widget embeds
   the same key in its URL), not the backend partner secret. `environment`
   only accepts `'development' | 'production'` (anything else is coerced to
   production on the Swift side).
7. **Verify the SDK surface** against the installed types
   (`node_modules/@onramper/onramper-react-native/lib/typescript/...`): confirm
   the `OnramperClient` export name + method signatures in `realClient.native.ts`,
   and adjust `type.ts`'s `IOnramperQuote` / `IOnramperCheckoutRequest` to the
   real shapes (plan open question #3). Set `ONRAMPER_MIN_IOS` in `index.native.ts`
   to the SDK's real minimum.

## Verify (real device)

- A token with `headlessSupported: true` (backend flag) routes to the native page;
  the **real Apple Pay button** renders; the real quote/ETA fill in.
- Tap → ToS → (login) → Apple Pay sheet → `completed` closes the modal + toast.
- Non-USD / unsupported / structural failure → web-widget fallback.
- To reach the page before the backend flag is live, use the Developer Gallery
  "Headless Buy (mock)" entry (it bypasses the flag; on device it uses the real
  client since `ExpoDevice.isDevice` is true).

CI / e2e (no device) keep running the mock — real-SDK e2e must be a device-only job.
