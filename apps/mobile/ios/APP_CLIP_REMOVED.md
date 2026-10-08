# App Clip temporarily removed

The `OneKeyAppClip` target was removed to unblock an urgent App Store submission.
This is a temporary state; the feature is meant to come back unchanged.

## What was removed

- `apps/mobile/ios/OneKeyAppClip/` (SwiftUI sources, `Info.plist`, entitlements,
  `PrivacyInfo.xcprivacy`, `Localizable.xcstrings`, feature README)
- The `OneKeyAppClip` native target, its build configurations, build phases and the
  parent app's `Embed App Clips` copy phase and target dependency in `project.pbxproj`
- The shared `OneKeyAppClip` scheme
- `appclips:` associated domains and `com.apple.developer.associated-appclip-app-identifiers`
  in `OneKeyWallet/OneKeyWallet.entitlements`
- App Clip provisioning profile and `Info.plist` version-stamping steps in
  `.github/workflows/release-ios.yml`

## What was intentionally kept

- `SharedAppClipAttribution/AppClipAttributionStore.swift` and
  `OneKeyWallet/AppClipAttributionModule.swift` / `.m` — still compiled into the main app
- The `group.so.onekey.wallet` App Group entitlement, used by the module above
- All JS-side handling (`/clip/*` deep links, `installAttribution.ios.ts`, the campaign
  WebView host allowlist). It is inert without the App Clip: `installAttribution.ios.ts`
  returns early when `NativeModules.AppClipAttribution` is missing, and the deep-link
  branches are only reachable from an App Clip handoff.
- `apps/web/validation/deeplink.ios.json` — the AASA payload still advertises the App Clip.
  Harmless with no App Clip shipped, and it must stay in place for the restore.

## How to restore

```sh
git revert $(git log --format=%H --diff-filter=A -1 -- apps/mobile/ios/APP_CLIP_REMOVED.md)
```

That restores every file and `project.pbxproj` object above, including this note.
Before the next store build after restoring, re-check in App Store Connect that the
App Clip experiences for `/clip/market` and the approved `/clip/web` campaign URLs are
still configured, and that `ADHOC_APP_CLIP_PROFILE` / `APPSTORE_APP_CLIP_PROFILE` are
still valid — see the release checklist in `OneKeyAppClip/README.md`.
