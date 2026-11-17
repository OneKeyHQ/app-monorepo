# RevenueCat for macOS Electron

The Electron main process owns one RevenueCat SDK instance. A Node-API addon
calls the Swift SDK on the macOS main queue and resolves promises through a
thread-safe callback. No helper app, receipt parser, payment server, or direct
Electron StoreKit transaction implementation is involved.

The module uses the same pinned RevenueCat 5.80.3 and PurchasesHybridCommon
18.21.0 versions as iOS. Hybrid Common supplies the package, customer info,
purchase, eligibility, and error dictionaries used by react-native-purchases.
The committed `Package.resolved` fixes their exact source revisions.

## Prime integration and store configuration

MAS uses the existing `REVENUECAT_API_KEY_APPLE`, OneKey account ID, current
offering, and `Prime` entitlement. The shared store payment hook owns pricing,
trial eligibility, purchase, restore, analytics identity, account guards, and
the existing post-purchase refresh. iOS supplies its React Native SDK adapter;
MAS supplies the desktop IPC adapter. Receipt validation and subscription
webhooks stay in the existing RevenueCat infrastructure.

Both app builds currently declare `so.onekey.wallet`. Before sandbox testing,
confirm in App Store Connect that macOS belongs to the same app record as iOS
and that the existing subscriptions are available to that build. A matching
bundle ID in source alone does not verify the remote store configuration.
RevenueCat supports reusing the Apple configuration for universal purchases;
legacy separate Mac app records require its legacy Mac setup. See
[RevenueCat's Mac configuration guide](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/legacy-mac-apps)
and [Apple's platform setup](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms).

Ship this change with a new MAS native shell. An OTA bundle on an older shell
reports that App Store purchases are unavailable. MAS does not offer a card or
crypto checkout fallback; other desktop distributions keep their Web Billing
flow.

## Build

On macOS with Xcode and the repository's Node dependencies installed:

```sh
yarn workspace @onekeyhq/desktop build:revenuecat:macos
node apps/desktop/scripts/build-revenuecat-macos.js --verify
```

The build compiles both `arm64` and `x86_64`, combines them into universal
`revenuecat.node` and `libOneKeyRevenueCat.dylib`, and verifies both slices. It
uses Node-API 8 and the pinned Electron headers. Source changes invalidate the
build fingerprint checked before MAS packaging. Updating the iOS SDK requires
updating these pins together.

`build:electron:mas` builds this module automatically. Only MAS packaging copies
the module into `Contents/Resources/revenuecat` and the official SDK privacy
bundles into `Contents/Resources`. electron-builder discovers the nested Mach-O
binaries and signs them with the app's MAS signing identity. Local artifacts
use ad hoc signatures only. The SDK and bridge are linked into one dynamic
library; RevenueCat does not require a separately embedded framework.

## API

Load `build/universal/index.js` in development, or
`process.resourcesPath/revenuecat/index.js` in the packaged main process:

```js
const revenueCat = require(nativeDirectory);
await revenueCat.invoke('configure', { apiKey });
await revenueCat.invoke('logIn', { appUserId });
const offerings = await revenueCat.invoke('getOfferings');
```

Supported operations: `configure`, `logIn`, `logOut`, `getAppUserId`,
`getCustomerInfo`, `getOfferings`, `purchasePackage`, `restorePurchases`,
`checkTrialOrIntroductoryPriceEligibility`, `setAttributes`, and `setEmail`.
`configure` is idempotent for the same API key and rejects reconfiguration.
The main-process service validates requests, restricts them to MAS, serializes
identity changes and transactions, and checks the expected App User ID.

The JavaScript wrapper preserves RevenueCat string error codes and
`userCancelled`. IPC callers must carry these fields in an explicit error
envelope because Electron's normal error serialization drops custom fields.
Offerings and purchases use SDK package identifiers and offering context;
the caller cannot supply a price or manufacture a product object.

## Verification

Run the native load/callback smoke test using Electron, without configuring an
account or opening a purchase sheet:

```sh
electron apps/desktop/scripts/smoke-revenuecat-macos.js
```

Use `ONEKEY_REVENUECAT_NATIVE_DIRECTORY` to test the module copied into a
packaged app. Validate the signed MAS app on Apple Silicon and Intel with an
App Store sandbox account: offerings, first purchase, cancellation, pending
purchase, restore, switching OneKey accounts, and subscription status refresh.
The local smoke test validates linking and the asynchronous bridge only.

Official implementation references:

- [RevenueCat package](https://github.com/RevenueCat/purchases-ios-spm/blob/5.80.3/Package.swift)
- [Hybrid Common API](https://github.com/RevenueCat/purchases-hybrid-common/blob/18.21.0/ios/PurchasesHybridCommon/PurchasesHybridCommon/CommonFunctionality.swift)
- [Hybrid Common configuration](https://github.com/RevenueCat/purchases-hybrid-common/blob/18.21.0/ios/PurchasesHybridCommon/PurchasesHybridCommon/Purchases%2BHybridAdditions.swift)
