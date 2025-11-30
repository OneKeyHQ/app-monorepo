# DualScreenInfo Module

A React Native module for detecting and handling dual-screen and foldable devices, compatible with Microsoft's [react-native-dualscreen](https://github.com/microsoft/react-native-dualscreen) API.

## Quick Start

```typescript
import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';

function MyComponent() {
  const { isDualScreenDevice, isSpanning, windowRects } = useDualScreenInfo();

  return (
    <View>
      <Text>Dual-Screen: {isDualScreenDevice ? 'Yes' : 'No'}</Text>
      <Text>Spanning: {isSpanning ? 'Yes' : 'No'}</Text>
    </View>
  );
}
```

## Features

- ✅ **Device Detection**: Check if device is dual-screen or foldable
- ✅ **Spanning Detection**: Detect when app spans across screens
- ✅ **Window Rects**: Get precise dimensions of each screen region
- ✅ **Hinge Info**: Get hinge/fold position and size
- ✅ **Real-time Events**: Listen to spanning state changes
- ✅ **React Hook**: Easy integration with `useDualScreenInfo`
- ✅ **TypeScript**: Full TypeScript support with proper types

## Installation

The module is already integrated into the OneKey app. No additional installation needed.

## API

### Hook: `useDualScreenInfo()`

The easiest way to use the module:

```typescript
const {
  isDualScreenDevice, // boolean: Is this a dual-screen device?
  isSpanning,         // boolean: Is app spanning across screens?
  windowRects,        // Rect[]: Array of screen rectangles
  hingeBounds,        // Rect | null: Hinge position
  isLoading,          // boolean: Loading state
  refresh,            // () => Promise<void>: Refresh data
} = useDualScreenInfo();
```

### Direct API

For more control:

```typescript
import DualScreenInfo from '@onekeyhq/shared/src/modules/DualScreenInfo';

// Check device type
const isDualScreen = await DualScreenInfo.isDualScreenDevice();

// Check spanning state
const spanning = await DualScreenInfo.isSpanning();

// Get window rectangles
const rects = await DualScreenInfo.getWindowRects();

// Get hinge bounds
const hinge = await DualScreenInfo.getHingeBounds();

// Listen to changes
const subscription = DualScreenInfo.addSpanningListener((event) => {
  console.log('Spanning:', event.isSpanning);
});

// Clean up
subscription.remove();
```

## Types

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
```

## Examples

### Adaptive Layout

Create layouts that adapt to dual-screen mode:

```typescript
function AdaptiveView() {
  const { isSpanning, windowRects } = useDualScreenInfo();

  if (isSpanning && windowRects.length === 2) {
    return (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: windowRects[0].width }}>
          <MasterView />
        </View>
        <View style={{ width: windowRects[1].width }}>
          <DetailView />
        </View>
      </View>
    );
  }

  return <CombinedView />;
}
```

### Listen to Changes

React to spanning state changes:

```typescript
function SpanningListener() {
  const [spanCount, setSpanCount] = useState(0);

  useEffect(() => {
    const subscription = DualScreenInfo.addSpanningListener((event) => {
      if (event.isSpanning) {
        setSpanCount(count => count + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  return <Text>Spanned {spanCount} times</Text>;
}
```

## Platform Support

- **Android**: API Level 24+ (full support on API 30+)
- **iOS**: Returns safe defaults (not applicable)

### Supported Devices

- Samsung Galaxy Fold / Z Fold series
- Microsoft Surface Duo
- Other foldable Android devices

## Implementation

This module consists of:

1. **Native Android Module** (`DualScreenInfoModule.java`)
   - Uses AndroidX Window Manager library
   - Monitors window layout changes
   - Emits events to JavaScript

2. **TypeScript Wrapper** (`index.ts`)
   - Provides type-safe API
   - Handles errors gracefully
   - Compatible with Microsoft's API

3. **React Hook** (`useDualScreenInfo.ts`)
   - Manages subscriptions automatically
   - Provides loading states
   - Prevents memory leaks

## API Compatibility

This module provides API compatibility with Microsoft's `react-native-dualscreen` library:

| Method | Microsoft API | This Module |
|--------|--------------|-------------|
| `isDualScreenDevice()` | ✅ | ✅ |
| `isSpanning()` | ✅ | ✅ |
| `getWindowRects()` | ✅ | ✅ |
| `getHingeBounds()` | ✅ | ✅ |
| Event: `didUpdateSpanning` | ✅ | ✅ |

## Files

- `index.ts` - Main API and exports
- `useDualScreenInfo.ts` - React hook
- `example.tsx` - Usage examples

## Documentation

For detailed documentation, see:
- [Integration Guide](/docs/DUAL_SCREEN_INFO.md)
- [Native Implementation](/apps/mobile/android/app/src/main/java/so/onekey/app/wallet/dualscreen/README.md)

## Troubleshooting

### Module not found

Make sure you're importing from the correct path:

```typescript
import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';
```

### Events not firing

Events only fire when:
1. Running on a foldable device (or emulator)
2. The spanning state actually changes
3. App is in the foreground

### Always returns false

This is expected when:
- Testing on a non-foldable device
- Testing on Android API < 24
- App is not spanning across screens

## License

Part of the OneKey Wallet project.

