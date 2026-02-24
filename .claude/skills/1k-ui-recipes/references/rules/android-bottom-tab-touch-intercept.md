# Android Bottom Tab Touch Interception (Temporary Workaround)

> **WARNING**: This is a **temporary workaround**. The root cause is in `react-native-bottom-tabs` — even when the tab bar is hidden (visibility GONE), it still intercepts touches in the tab bar region. This should be fixed upstream in `react-native-bottom-tabs` so that hidden tab bars do not consume touch events.

## Problem

On Android, buttons positioned near the bottom of the screen (in the tab bar region) are **not clickable** when using `react-native-bottom-tabs` as the native tab navigator. This happens even when the tab bar is hidden (e.g., on detail/modal pages).

## Root Cause

`react-native-bottom-tabs` renders a native Android view for the tab bar. Even when the tab bar visibility is set to `GONE`, the native view hierarchy still intercepts touch events in that region **before** React Native's JS touch system can dispatch them. Standard RN `onPress` / `Pressable` / `TouchableOpacity` handlers all fail because they rely on the RN touch pipeline, which never receives the event.

## Why Standard Approaches Fail

| Approach | Why It Fails |
|----------|-------------|
| `onPress` on Button/Pressable | RN touch system never receives the event — native view intercepts first |
| `TouchableOpacity` / `TouchableWithoutFeedback` | Same issue — all RN touch primitives are blocked |
| `pointerEvents="box-none"` | Does not affect native tab bar view interception |
| Adjusting `zIndex` or `elevation` | The interception happens at the native level, not the RN layout level |

## Solution: GestureDetector with Gesture.Tap (Android Only)

`react-native-gesture-handler` (RNGH) intercepts touches at the `GestureHandlerRootView` (app root) level, **bypassing the native view hierarchy entirely**. Wrap buttons with `GestureDetector` + `Gesture.Tap()` on Android using a `.android.tsx` platform-specific file.

### Pattern

Create two files — a default version and an Android-specific version:

**`MyFooterButtons.tsx`** (default — iOS, Web, etc.):

```typescript
import { Button } from '@onekeyhq/components';

type IProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

function MyFooterButtons({ onConfirm, onCancel }: IProps) {
  return (
    <>
      <Button onPress={onCancel}>Cancel</Button>
      <Button onPress={onConfirm}>Confirm</Button>
    </>
  );
}

export default MyFooterButtons;
```

**`MyFooterButtons.android.tsx`** (Android — GestureDetector workaround):

```typescript
import { useMemo } from 'react';

import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Button } from '@onekeyhq/components';

// On Android, react-native-bottom-tabs intercepts touches in the tab bar
// area even when hidden. RNGH bypasses native view hierarchy.

type IProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

function MyFooterButtons({ onConfirm, onCancel }: IProps) {
  const cancelGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(onCancel)();
      }),
    [onCancel],
  );

  const confirmGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        runOnJS(onConfirm)();
      }),
    [onConfirm],
  );

  return (
    <>
      <GestureDetector gesture={cancelGesture}>
        <View>
          <Button>Cancel</Button>
        </View>
      </GestureDetector>
      <GestureDetector gesture={confirmGesture}>
        <View>
          <Button>Confirm</Button>
        </View>
      </GestureDetector>
    </>
  );
}

export default MyFooterButtons;
```

## Key Details

1. **Platform-specific files**: Use `.android.tsx` so the workaround only applies to Android — iOS and other platforms use normal `onPress`
2. **`Gesture.Tap()` + `runOnJS`**: The tap gesture runs on the UI thread (`'worklet'`), so use `runOnJS` to call JS callbacks
3. **`<View>` wrapper**: `GestureDetector` requires a single native `View` child — wrap the Button in an RN `View`
4. **Stable callbacks**: Pass `useCallback`-wrapped handlers as props, since they become dependencies of the `useMemo` gesture
5. **No `onPress` on Button**: In the Android version, the Button itself should NOT have `onPress` — the tap is handled entirely by `GestureDetector`

## Real Examples

- `packages/kit/src/views/Perp/components/PerpMarketFooter.android.tsx` — Long/Short buttons on perp market page
- `packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/SwapPanelFooterButtons.android.tsx` — Buy/Sell buttons on market detail page

## TODO: Permanent Fix

The proper fix is to patch or contribute upstream to `react-native-bottom-tabs` so that when the tab bar visibility is `GONE`, it does **not** intercept touch events. Once that is resolved, the `.android.tsx` GestureDetector variants can be removed and the default `onPress` handlers will work everywhere.

## Checklist

- [ ] Create `.android.tsx` variant — do NOT modify the default file
- [ ] Use `Gesture.Tap().onEnd()` with `'worklet'` directive
- [ ] Use `runOnJS` to bridge back to JS thread
- [ ] Wrap each button in `<GestureDetector><View>...</View></GestureDetector>`
- [ ] Remove `onPress` from Button in the Android variant
- [ ] Ensure callback props are stable (`useCallback`)
- [ ] Verify iOS/Web still work with the default (non-Android) component
