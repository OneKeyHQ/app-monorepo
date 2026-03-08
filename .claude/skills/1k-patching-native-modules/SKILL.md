---
name: 1k-patching-native-modules
description: Patches native modules (expo-image, react-native, etc.) to fix native crashes or bugs. 
disable-model-invocation: true
---

# Patching Native Modules

Follow this workflow to analyze crash logs, fix native module bugs, and generate patches.

## Workflow Overview

```
1. Analyze Crash Log → 2. Locate Bug → 3. Fix Code → 4. Clean Build Artifacts → 5. Generate Patch → 6. Commit & PR
```

## Step 1: Analyze Crash Log

### iOS Crash (EXC_BAD_ACCESS / KERN_INVALID_ADDRESS)

Key information to extract:
- **Exception type**: `EXC_BAD_ACCESS`, `SIGABRT`, etc.
- **Stack trace**: Identify the crashing function
- **Memory address**: Helps identify nil pointer issues
- **Library**: Which native module is crashing

Example crash pattern:
```
EXC_BAD_ACCESS: KERN_INVALID_ADDRESS at 0x3c61c1a3b0d0
 objc_msgSend in unknown file
 -[SDWebImageManager cacheKeyForURL:context:]  ← Crashing function
 -[SDWebImageManager loadImageWithURL:options:context:progress:completed:]
```

### Android Crash (NullPointerException / OOM)

Look for:
- **Exception class**: `NullPointerException`, `OutOfMemoryError`
- **Stack trace**: Java/Kotlin method chain
- **Thread info**: Main thread vs background

## Step 2: Locate the Bug

### Find native module source

```bash
# iOS (Swift/Objective-C)
ls node_modules/<package>/ios/

# Android (Kotlin/Java)
ls node_modules/<package>/android/src/main/java/
```

### Common crash causes

| Crash Type | Common Cause | Fix Pattern |
|------------|--------------|-------------|
| `EXC_BAD_ACCESS` | Nil pointer dereference | Add `guard let` check |
| `KERN_INVALID_ADDRESS` | Accessing deallocated memory | Use weak references |
| `NullPointerException` | Null object access | Add null check |
| `OutOfMemoryError` | Large image/data processing | Add size limits |

## Step 3: Fix the Code

### iOS (Swift) - Nil Check Pattern

```swift
// Before (crashes when uri is nil)
imageManager.loadImage(with: source.uri, ...)

// After (safe)
guard let sourceUri = source.uri, !sourceUri.absoluteString.isEmpty else {
  onError(["error": "Image source URI is nil or empty"])
  return
}
imageManager.loadImage(with: sourceUri, ...)
```

### Android (Kotlin) - Null Check Pattern

```kotlin
// Before
val uri = source.uri
loadImage(uri)

// After
val uri = source.uri ?: return
if (uri.toString().isEmpty()) return
loadImage(uri)
```

## Step 4: Clean Build Artifacts (CRITICAL)

**Before generating patch, MUST clean Android build cache:**

```bash
# Remove Android build artifacts to avoid polluting the patch
rm -rf node_modules/<package>/android/build

# For expo-image specifically:
rm -rf node_modules/expo-image/android/build
```

Why this matters:
- Android build generates `.class`, `.jar`, binary files
- These pollute the patch file (can grow to 5000+ lines)
- patch-package will include these unwanted files

## Step 5: Generate Patch

```bash
# Generate patch file
npx patch-package <package-name>

# Example:
npx patch-package expo-image
```

Patch file location: `patches/<package-name>+<version>.patch`

### Verify patch content

```bash
# Check patch doesn't include unwanted files
grep -c "android/build" patches/<package-name>*.patch
# Should return 0

# View actual changes
head -100 patches/<package-name>*.patch
```

## Step 6: Commit & Create PR

```bash
# Stage patch file
git add patches/<package-name>*.patch

# Commit with descriptive message
git commit -m "fix(ios): prevent EXC_BAD_ACCESS crash in <package> when <condition>

Add guard checks in <package> native layer to prevent crash when <scenario>.

Fixes Sentry issue #XXXXX"

# Create PR
gh pr create --title "fix(ios): <description>" --base x
```

## Common Packages & Their Native Locations

| Package | iOS Source | Android Source |
|---------|------------|----------------|
| `expo-image` | `node_modules/expo-image/ios/` | `node_modules/expo-image/android/src/` |
| `react-native` | `node_modules/react-native/React/` | `node_modules/react-native/ReactAndroid/` |
| `@react-native-async-storage/async-storage` | `node_modules/@react-native-async-storage/async-storage/ios/` | `...android/src/` |
| `react-native-reanimated` | `node_modules/react-native-reanimated/ios/` | `...android/src/` |

## Existing Patches Reference

Check existing patches for patterns:
```bash
ls patches/
cat patches/expo-image+3.0.10.patch
```

## Troubleshooting

### Patch file too large

```bash
# Clean all build artifacts
rm -rf node_modules/<package>/android/build
rm -rf node_modules/<package>/ios/build
rm -rf node_modules/<package>/.gradle

# Regenerate
npx patch-package <package>
```

### Patch not applying

```bash
# Check package version matches
cat node_modules/<package>/package.json | grep version

# Rename patch if version changed
mv patches/<package>+old.patch patches/<package>+new.patch
```

### Swift/Kotlin syntax help

**Swift guard let:**
```swift
guard let value = optionalValue else {
  return  // Must exit scope
}
// value is now non-optional
```

**Kotlin null check:**
```kotlin
val value = nullableValue ?: return
// value is now non-null
```

## Related Files

- Patches directory: `patches/`
- expo-image iOS: `node_modules/expo-image/ios/ImageView.swift`
- expo-image Android: `node_modules/expo-image/android/src/main/java/expo/modules/image/`
