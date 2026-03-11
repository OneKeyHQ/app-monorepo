# Keyboard Avoidance for Input Fields

## Overview

The project uses `react-native-keyboard-controller` wrapped in a unified `Keyboard` component (`packages/components/src/content/Keyboard/`). Web falls back to no-op / plain ScrollView.

## Strategy 1: KeyboardAwareScrollView (Auto-scroll)

`PageContainer` automatically wraps children with `KeyboardAwareScrollView` when `scrollEnabled` is true. No extra code needed for standard `Page` usage.

**File**: `packages/components/src/layouts/Page/PageContainer.native.tsx`

```typescript
<KeyboardAwareScrollView
  bottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET} // 90px default
  style={[{ flex: 1 }, style]}
>
  {children}
</KeyboardAwareScrollView>
```

**Constant**: `packages/components/src/content/Keyboard/constant.ts`

```typescript
export const KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET = 90;
```

Custom `bottomOffset` when needed:

```typescript
<Keyboard.AwareScrollView bottomOffset={150}>
  {/* content */}
</Keyboard.AwareScrollView>
```

## Strategy 2: Footer Animated Padding

### Page Footer

**File**: `packages/components/src/layouts/Page/PageFooter.tsx`

Uses `useReanimatedKeyboardAnimation` to animate `paddingBottom` so bottom buttons follow the keyboard.

```typescript
const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
const animatedStyle = useAnimatedStyle(() => ({
  paddingBottom: Math.max(Math.abs(keyboardHeight.value) - tabBarHeight, 0),
}));
```

### Dialog Footer

**File**: `packages/components/src/composite/Dialog/Footer.tsx`

Dialogs live outside NavigationContainer, so they use `useKeyboardEventWithoutNavigation`:

```typescript
useKeyboardEventWithoutNavigation({
  keyboardWillShow: (e) => {
    keyboardHeightValue.value = e.endCoordinates.height - bottom;
  },
  keyboardWillHide: () => {
    keyboardHeightValue.value = 0;
  },
});
```

### ⚠️ Dialog with `showFooter: false` — Keyboard Avoidance NOT Automatic

When a Dialog is created with `showFooter: false`, the Footer's keyboard avoidance is **skipped** — no `paddingBottom` animation is applied. If the dialog content contains input fields, the keyboard will cover them.

**Fix**: Wrap `renderContent` with a custom keyboard-avoiding `Animated.View`:

```typescript
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useKeyboardEventWithoutNavigation, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const DEFAULT_KEYBOARD_HEIGHT = 330;
function DialogKeyboardAvoidingView({ children }: { children: React.ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  const keyboardHeightValue = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightValue.value,
  }));
  useKeyboardEventWithoutNavigation({
    keyboardWillShow: (e) => {
      const height = e.endCoordinates.height;
      const keyboardHeight = height < 0 ? DEFAULT_KEYBOARD_HEIGHT : height;
      keyboardHeightValue.value = keyboardHeight - bottom;
    },
    keyboardWillHide: () => {
      keyboardHeightValue.value = 0;
    },
  });
  if (!platformEnv.isNative) {
    return <>{children}</>;
  }
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

// Usage in Dialog.show():
Dialog.show({
  showFooter: false,
  renderContent: (
    <DialogKeyboardAvoidingView>
      {/* your input content */}
    </DialogKeyboardAvoidingView>
  ),
});
```

**Reference**: `packages/kit/src/views/Market/MarketDetailV2/layouts/MobileLayout.tsx` — `DialogKeyboardAvoidingView` component.

## Strategy 3: Custom Hooks

**File**: `packages/components/src/hooks/useKeyboard.ts`

| Hook | Usage |
|------|-------|
| `useKeyboardHeight()` | Returns current keyboard height (0 when hidden) |
| `useKeyboardEvent({ keyboardWillShow, keyboardWillHide })` | Fires only when current screen is focused (`useIsFocused`) |
| `useKeyboardEventWithoutNavigation(...)` | Same but no Navigation dependency — for Dialog / Modal |

## Keyboard Dismissal

**File**: `packages/shared/src/keyboard/index.native.ts`

```typescript
import { Keyboard } from '@onekeyhq/components';

Keyboard.dismiss();                  // close immediately
await Keyboard.dismissWithDelay();   // close + wait 80ms (useful before navigation)
```

## Decision Table

| Scenario | Approach | Extra code? |
|----------|----------|-------------|
| Input in a standard `Page` | Automatic via `PageContainer` | No |
| Bottom buttons in `Page` | Automatic via `Page.Footer` | No |
| Input in `Dialog` (with footer) | Automatic via `Dialog.Footer` | No |
| Input in `Dialog` (`showFooter: false`) | **Manual** — wrap content with `DialogKeyboardAvoidingView` | Yes |
| Custom layout (e.g. Onboarding) | `Keyboard.AwareScrollView` + `bottomOffset` | Yes |
| Layout adjusted by keyboard state | `useKeyboardHeight()` / `useKeyboardEvent()` | Yes |
| Dismiss keyboard before action | `Keyboard.dismiss()` / `Keyboard.dismissWithDelay()` | Yes |

## Cross-Platform Behavior

| Platform | AwareScrollView | Footer animation | useKeyboardHeight |
|----------|----------------|-----------------|-------------------|
| iOS | Auto-scroll | Animated padding | Real height |
| Android | Auto-scroll | Animated padding | Real height |
| Web | Falls back to ScrollView | Disabled | Returns 0 |

## Key Files

- `packages/components/src/content/Keyboard/index.native.tsx` — Native Keyboard wrapper
- `packages/components/src/content/Keyboard/index.tsx` — Web fallback
- `packages/components/src/content/Keyboard/constant.ts` — Constants
- `packages/components/src/layouts/Page/PageContainer.native.tsx` — Page keyboard handling
- `packages/components/src/layouts/Page/PageFooter.tsx` — Page Footer animation
- `packages/components/src/composite/Dialog/Footer.tsx` — Dialog Footer animation
- `packages/components/src/hooks/useKeyboard.ts` — Keyboard hooks
- `packages/shared/src/keyboard/index.native.ts` — Dismiss utilities
