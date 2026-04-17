# Page and Route Guide

This guide helps create and configure pages and routes in the OneKey app-monorepo.

---

## ⚠️ WARNING: Page Deletion Policy

**DO NOT DELETE PAGES unless you have confirmed there are NO external links to the page.**

External links include:
- Deep links / Universal links
- QR code handlers
- Banner click handlers
- Web URLs shared externally
- Third-party integrations
- Marketing materials / Documentation

**If you need to remove a page's functionality:**

Instead of deleting the route, keep the route registered and modify the page component:

```typescript
import { Page } from '@onekeyhq/components';

/**
 * @deprecated This page has been deprecated since v5.0.0
 *
 * New location: packages/kit/src/views/NewFeature/pages/NewPage.tsx
 * New route: EModalRoutes.NewFeatureModal -> ENewFeatureRoutes.NewPage
 *
 * This page is kept for backward compatibility with external deep links.
 * DO NOT DELETE - external links may still reference this route.
 */
function DeprecatedPage() {
  return (
    <Page
      shouldRedirect={() => true}  // Always redirect
      onRedirected={() => {
        // Navigate to replacement page or home
        navigation.switchTab(ETabRoutes.Home);
        // Or show a toast explaining the change
        Toast.info({ title: 'This feature has been moved' });
      }}
    >
      {null}  // Render nothing
    </Page>
  );
}

export default DeprecatedPage;
```

---

## Page Types

The page types are defined in `packages/components/src/hocs/PageType/pageType.ts`:

| Type | Description | Animation Behavior |
|------|-------------|-------------------|
| `modal` | Modal route pages | iOS: First page slides from bottom, subsequent pages slide from right. Android: No animation. Web/Desktop/Extension/iPad: Same as iOS but displays as floating popup |
| `stack` | Tab route pages (will be renamed from "stack") | On small screens, first page shows in bottom tab bar; on large screens, tab shows in sidebar. Subsequent pages slide from right. Android: No animation |
| `fullScreen` | Full screen overlay (deprecated) | Layer is lower than modal, avoid adding new pages |
| `onboarding` | OnboardingV2 full screen pages | Full screen overlay on all platforms, layer is below modal |

## Creating Routes

### 1. Modal Route

Modal routes are configured in `packages/kit/src/routes/Modal/router.tsx`.

**Example: Creating a NotificationsModal route**

#### Step 1: Define Route Enum and Param Types

Create route file `packages/shared/src/routes/notifications.ts`:
```typescript
export enum EModalNotificationsRoutes {
  NotificationList = 'NotificationList',
  NotificationIntroduction = 'NotificationIntroduction',
}

export type IModalNotificationsParamList = {
  [EModalNotificationsRoutes.NotificationList]: undefined;
  [EModalNotificationsRoutes.NotificationIntroduction]: undefined;
};
```

#### Step 2: Add to EModalRoutes Enum

In `packages/shared/src/routes/modal.ts`:
```typescript
export enum EModalRoutes {
  // ... existing routes
  NotificationsModal = 'NotificationsModal',
}

export type IModalParamList = {
  // ... existing types
  [EModalRoutes.NotificationsModal]: IModalNotificationsParamList;
};
```

#### Step 3: Create Router Configuration

Create `packages/kit/src/views/Notifications/router/index.ts`:
```typescript
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalNotificationsParamList } from '@onekeyhq/shared/src/routes/notifications';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';

const NotificationList = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Notifications/pages/NotificationList'),
);

const NotificationIntroduction = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Notifications/pages/NotificationIntroduction'),
);

export const ModalNotificationsRouter: IModalFlowNavigatorConfig<
  EModalNotificationsRoutes,
  IModalNotificationsParamList
>[] = [
  {
    name: EModalNotificationsRoutes.NotificationList,
    component: NotificationList,
  },
  {
    name: EModalNotificationsRoutes.NotificationIntroduction,
    component: NotificationIntroduction,
  },
];
```

#### Step 4: Register in Modal Router

In `packages/kit/src/routes/Modal/router.tsx`:
```typescript
import { ModalNotificationsRouter } from '../../views/Notifications/router';

const router: IModalRootNavigatorConfig<EModalRoutes>[] = [
  // ... existing routes
  {
    name: EModalRoutes.NotificationsModal,
    children: ModalNotificationsRouter,
  },
];
```

#### Step 5: Create Page Component

Create `packages/kit/src/views/Notifications/pages/NotificationList.tsx`:
```typescript
import { Page } from '@onekeyhq/components';

function NotificationList() {
  return (
    <Page safeAreaEnabled={false}>
      <Page.Body>
        {/* Page content */}
      </Page.Body>
    </Page>
  );
}

export default NotificationList;
```

### 2. Onboarding Route

Onboarding routes are configured in `packages/kit/src/views/Onboardingv2/router/index.tsx`.

### 3. Tab Route

Tab routes are configured in `packages/kit/src/routes/Tab/router.ts`.

**Tab Configuration Options:**
- `hiddenIcon`: Hide tab icon on certain platforms
- `hideOnTabBar`: Hide from tab bar but keep route accessible
- `inMoreAction`: Show in "More" menu instead of main tab bar
- `freezeOnBlur`: Keep tab state when switching tabs

---

## Configuring Page Paths

### ⚠️ WARNING: Route Paths Must Be Unique

**Route paths MUST NOT be duplicated.** Each route path must be unique across the entire application.

If duplicate paths are detected, the application will throw an error at startup:

```
Found conflicting screens with the same pattern. The pattern '/market/tokens/.'
resolves to both 'Main > Market > MarketDetail' and 'Main > Market > MarketDetailV2'.
Patterns must be unique and cannot resolve to more than one screen.
```

### URL Path Configuration

Route paths are calculated in `packages/kit/src/routes/config/index.ts` via `resolveScreens`.

#### Path Calculation Rules

**Rule 1: Default path accumulation**
Without any configuration, paths accumulate based on route hierarchy:
```
Route: Main -> Market -> MarketDetail
Path:  /Main/Market/MarketDetail
```

**Rule 2: `rewrite` replaces current segment only**
```typescript
{
  name: ETabRoutes.Market,
  rewrite: '/market',     // Replaces 'Market' with 'market'
  children: marketRouters,
}
// Result: /Main/market/...
```

**Rule 3: `exact: true` truncates all parent paths**
```typescript
{
  name: EModalRoutes.SettingModal,
  children: ModalSettingStack,
  rewrite: '/settings',
  exact: true,            // Ignores /Modal prefix
}
// Result: /settings/...
```

**Rule 4: Path params with `/:param` syntax**
```typescript
{
  name: ETabMarketRoutes.MarketDetail,
  component: MarketDetail,
  rewrite: '/tokens/:token',  // :token is a path parameter
}
// Result: /market/tokens/:token
```

### URL Allow List (Browser Display)

By default, routes don't display in the browser URL bar. To enable URL display, configure in `packages/shared/src/utils/routeUtils.ts`:

```typescript
export const buildAllowList = (screens, perpDisabled, perpTabShowWeb) => {
  const rules = {
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.MarketDetailV2}`]: {
      showUrl: true,      // Enable URL display
      showParams: true,   // Show query parameters
    },
  };
  return rules;
};
```

---

## Platform-Specific Routing: Web vs Extension

### Web/Native: Standard Path Routing

File: `packages/kit/src/routes/config/getStateFromPath.ts`

**URL format:** `https://app.onekey.so/market/tokens/bitcoin`

### Extension: Hash Routing

File: `packages/kit/src/routes/config/getStateFromPath.ext.ts`

**URL format:** `chrome-extension://xxx/ui-expand-tab.html#/market/tokens/bitcoin`

The extension uses hash routing because:
- Browser extensions load from local HTML files
- Standard path routing doesn't work with extension URL scheme
- Hash routing allows navigation without page reload

---

## Page Lifecycle

The `Page` component supports lifecycle callbacks:

```typescript
interface IPageLifeCycle {
  onMounted?: () => void;      // Called after page transition completes
  onUnmounted?: () => void;    // Called after page unmount transition completes
  onCancel?: () => void;       // Called when page closed without confirm
  onConfirm?: () => void;      // Called when page closed with confirm
  onClose?: (extra?: { flag?: string }) => void;  // Called on any close
  onRedirected?: () => void;   // Called after redirect completes
  shouldRedirect?: () => boolean;  // Return true to redirect immediately
}
```

**Redirect Pattern:**
```typescript
<Page
  shouldRedirect={() => !isUserAuthenticated}
  onRedirected={() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.Login,
    });
  }}
>
```

---

## Deep Link / Universal Link Configuration

Configure in `packages/kit/src/routes/config/deeplink/index.ts`:

**Deep Link Format:**
- `onekey-wallet://invite_share?utm_source=twitter&code=ABC123`
- `https://app.onekey.so/wc/connect/wc?uri=...` (Universal Link)

---

## Navigation Methods

```typescript
// Push modal
navigation.pushModal(EModalRoutes.NotificationsModal, {
  screen: EModalNotificationsRoutes.NotificationList,
  params: { /* page params */ },
});

// Switch tab
navigation.switchTab(ETabRoutes.Market);

// Navigate within tab - ALWAYS use pop: true
navigation.navigate(ERootRoutes.Main, {
  screen: ETabRoutes.Market,
  params: {
    screen: ETabMarketRoutes.MarketDetail,
    params: { token: 'bitcoin' },
  },
}, {
  pop: true,
});

// Go back
navigation.goBack();
```

### ⚠️ IMPORTANT: Always Use `pop: true` with `navigation.navigate`

```typescript
// ✅ Correct - with pop: true
navigation.navigate(ERootRoutes.Main, {
  screen: ETabRoutes.Market,
}, {
  pop: true,
});

// ❌ Wrong - missing pop: true
navigation.navigate(ERootRoutes.Main, {
  screen: ETabRoutes.Market,
});
```

**Why `pop: true` is required:**
- Prevents navigation stack from growing indefinitely
- Ensures proper back button behavior
- Avoids memory leaks from accumulated screens

### ⚠️ WARNING: `pop: true` Can Cause iOS Tab Freeze

When `navigate(pop: true)` is called and the target tab's inner stack has pages to pop, the popped pages' `RNSScreenStack` instances get detached from the iOS window hierarchy (`window=NIL`). These orphaned stacks enter a retry storm (50 retries × 100ms × multiple timers), blocking the native main thread for ~5 seconds and freezing the tab transition.

**Symptom**: Tab switch appears stuck; the user must touch the screen to advance the route.

**Root cause**: `pop: true` pops the target tab's inner stack back to root. If those pages contain nested `RNSScreenStack` (e.g., UrlAccountPage), the popped stacks lose their window and retry indefinitely.

**Mitigation**: Use `switchTabAsync()` instead of `switchTab()` when an overlay might be present. `switchTabAsync` serializes overlay dismiss + tab switch into two steps (resetAboveMainRoute → wait → navigate), avoiding the multi-transition overlap that creates orphan stacks:

```typescript
// ❌ WRONG: switchTab uses navigate(Main, {pop:true}) which overlaps
// modal dismiss + tab switch + Main re-attach in one UIKit tick
navigation.switchTab(ETabRoutes.Home);  // creates orphan RNSScreenStack
navigation.push(newPage);               // pushes into unstable state

// ✅ CORRECT: switchTabAsync serializes overlay dismiss and tab switch
await navigation.switchTabAsync(ETabRoutes.Home);  // dismiss → wait → switch
navigation.push(newPage);                          // safe — tab is settled
```

> **Note**: `switchTab` is marked `@deprecated`. For new code, always use `switchTabAsync`. Old fire-and-forget call sites (tab bar press, bootstrap) can keep `switchTab` since they never have an active overlay.

---

## Native Tab View Navigation Safety

### ⚠️ CRITICAL: Overlay Dismissal with Native UITabBarController

When the app uses native `UITabBarController` (`@onekeyfe/react-native-tab-view`), **non-selected tabs' views are removed from the iOS window hierarchy**. This means any `RNSScreenStack` inside an inactive tab has `window=NIL` and cannot process navigation updates.

**Problem**: Calling `goBack()` to pop overlay routes (Modal, FullScreenPush) triggers React Navigation to reconcile nested stacks inside those routes. If a nested stack is inside a tab that has lost its window, the native `setPushViewControllers` is SKIPPED and retries 50 times (~5 seconds) before giving up. The navigation appears frozen until the user touches the screen.

**Rule**: When navigating from an overlay route to a tab page, **never use `switchTab()` (deprecated) or sequential `goBack()` calls**. Use `switchTabAsync()` or `navigateFromOverlayToTab()` instead.

```typescript
// ❌ WRONG: switchTab overlaps modal dismiss + tab switch + re-attach
navigation.switchTab(ETabRoutes.Home);  // navigate(Main, {pop:true}) = 3 UIKit transitions at once
navigation.push(targetPage);            // orphan stacks accumulate

// ❌ WRONG: Sequential goBack() causes window-nil race condition
await popScanModalPages();
await popActionCenterPages();
navigation.switchTab(ETabRoutes.Home);

// ✅ CORRECT: switchTabAsync serializes everything
await navigation.switchTabAsync(ETabRoutes.Home);  // reset overlay → wait → switch tab
navigation.push(targetPage);                        // safe

// ✅ ALSO CORRECT: navigateFromOverlayToTab (uses switchTabAsync internally)
await navigateFromOverlayToTab({
  targetTab: ETabRoutes.Home,
});
navigation.push(targetPage);
```

**Key utilities** (exported from `@onekeyhq/components`):
- `switchTabAsync()` — Async tab switch that serializes overlay dismiss + tab switch; **preferred for all new code**
- `navigateFromOverlayToTab()` — Convenience wrapper around `switchTabAsync`
- `resetAboveMainRoute()` — Atomically remove all routes above Main via `CommonActions.reset`
- `switchTab()` — **@deprecated**, synchronous, uses `navigate(Main, {pop:true})` which overlaps UIKit transitions

### Why `switchTab()` alone cannot activate the target tab

When overlay routes (FullScreenPush, Modal) are stacked above Main, calling `switchTab()` only changes `UITabBarController.selectedIndex` internally. The target tab's view is **NOT** added to the window hierarchy because the overlay route's view is still the topmost visible layer. The `UITabBarController` only manages views within its own container — if that container is obscured by an overlay, the tab view stays detached.

```
Root State: [Main, FullScreenPush, Modal]
                    ↑ overlay is topmost visible view
                    UITabBarController's tab views are underneath, not in window

switchTab(Home) → selectedIndex changes, but Home tab's view still has window=NIL
goBack() to pop FullScreenPush → nested stack update fails (window=NIL)
```

Therefore, **use `switchTabAsync()` which handles this automatically**: it calls `resetAboveMainRoute()` first when an overlay is detected, waits for settle, then navigates to the target tab.

**When to watch out**:
- Any code that calls `goBack()` on root navigator while a FullScreenPush or Modal is active
- Any flow that dismisses overlay pages and then navigates to a different tab
- Cross-tab navigation after closing settings/action center pages
- **Repeated modal open → dismiss + tab switch cycles** (e.g., UniversalSearch → pick DApp → Discovery tab × N times): each cycle creates an orphan RNSScreenStack if overlay dismiss and tab switch overlap

---

## Files Reference

| Purpose | Location |
|---------|----------|
| Page type enum | `packages/components/src/hocs/PageType/pageType.ts` |
| Modal routes | `packages/kit/src/routes/Modal/router.tsx` |
| Tab routes | `packages/kit/src/routes/Tab/router.ts` |
| Onboarding routes | `packages/kit/src/views/Onboardingv2/router/index.tsx` |
| Route enums | `packages/shared/src/routes/` |
| URL allow list | `packages/shared/src/utils/routeUtils.ts` |
| Route config (linking) | `packages/kit/src/routes/config/index.ts` |
| Deep link config | `packages/kit/src/routes/config/deeplink/index.ts` |
| Page component | `packages/components/src/layouts/Page/index.tsx` |
