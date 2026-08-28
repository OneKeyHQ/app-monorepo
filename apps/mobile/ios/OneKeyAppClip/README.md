# OneKey App Clip

This target is a small, native SwiftUI experience. It deliberately does not link React Native,
Hermes, CocoaPods, wallet services, authentication, or wallet JSBridge code.

## Invocation URLs

- Market: `https://app.onekey.so/clip/market`
- Market detail handoff: append `network`, `address`, and optional `is_native`
- Campaign WebView: `https://app.onekey.so/clip/web?web_url=<encoded OneKey HTTPS URL>`
- Test host: replace `app.onekey.so` with `app.onekeytest.com`

Supported attribution query parameters are `click_id`, `campaign_id`, and the standard
`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_id`, and `utm_term` fields.
The Short Link destination must use `direct_query` so `click_id` reaches the invocation URL.

Campaign WebViews only load HTTPS pages on `app.onekey.so` or `app.onekeytest.com`, use an
ephemeral data store, and expose no wallet bridge. Add new campaign hosts only after a security
review, then update both `CampaignURLPolicy` and `WKAppBoundDomains`.

## Attribution handoff

1. Utility Short Link creates a 22-character `click_id` and stores an immutable UTM snapshot.
2. The App Clip writes the invocation data to the shared `group.so.onekey.wallet` container before
   reporting any interaction.
3. The App Clip reports `open`, `market_select`, and `install_cta` lifecycle events to Utility.
4. The install CTA first tries the validated `onekey-wallet://app-clip` custom-scheme handoff. An
   installed full app opens the selected existing market detail route (or the approved campaign
   WebView); otherwise StoreKit presents the corresponding full-app download overlay.
5. On first full-app startup or a validated App Clip warm handoff, the iOS main JS runtime reads the
   shared record and claims the server-side snapshot.
6. The full app logs the merged attribution once and clears the shared record only after success.

The iOS background JS runtime never reads or clears this record. The App Group is the shared native
resource; App Clip and full app remain separate processes with separate heaps.

## Local verification

Select the `OneKeyAppClip` scheme and set `_XCAppClipURL` in its Run action, or run:

```sh
xcodebuild -project apps/mobile/ios/OneKeyWallet.xcodeproj \
  -scheme OneKeyAppClip -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Use Xcode's App Clip local experience override to verify invocation payload delivery. A direct
`simctl launch` is useful for visual checks but does not reproduce the system App Clip card.

## Release checklist

1. Register `so.onekey.wallet.Clip`, the parent-app association, App Group, and associated domains
   in the Apple Developer portal and regenerate provisioning profiles.
2. Deploy the updated AASA file to both OneKey app domains with `application/json`, no redirect,
   and the App Clip bundle identifier `BVJ3FU5H2K.so.onekey.wallet.Clip`.
3. Configure the default or advanced App Clip experiences in App Store Connect for `/clip/market`
   and approved `/clip/web` campaign URLs, including card image, title, and action metadata.
4. Archive the `OneKeyWallet` app, not the App Clip target by itself, and confirm the archive embeds
   `OneKeyAppClip.app` and stays within Apple's current App Clip size limit.
5. Deploy the Utility attribution endpoints before publishing Short Links that target the App Clip.
6. Test both installed and not-installed paths on a physical device, then confirm claim idempotency,
   analytics delivery, campaign WebView rejection, and post-install deep-link routing.
