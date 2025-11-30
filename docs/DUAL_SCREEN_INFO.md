# DualScreenInfo Module Integration Guide

## Overview

The DualScreenInfo module provides a React Native interface for detecting and handling dual-screen and foldable devices. This module is inspired by Microsoft's `react-native-dualscreen` library and provides a Java-based implementation for Android.

## Features

- ✅ Detect if a device is a dual-screen or foldable device
- ✅ Check if the app is currently spanning across screens
- ✅ Get window rectangles for each screen region
- ✅ Get hinge/fold position information
- ✅ Listen to screen spanning state changes in real-time
- ✅ React hooks for easy integration
- ✅ TypeScript support

## Architecture

### Android Native Layer

Located at: `apps/mobile/android/app/src/main/java/so/onekey/app/wallet/dualscreen/`

- **DualScreenInfoModule.java**: Main React Native module implementation
- **DualScreenInfoPackage.java**: React Native package registration
- Uses AndroidX Window Manager library for device detection
- Monitors window layout changes and emits events to JavaScript

### JavaScript/TypeScript Layer

Located at: `packages/shared/src/modules/DualScreenInfo/`

- **index.ts**: Main API exports and wrapper functions
- **useDualScreenInfo.ts**: React hook for easy component integration
- **example.tsx**: Usage examples

## Installation

### 1. Android Dependencies

The required dependencies have been added to `apps/mobile/android/app/build.gradle`:

```gradle
implementation 'androidx.window:window:1.2.0'
implementation 'androidx.window:window-java:1.2.0'
```

### 2. Package Registration

The module is registered in `apps/mobile/android/app/src/main/java/so/onekey/app/wallet/MainApplication.java`:

```java
import so.onekey.app.wallet.dualscreen.DualScreenInfoPackage;

// In getPackages():
packages.add(new DualScreenInfoPackage());
```

## Usage

### Basic Usage with Hook

The easiest way to use the module is with the `useDualScreenInfo` hook:

```typescript
import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';

function MyComponent() {
  const {
    isDualScreenDevice,
    isSpanning,
    windowRects,
    hingeBounds,
    isLoading,
    refresh
  } = useDualScreenInfo();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return (
    <View>
      <Text>Dual-Screen: {isDualScreenDevice ? 'Yes' : 'No'}</Text>
      <Text>Spanning: {isSpanning ? 'Yes' : 'No'}</Text>
      {isSpanning && windowRects.length === 2 && (
        <>
          <Text>Left Screen: {windowRects[0].width}x{windowRects[0].height}</Text>
          <Text>Right Screen: {windowRects[1].width}x{windowRects[1].height}</Text>
        </>
      )}
    </View>
  );
}
```

### Manual API Usage

For more control, you can use the API directly:

```typescript
import DualScreenInfo from '@onekeyhq/shared/src/modules/DualScreenInfo';

// Check if device is dual-screen
const isDualScreen = await DualScreenInfo.isDualScreenDevice();

// Check if app is spanning
const spanning = await DualScreenInfo.isSpanning();

// Get window rectangles
const rects = await DualScreenInfo.getWindowRects();
if (rects.length === 2) {
  console.log('Left screen:', rects[0]);
  console.log('Right screen:', rects[1]);
}

// Get hinge bounds
const hinge = await DualScreenInfo.getHingeBounds();
if (hinge) {
  console.log('Hinge position:', hinge);
}

// Listen to spanning changes
const subscription = DualScreenInfo.addSpanningListener((event) => {
  console.log('Spanning changed:', event.isSpanning);
});

// Don't forget to unsubscribe
subscription.remove();
```

### Adaptive Layout Example

Here's a complete example of creating an adaptive layout for dual-screen devices:

```typescript
import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import { View, Text, StyleSheet } from 'react-native';

function AdaptiveLayout() {
  const { isSpanning, windowRects } = useDualScreenInfo();

  if (isSpanning && windowRects.length === 2) {
    // Dual-screen spanning layout
    return (
      <View style={styles.container}>
        <View style={[styles.panel, { width: windowRects[0].width }]}>
          <Text>Left Panel</Text>
          {/* Master view content */}
        </View>
        <View style={[styles.panel, { width: windowRects[1].width }]}>
          <Text>Right Panel</Text>
          {/* Detail view content */}
        </View>
      </View>
    );
  }

  // Single screen layout
  return (
    <View style={styles.container}>
      <Text>Single Screen View</Text>
      {/* Combined content */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    flex: 1,
    padding: 16,
  },
});
```

## API Reference

### TypeScript Types

```typescript
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpanningEvent {
  isSpanning: boolean;
}

type SpanningEventListener = (event: SpanningEvent) => void;
```

### Methods

#### `isDualScreenDevice(): Promise<boolean>`

Returns whether the device is a dual-screen or foldable device.

#### `isSpanning(): Promise<boolean>`

Returns whether the app is currently spanning across screens.

#### `getWindowRects(): Promise<Rect[]>`

Returns an array of rectangles representing each visible screen area (excluding the hinge/fold area).

#### `getHingeBounds(): Promise<Rect | null>`

Returns the bounds of the hinge/fold area, or null if not applicable.

#### `addSpanningListener(listener: SpanningEventListener): { remove: () => void }`

Adds a listener for spanning state changes. Returns a subscription object with a `remove()` method.

#### `removeAllSpanningListeners(): void`

Removes all spanning event listeners.

### Hook: `useDualScreenInfo()`

Returns an object with the following properties:

```typescript
{
  isDualScreenDevice: boolean;  // Whether device is dual-screen
  isSpanning: boolean;          // Whether app is spanning
  windowRects: Rect[];          // Array of screen rectangles
  hingeBounds: Rect | null;     // Hinge position
  isLoading: boolean;           // Loading state
  refresh: () => Promise<void>; // Function to refresh all data
}
```

## Platform Support

### Android

- **Minimum SDK**: API Level 30 (Android 11) or higher for full functionality
- **Supported Devices**:
  - Samsung Galaxy Fold series
  - Samsung Galaxy Z Fold series
  - Microsoft Surface Duo
  - Other foldable Android devices

### iOS

iOS support is not included in this implementation as iOS doesn't currently have dual-screen devices. The API will return safe defaults (false/empty arrays) on iOS.

## Technical Details

### Window Layout Detection

The module uses the AndroidX Window Manager library to detect device features:

1. **WindowInfoTracker**: Monitors window layout changes
2. **FoldingFeature**: Detects hinges and fold areas
3. **DisplayFeature**: Provides information about physical features

### Event Lifecycle

- Events are automatically subscribed when the app resumes
- Events are automatically unsubscribed when the app pauses
- Proper cleanup is handled in the module lifecycle

### Performance Considerations

- Window layout info is cached and only updated when the layout actually changes
- Events are only emitted when the spanning state changes
- The hook automatically manages subscriptions to prevent memory leaks

## Troubleshooting

### Module Not Found Error

If you see "The package 'DualScreenInfo' doesn't seem to be linked":

1. Make sure the package is registered in `MainApplication.java`
2. Clean and rebuild the Android app:
   ```bash
   cd apps/mobile/android
   ./gradlew clean
   cd ../../..
   yarn android
   ```

### Events Not Firing

1. Ensure you're testing on a device with API Level 30 or higher
2. Check that you're testing on an actual foldable/dual-screen device or emulator
3. Verify that the subscription is properly set up and not removed prematurely

### Window Rects Always Empty

This is expected behavior when:
- The device is not a foldable device
- The app is not currently spanning across screens
- The device API level is below 30

## Differences from Microsoft's react-native-dualscreen

This implementation is inspired by Microsoft's library but with some key differences:

1. **Language**: Implemented in pure Java instead of Kotlin
2. **API Compatibility**: Provides similar API surface but may have minor differences
3. **Integration**: Designed specifically for the OneKey app architecture
4. **Dependencies**: Uses WindowInfoTrackerCallbackAdapter for Java-friendly async operations

## Future Enhancements

Potential future improvements:

- [ ] Add support for detecting specific fold angles
- [ ] Provide more detailed hinge information
- [ ] Add support for multi-window mode detection
- [ ] Optimize performance for rapid layout changes
- [ ] Add more sophisticated layout helpers

## References

- [Microsoft's react-native-dualscreen](https://github.com/microsoft/react-native-dualscreen)
- [AndroidX Window Manager](https://developer.android.com/jetpack/androidx/releases/window)
- [Surface Duo Development](https://docs.microsoft.com/en-us/dual-screen/android/)

## License

This module is part of the OneKey Wallet project.

