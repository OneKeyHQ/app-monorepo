# DualScreenInfo Module

A React Native module for detecting and handling dual-screen and foldable devices, inspired by Microsoft's `react-native-dualscreen` library.

## Features

- Detect if a device is a dual-screen or foldable device
- Check if the app is currently spanning across screens
- Get window rectangles for each screen region
- Get hinge/fold position information
- Listen to screen spanning state changes

## Installation

This module is built into the OneKey app. To use it in your React Native code:

### 1. Register the Package

Add the package to your `MainApplication.java`:

```java
import so.onekey.app.wallet.dualscreen.DualScreenInfoPackage;

@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new DualScreenInfoPackage());
    return packages;
}
```

### 2. Add Dependencies to build.gradle

Make sure you have the Window Manager library in your `app/build.gradle`:

```gradle
dependencies {
    implementation 'androidx.window:window:1.2.0'
    implementation 'androidx.window:window-java:1.2.0'
}
```

## API Reference

### Methods

#### `isDualScreenDevice()`

Check if the device is a dual-screen or foldable device.

```javascript
import { NativeModules } from 'react-native';
const { DualScreenInfo } = NativeModules;

const isDualScreen = await DualScreenInfo.isDualScreenDevice();
console.log('Is dual-screen device:', isDualScreen);
```

**Returns:** `Promise<boolean>`

#### `isSpanning()`

Check if the app is currently spanning across screens.

```javascript
const spanning = await DualScreenInfo.isSpanning();
console.log('Is spanning:', spanning);
```

**Returns:** `Promise<boolean>`

#### `getWindowRects()`

Get the window rectangles for each screen region. Returns an array of rectangles representing each visible screen area (excluding the hinge/fold area).

```javascript
const rects = await DualScreenInfo.getWindowRects();
// rects = [
//   { x: 0, y: 0, width: 1434, height: 1800 },    // Left screen
//   { x: 1454, y: 0, width: 1434, height: 1800 }  // Right screen
// ]
```

**Returns:** `Promise<Array<{x: number, y: number, width: number, height: number}>>`

#### `getHingeBounds()`

Get the bounds of the hinge/fold area.

```javascript
const hinge = await DualScreenInfo.getHingeBounds();
if (hinge) {
    console.log('Hinge position:', hinge);
    // hinge = { x: 1434, y: 0, width: 20, height: 1800 }
}
```

**Returns:** `Promise<{x: number, y: number, width: number, height: number} | null>`

### Events

#### `didUpdateSpanning`

Listen to screen spanning state changes.

```javascript
import { NativeModules, NativeEventEmitter } from 'react-native';
const { DualScreenInfo } = NativeModules;
const eventEmitter = new NativeEventEmitter(DualScreenInfo);

const subscription = eventEmitter.addListener(
    DualScreenInfo.getConstants().EVENT_DID_UPDATE_SPANNING,
    (event) => {
        console.log('Spanning state changed:', event.isSpanning);
    }
);

// Don't forget to unsubscribe
subscription.remove();
```

**Event payload:** `{ isSpanning: boolean }`

## Usage Example

Here's a complete example of how to use the DualScreenInfo module:

```javascript
import React, { useEffect, useState } from 'react';
import { View, Text, NativeModules, NativeEventEmitter } from 'react-native';

const { DualScreenInfo } = NativeModules;

export function DualScreenExample() {
    const [isDualScreen, setIsDualScreen] = useState(false);
    const [isSpanning, setIsSpanning] = useState(false);
    const [windowRects, setWindowRects] = useState([]);

    useEffect(() => {
        // Check if device is dual-screen
        DualScreenInfo.isDualScreenDevice().then(setIsDualScreen);

        // Check initial spanning state
        DualScreenInfo.isSpanning().then(setIsSpanning);
        DualScreenInfo.getWindowRects().then(setWindowRects);

        // Listen to spanning changes
        const eventEmitter = new NativeEventEmitter(DualScreenInfo);
        const subscription = eventEmitter.addListener(
            'didUpdateSpanning',
            async (event) => {
                setIsSpanning(event.isSpanning);
                const rects = await DualScreenInfo.getWindowRects();
                setWindowRects(rects);
            }
        );

        return () => {
            subscription.remove();
        };
    }, []);

    return (
        <View>
            <Text>Is Dual-Screen Device: {isDualScreen ? 'Yes' : 'No'}</Text>
            <Text>Is Spanning: {isSpanning ? 'Yes' : 'No'}</Text>
            {windowRects.length > 0 && (
                <Text>Window Rects: {JSON.stringify(windowRects, null, 2)}</Text>
            )}
        </View>
    );
}
```

## Platform Support

- **Android:** Requires API Level 30 (Android 11) or higher
- **Foldable Devices:** Samsung Galaxy Fold, Samsung Galaxy Z Fold series, Microsoft Surface Duo, etc.

## Implementation Notes

This module uses the AndroidX Window Manager library to detect and handle dual-screen and foldable devices. The module:

1. Uses `WindowInfoTracker` to observe window layout changes
2. Detects `FoldingFeature` to identify hinges and fold areas
3. Calculates screen regions based on the folding feature position
4. Emits events when the spanning state changes

## Differences from Microsoft's react-native-dualscreen

This is a Java implementation inspired by the original Kotlin implementation. The API is designed to be compatible with the original library, with the following considerations:

- Implemented in pure Java for easier integration with existing Java codebases
- Uses WindowInfoTrackerCallbackAdapter for Java-friendly async operations
- Provides the same API surface as the original library
- Automatically starts/stops observing window changes based on app lifecycle

## Troubleshooting

### Module not found

Make sure you've registered the `DualScreenInfoPackage` in your `MainApplication.java`.

### Window layout info not updating

Ensure you have the correct permissions and that your app is running on a supported device with API Level 30 or higher.

### Events not firing

Make sure you're using a `NativeEventEmitter` and subscribing to the correct event name from `DualScreenInfo.getConstants().EVENT_DID_UPDATE_SPANNING`.

## License

This module is part of the OneKey Wallet project.

