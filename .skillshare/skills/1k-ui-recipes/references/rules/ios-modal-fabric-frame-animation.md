# iOS Modal Content Displacement During Presentation (Fabric)

## Symptom

When opening modal pages (pageSheet/formSheet) on iOS with Fabric (New Architecture), content visibly slides, scales, or "flies in" from wrong positions during the modal slide-up animation. Elements like search bars, icons, and text appear displaced or stretched for ~300ms, then snap to correct positions.

Specific visual artifacts:
- Content appears to scale up from a corner
- Text appears stretched or at wrong font size
- Icons fly in from unrelated positions (e.g., from where a previous icon was)
- Background color flashes white/gray before settling to dark theme
- Search bar wrapper animates from 20x20 to 394x48

## Root Cause

**Fabric view recycling + UIKit animation block capture.**

1. Fabric recycles native `RCTViewComponentView` instances. A recycled view retains its **stale frame** from previous usage (e.g., a 20x20 icon view gets reused as a 394x48 search bar wrapper).

2. When a modal is presented, UIKit opens an animation block for the slide-up transition.

3. Fabric mounts recycled views and sets their correct frames via `updateLayoutMetrics` → `self.center` / `self.bounds`.

4. These frame changes happen inside UIKit's animation block → UIKit captures them as **implicit animations**.

5. The **presentation layer** animates from the stale frame to the correct frame over ~300ms (matching the modal transition duration), causing visible content displacement.

### Evidence

Native view dump at t+15ms after modal `viewWillAppear`:
```
ab-search-wrap:
  model frame:         {4, 4, 394, 48}           ← correct (set by Fabric)
  presentationFrame:   {349.74, 13.99, 20.28, 20.02}  ← stale (from recycled view)
```

The presentation layer then animates from `{349,14,20,20}` → `{4,4,394,48}` over 300ms.

### Contributing factors

- `updateBounds` height bouncing: 11 calls in 180ms (802→874→818→874→802→746) due to safeAreaInsets changes and header height calculations
- `RCTParagraphComponentView.layoutSubviews` sets `_textView.frame = self.bounds` outside the `performWithoutAnimation` scope
- `RCTViewComponentView.invalidateLayer` sets `layer.backgroundColor` which also gets implicitly animated

## Fix

**Patch `react-native-screens` and `react-native` (Fabric):**

### 1. react-native-screens (`RNSScreen.mm`)

Add a global flag that signals when a modal transition is in progress:

```objc
// Global flag
BOOL RNSModalTransitionInProgress = NO;

// viewWillAppear — set flag
if (self.screenView.isPresentedAsNativeModal && animated) {
    RNSModalTransitionInProgress = YES;
}

// viewDidAppear — clear flag
if (self.screenView.isPresentedAsNativeModal) {
    RNSModalTransitionInProgress = NO;
}
```

### 2. react-native Fabric (`UIView+ComponentViewProtocol.mm`)

Wrap frame changes in `performWithoutAnimation:` when the flag is active:

```objc
extern BOOL RNSModalTransitionInProgress;
if (RNSModalTransitionInProgress) {
    [UIView performWithoutAnimation:^{
        self.center = CGPoint{CGRectGetMidX(frame), CGRectGetMidY(frame)};
        self.bounds = CGRect{CGPointZero, frame.size};
        [self layoutIfNeeded]; // Force RCTParagraphTextView frame update
    }];
} else {
    self.center = CGPoint{CGRectGetMidX(frame), CGRectGetMidY(frame)};
    self.bounds = CGRect{CGPointZero, frame.size};
}
```

### 3. react-native Fabric (`RCTViewComponentView.mm`)

Wrap `invalidateLayer` to prevent backgroundColor flash:

```objc
- (void)invalidateLayer {
    extern BOOL RNSModalTransitionInProgress;
    if (RNSModalTransitionInProgress) {
        [UIView performWithoutAnimation:^{
            [self _invalidateLayerImpl];
        }];
    } else {
        [self _invalidateLayerImpl];
    }
}
```

## Why `performWithoutAnimation` works

`UIView.performWithoutAnimation:` is Apple's API specifically designed to suppress implicit animations even inside an active animation block. The modal slide-up animation (on `UITransitionView`) is driven by `presentViewController:animated:` and is **not** affected — only the content frame corrections inside the block are made instant.

## What didn't work (and why)

| Approach | Why it failed |
|---|---|
| `CATransaction.setDisableActions:YES` | Only suppresses CALayer implicit actions, not UIView animation block captures |
| `layer.actions = @{@"position": [NSNull null], ...}` | UIKit animation block overrides layer action delegates |
| `layer.speed = 0` | Froze the wrong layout state, broke touch interactions and `viewDidAppear` timing |
| Defer `updateBounds` to `viewDidAppear` | Other triggers (safeAreaInsets, header height) still caused relayout during animation |
| Pre-set `additionalSafeAreaInsets` | Only fixes height delta, doesn't address recycled view stale frames |

## Investigation methodology

1. **Debug borders** (red/blue/green/yellow) on container components confirmed outer containers are always correct — only inner content is displaced
2. **Native view hierarchy dump** (`presentationLayer.frame` vs `model frame`) at 30ms intervals confirmed the `diff=YES` on child views
3. **`layer.speed = 0`** frozen state proved the first layout IS wrong (not just animated)
4. **testID tracking** (`ab-root`, `ab-search-wrap`, `ab-empty`) identified specific views with stale presentation frames
5. **setFrame hook** (swizzle `updateLayoutMetrics`) traced frame changes to Fabric's mount items

## Key files

- `patches/react-native-screens+4.23.0.patch` — `RNSModalTransitionInProgress` flag
- `patches/react-native+0.81.5.patch` — `performWithoutAnimation` in `updateLayoutMetrics` and `invalidateLayer`
- `node_modules/react-native/React/Fabric/Mounting/UIView+ComponentViewProtocol.mm` — where Fabric sets `center`/`bounds`
- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm` — where `invalidateLayer` renders backgroundColor
- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/Text/RCTParagraphComponentView.mm` — `_textView.frame = self.bounds` in `layoutSubviews`

## Related issues

- [react-native-screens #2983](https://github.com/software-mansion/react-native-screens/issues/2983) — modal animation glitches (Fabric only)
- [react-native-screens #2802](https://github.com/software-mansion/react-native-screens/issues/2802) — updateBounds called repeatedly with bouncing values
- [Lottie-iOS PR #932](https://github.com/airbnb/lottie-ios/pull/932) — same root cause pattern (implicit animation during layout)
