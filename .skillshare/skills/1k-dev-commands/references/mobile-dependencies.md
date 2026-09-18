# Mobile Dependency Setup

- **CocoaPods**: Align `pod --version` with the committed `COCOAPODS` field in
  `apps/mobile/ios/Podfile.lock` and `.github/workflows/mobile-dev-shell-ios-simulator.yml`.
  Upgrade through the existing package manager and verify the version afterward.
- **Pods only**: Run `yarn app:ios:pod-install`, check the lockfile diff, and stop
  after installation. Do not manually change the lockfile's CocoaPods version.
- **Missing `injectedNative.js.txt`**: With JS dependencies installed, run
  `yarn copy:inject` to restore the generated asset, then retry the bundle command.
