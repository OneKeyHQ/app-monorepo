---
name: 1k-platform-requirements
description: Documents minimum SDK/OS version requirements for all OneKey platforms. Use when checking platform compatibility, understanding deployment targets, verifying version requirements, or when user asks if their device can run the project. Triggers on minimum version, SDK version, API level, deployment target, platform requirements, iOS version, Android version, Chrome version, Electron version, can I run, environment check, device compatibility, check environment.
allowed-tools: Read, Grep, Glob, Bash
---

# OneKey Platform Requirements

## Device Compatibility Check

When user asks if their device can run app-monorepo, run the environment check to verify all required tools are installed with correct versions.

**Important**: Xcode, CocoaPods, and Ruby are **macOS only** tools required for iOS development. On non-macOS systems, skip these checks.

### Auto-detect and Check Environment

First, detect the operating system:
```bash
uname -s
```

- If output is `Darwin` → macOS, check ALL tools including Xcode/CocoaPods
- If output is `Linux` or other → Skip Xcode/CocoaPods/Ruby checks

## Development Environment Requirements

| Tool | Required Version | How to Check | Platform |
|------|-----------------|--------------|----------|
| **Node.js** | >=22 | `node -v` | All |
| **Yarn** | 4.12.0 | `yarn -v` | All |
| **Java/JDK** | 17+ | `java -version` | All |
| **Gradle** | 8.13 | `./gradlew --version` | All |
| **Go** | 1.24.0 | `go version` | All |
| **Ruby** | 2.7+ (recommended 3.x) | `ruby -v` | macOS only |
| **CocoaPods** | 1.16.2 | `pod --version` | macOS only |
| **Xcode** | 26.2 | `xcodebuild -version` | macOS only |
| **Android Studio** | Ladybug (2024.2.1)+ | Android Studio > About | All |

## Minimum Platform Version Summary

| Platform | Minimum Version | Notes |
|----------|----------------|-------|
| **Android** | API 24 (Android 7.0 Nougat) | Set by Expo SDK |
| **iOS** | 15.5 | Deployment target |
| **Chrome Extension** | Chrome 111+ | Required for MAIN world injection |
| **Firefox Extension** | Latest stable | Follows Chrome manifest v2 |
| **Desktop (Electron)** | Electron 39.x | See OS requirements below |
| **macOS** | 10.15+ (Catalina) | Electron 39 requirement |
| **Windows** | Windows 10+ | Electron 39 requirement |
| **Linux** | Ubuntu 20.04+ | Electron 39 requirement |

## How to Verify/Update Versions

### Android minSdkVersion

**Location**: Set by Expo, referenced in `apps/mobile/android/app/build.gradle:142`

**How to check current value**:
```bash
cd apps/mobile/android && ./gradlew -q properties 2>&1 | grep -i "minSdk"
```

**Configuration chain**:
1. `apps/mobile/android/app/build.gradle` references `rootProject.ext.minSdkVersion`
2. Value set by `expo-modules-autolinking` in `ExpoRootProjectPlugin.kt`
3. Default is 24 unless overridden in expo version catalog

### iOS Deployment Target

**Location**: `apps/mobile/ios/Podfile:18`

**How to check**:
```bash
grep "platform :ios" apps/mobile/ios/Podfile
```

**Configuration**:
```ruby
platform :ios, podfile_properties['ios.deploymentTarget'] || '15.5'
```

Can also verify in Xcode project:
```bash
grep "IPHONEOS_DEPLOYMENT_TARGET" apps/mobile/ios/OneKeyWallet.xcodeproj/project.pbxproj | head -5
```

### Chrome Extension Minimum Version

**Location**: `apps/ext/src/manifest/chrome_v3.js:9`

**How to check**:
```bash
grep "minimum_chrome_version" apps/ext/src/manifest/chrome_v3.js
```

**Note**: Version 111+ is required for MAIN world content script injection (manifest v3 feature).

### Firefox Extension

**Location**: `apps/ext/src/manifest/firefox.js`

Firefox manifest extends Chrome manifest but may have different requirements. Currently follows Chrome manifest v2 patterns.

### Desktop (Electron) Version

**Location**: `apps/desktop/package.json`

**How to check**:
```bash
grep '"electron":' apps/desktop/package.json
```

**Current version**: Electron 39.3.0

**Electron 39 OS Requirements**:
- macOS: 10.15+ (Catalina)
- Windows: Windows 10+
- Linux: Ubuntu 20.04+, Fedora 32+, Debian 10+

**Reference**: Check Electron releases for OS compatibility at https://releases.electronjs.org/

## Full SDK Version Check Command

Run this to see all Android SDK versions at once:
```bash
cd apps/mobile/android && ./gradlew -q --no-configuration-cache properties 2>&1 | grep -E "(minSdk|compileSdk|targetSdk|buildTools|ndk|kotlin):"
```

Expected output format:
```
- buildTools:  36.0.0
- minSdk:      24
- compileSdk:  36
- targetSdk:   36
- ndk:         27.1.12297006
- kotlin:      2.1.20
```

## Version Update Considerations

When updating minimum versions:

1. **Android**: Expo SDK updates may change minSdkVersion. Check Expo release notes.
2. **iOS**: Update both Podfile and Xcode project settings.
3. **Extension**: manifest changes affect all Chromium browsers (Chrome, Edge, Brave, Opera).
4. **Electron**: Major version bumps may drop OS support. Check Electron release notes.

## Development Environment Details

### Node.js

**Required**: >=22

**Location**: `package.json:10-12`

**How to check configuration**:
```bash
grep -A2 '"engines"' package.json
```

**Configuration**:
```json
"engines": {
  "node": ">=22"
}
```

### Yarn

**Required**: 4.12.0 (Yarn Berry / Yarn 4)

**Location**: `package.json:3`

**How to check configuration**:
```bash
grep '"packageManager"' package.json
```

**Configuration**:
```json
"packageManager": "yarn@4.12.0"
```

### Java/JDK

**Required**: JDK 17+

**Why**: Gradle 8.13 requires Java 17+. The project uses `jvmTarget = "17"` for Kotlin compilation.

**Location**: `apps/mobile/android/build.gradle:101`

**How to check configuration**:
```bash
grep "jvmTarget" apps/mobile/android/build.gradle
```

### Gradle

**Required**: 8.13

**Location**: `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties:3`

**How to check configuration**:
```bash
grep "distributionUrl" apps/mobile/android/gradle/wrapper/gradle-wrapper.properties
```

**Configuration**:
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
```

### Ruby (macOS only)

**Required**: 2.7+ (recommended 3.x for Apple Silicon)

**Platform**: macOS only - required for iOS development

**Why**: Required for CocoaPods and iOS build tooling.

**How to check**:
```bash
ruby -v
```

**Note**: On macOS, system Ruby may be outdated. Use rbenv or rvm to manage Ruby versions.

### CocoaPods (macOS only)

**Required**: 1.16.2

**Platform**: macOS only - required for iOS development

**Location**: `apps/mobile/ios/Podfile.lock` (last line)

**How to check configuration**:
```bash
tail -1 apps/mobile/ios/Podfile.lock
```

**How to install**:
```bash
gem install cocoapods -v 1.16.2
```

### Go

**Required**: 1.24.0

**Why**: Required for compiling gopenpgp cryptographic library on iOS.

**Location**: `apps/mobile/ios/Podfile:33`

**How to check configuration**:
```bash
grep "go_version = " apps/mobile/ios/Podfile
```

**Note**: Go is auto-installed by Podfile if not present. The gopenpgp XCFramework is pre-built and cached in `apps/mobile/ios/XCFrameworks/`.

### Xcode (macOS only)

**Required**: 26.2

**Platform**: macOS only - required for iOS development

**Why**: Required for building iOS app with latest SDK features and deployment target.

**How to check**:
```bash
xcodebuild -version
```

**Note**: Xcode version determines available iOS SDKs and simulator versions.

### Android Studio

**Required**: Ladybug (2024.2.1) or later

**Why**: compileSdk 36 requires Android Studio with SDK 36 support.

**How to check**: Android Studio > About Android Studio

**Required components**:
- Android SDK Platform 36
- Android SDK Build-Tools 36.0.0
- NDK 27.1.12297006
- CMake (for native modules)

## Quick Environment Check Script

### For macOS (Full check including iOS tools)
```bash
echo "=== Development Environment Check (macOS) ===" && \
echo "OS: $(uname -s) $(uname -r)" && \
echo "Node.js: $(node -v 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Yarn: $(yarn -v 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Java: $(java -version 2>&1 | head -1 || echo 'NOT INSTALLED')" && \
echo "Go: $(go version 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Ruby: $(ruby -v 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "CocoaPods: $(pod --version 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Xcode: $(xcodebuild -version 2>/dev/null | head -1 || echo 'NOT INSTALLED')" && \
echo "Gradle (configured): $(grep 'distributionUrl' apps/mobile/android/gradle/wrapper/gradle-wrapper.properties 2>/dev/null | sed 's/.*gradle-\(.*\)-bin.zip/\1/' || echo 'N/A')"
```

### For Linux/Windows (Skip iOS-only tools)
```bash
echo "=== Development Environment Check (Non-macOS) ===" && \
echo "OS: $(uname -s) $(uname -r)" && \
echo "Node.js: $(node -v 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Yarn: $(yarn -v 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Java: $(java -version 2>&1 | head -1 || echo 'NOT INSTALLED')" && \
echo "Go: $(go version 2>/dev/null || echo 'NOT INSTALLED')" && \
echo "Gradle (configured): $(grep 'distributionUrl' apps/mobile/android/gradle/wrapper/gradle-wrapper.properties 2>/dev/null | sed 's/.*gradle-\(.*\)-bin.zip/\1/' || echo 'N/A')" && \
echo "" && \
echo "Note: Xcode, CocoaPods, Ruby are macOS-only (required for iOS development)"
```

### Smart Check (Auto-detect OS)
```bash
if [ "$(uname -s)" = "Darwin" ]; then
  echo "=== macOS Detected - Full Environment Check ===" && \
  echo "Node.js: $(node -v 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Yarn: $(yarn -v 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Java: $(java -version 2>&1 | head -1 || echo 'NOT INSTALLED')" && \
  echo "Go: $(go version 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Ruby: $(ruby -v 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "CocoaPods: $(pod --version 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Xcode: $(xcodebuild -version 2>/dev/null | head -1 || echo 'NOT INSTALLED')"
else
  echo "=== Non-macOS Detected - Partial Check ===" && \
  echo "Node.js: $(node -v 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Yarn: $(yarn -v 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Java: $(java -version 2>&1 | head -1 || echo 'NOT INSTALLED')" && \
  echo "Go: $(go version 2>/dev/null || echo 'NOT INSTALLED')" && \
  echo "Note: iOS development requires macOS with Xcode, CocoaPods, Ruby"
fi
```

## Related Files

- Node/Yarn: [package.json](package.json)
- Android: [apps/mobile/android/app/build.gradle](apps/mobile/android/app/build.gradle)
- Android: [apps/mobile/android/gradle.properties](apps/mobile/android/gradle.properties)
- Gradle: [apps/mobile/android/gradle/wrapper/gradle-wrapper.properties](apps/mobile/android/gradle/wrapper/gradle-wrapper.properties)
- iOS: [apps/mobile/ios/Podfile](apps/mobile/ios/Podfile)
- iOS: [apps/mobile/ios/Podfile.lock](apps/mobile/ios/Podfile.lock)
- iOS XCFrameworks: [apps/mobile/ios/XCFrameworks/](apps/mobile/ios/XCFrameworks/)
- Extension: [apps/ext/src/manifest/chrome_v3.js](apps/ext/src/manifest/chrome_v3.js)
- Desktop: [apps/desktop/package.json](apps/desktop/package.json)
- Desktop: [apps/desktop/electron-builder.config.js](apps/desktop/electron-builder.config.js)
