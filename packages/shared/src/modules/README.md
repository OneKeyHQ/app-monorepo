# LaunchOptionsManager

A React Native module that provides access to iOS app launch options from JavaScript.

## Overview

The `LaunchOptionsManager` allows you to access the launch options that were passed to the iOS app when it was started. This is useful for handling:

- Deep links (URL schemes)
- Push notifications
- Local notifications
- Universal links
- Other launch scenarios

## Files

- `LaunchOptionsManager.ts` - Main module with singleton pattern
- `LaunchOptionsManager.native.ts` - Native iOS implementation
- `LaunchOptionsManager.web.ts` - Web platform stub (returns null)
- `LaunchOptionsManager.desktop.ts` - Desktop platform stub (returns null)
- `LaunchOptionsManager.example.ts` - Usage examples

## Native iOS Files

- `LaunchOptionsManager.h` - Objective-C header
- `LaunchOptionsManager.m` - Objective-C implementation
- `OneKeyWallet-Bridging-Header.h` - Updated to expose the module to Swift

## Usage

```typescript
import { launchOptionsManager } from '@onekeyhq/shared/src/modules/LaunchOptionsManager';

// Get launch options (async)
const launchOptions = await launchOptionsManager.getLaunchOptions();

// Get cached launch options (sync)
const cachedOptions = launchOptionsManager.getCachedLaunchOptions();

// Initialize and get launch options in one call
const options = await launchOptionsManager.initializeAndGetLaunchOptions();

// Clear stored launch options
await launchOptionsManager.clearLaunchOptions();

// Check if initialized
const isInitialized = launchOptionsManager.isLaunchOptionsInitialized();
```

## Launch Options Keys

Common iOS launch option keys include:

- `UIApplicationLaunchOptionsURLKey` - URL scheme launch
- `UIApplicationLaunchOptionsRemoteNotificationKey` - Push notification launch
- `UIApplicationLaunchOptionsLocalNotificationKey` - Local notification launch
- `UIApplicationLaunchOptionsUserActivityTypeKey` - Universal link launch

## Platform Support

- ✅ iOS - Full support
- ❌ Android - Not supported (returns null)
- ❌ Web - Not supported (returns null)
- ❌ Desktop - Not supported (returns null)

## Integration

The module is automatically integrated into the iOS app through:

1. `AppDelegate.swift` - Saves launch options when app starts
2. `LaunchOptionsManager` native module - Provides bridge to JavaScript
3. Bridging header - Exposes Objective-C module to Swift

## Example

See `LaunchOptionsManager.example.ts` for detailed usage examples.
