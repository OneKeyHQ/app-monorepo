---
name: page-and-route
description: Helps create and configure pages and routes in the OneKey app-monorepo. Use when creating new pages, configuring routes, setting up deep links, handling QR codes, or understanding navigation patterns. Page, route, navigation, deep link, universal link, QR code, modal, tab, onboarding.
---

# Page and Route Skill

This skill helps create and configure pages and routes in the OneKey app-monorepo.

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

This approach ensures:
- Users accessing via old deep links are gracefully redirected
- No broken links or blank screens
- Analytics can track deprecated route access
- Backward compatibility is maintained

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

**Example: Creating AddExistingWallet page**

#### Step 1: Define Route Enum

In `packages/shared/src/routes/onboarding.ts`:
```typescript
export enum EOnboardingPagesV2 {
  GetStarted = 'GetStarted',
  AddExistingWallet = 'AddExistingWallet',
  // ... more pages
}
```

#### Step 2: Add to Router

In `packages/kit/src/views/Onboardingv2/router/index.tsx`:
```typescript
const AddExistingWallet = LazyLoadPage(
  () => import('../pages/AddExistingWallet'),
  undefined,
  false,
  <OnboardingLayoutFallback />,
);

export const OnboardingRouterV2: IModalFlowNavigatorConfig<
  EOnboardingPagesV2,
  IOnboardingParamListV2
>[] = [
  // ... other routes
  {
    name: EOnboardingPagesV2.AddExistingWallet,
    component: AddExistingWallet,
    options: hiddenHeaderOptions,
  },
];
```

### 3. Tab Route

Tab routes are configured in `packages/kit/src/routes/Tab/router.ts`.

**Example: Creating Market tab with sub-pages**

#### Step 1: Define Route Enum and Params

In `packages/shared/src/routes/tabMarket.ts`:
```typescript
export enum ETabMarketRoutes {
  TabMarket = 'TabMarket',
  MarketDetail = 'MarketDetail',
  MarketDetailV2 = 'MarketDetailV2',
  MarketNativeDetail = 'MarketNativeDetail',
  MarketBannerDetail = 'MarketBannerDetail',
}

export type ITabMarketParamList = {
  [ETabMarketRoutes.TabMarket]: { from?: EEnterWay } | undefined;
  [ETabMarketRoutes.MarketDetail]: { token: string };
  [ETabMarketRoutes.MarketDetailV2]: {
    tokenAddress: string;
    network: string;
    isNative?: boolean;
  };
  // ... more params
};
```

#### Step 2: Create Sub-Router

Create `packages/kit/src/routes/Tab/Marktet/router.ts`:
```typescript
import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import { LazyLoadRootTabPage, LazyLoadPage } from '../../../components/LazyLoadPage';

const MarketHome = LazyLoadRootTabPage(() => import('../../../views/Market/MarketHome'));
const MarketDetail = LazyLoadPage(() => import('../../../views/Market/MarketDetail'));

export const marketRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabMarketRoutes.TabMarket,
    headerShown: !platformEnv.isNative,
    component: MarketHome,
  },
  {
    name: ETabMarketRoutes.MarketDetail,
    component: MarketDetail,
    rewrite: '/tokens/:token',
  },
];
```

#### Step 3: Register in Tab Router

In `packages/kit/src/routes/Tab/router.ts`:
```typescript
import { marketRouters } from './Marktet/router';

export const useTabRouterConfig = () => {
  return useMemo(() => {
    const tabs = [
      {
        name: ETabRoutes.Market,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'ChartTrendingUp2Solid' : 'ChartTrendingUp2Outline',
        translationId: ETranslations.global_market,
        rewrite: '/market',
        exact: true,
        children: marketRouters,
        // Control visibility per platform
        hiddenIcon: platformEnv.isNative, // Hide on mobile
      },
      // ... other tabs
    ];
    return tabs;
  }, []);
};
```

**Tab Configuration Options:**
- `hiddenIcon`: Hide tab icon on certain platforms
- `hideOnTabBar`: Hide from tab bar but keep route accessible
- `inMoreAction`: Show in "More" menu instead of main tab bar
- `freezeOnBlur`: Keep tab state when switching tabs

## Configuring Page Paths

### ⚠️ WARNING: Route Paths Must Be Unique

**Route paths MUST NOT be duplicated.** Each route path must be unique across the entire application.

If duplicate paths are detected, the application will throw an error at startup:

```
Found conflicting screens with the same pattern. The pattern '/market/tokens/.'
resolves to both 'Main > Market > MarketDetail' and 'Main > Market > MarketDetailV2'.
Patterns must be unique and cannot resolve to more than one screen.
```

**Common causes of duplicate paths:**
- Two routes using the same `rewrite` value
- Forgetting to update path when copying route configuration
- Child routes with identical path segments

**How to avoid:**
- Always use unique `rewrite` values for each route
- When adding similar routes, differentiate paths (e.g., `/token/:network` vs `/token/:network/:tokenAddress`)
- Run the app locally to verify no path conflicts before committing

### URL Path Configuration

Route paths are calculated in `packages/kit/src/routes/config/index.ts` via `resolveScreens`.

#### resolveScreens Function

```typescript
interface IScreenRouterConfig {
  name: string;      // Route name (used as default path segment)
  rewrite?: string;  // Override path segment
  exact?: boolean;   // If true, ignores parent paths and uses only rewrite
  children?: IScreenRouterConfig[];
}

// resolveScreens transforms route config into path config
const resolveScreens = (routes: IScreenRouterConfig[]) =>
  routes.reduce((prev, route) => {
    prev[route.name] = {
      path: route.rewrite ? route.rewrite : route.name,  // Use rewrite or name as path
      exact: !!route.exact,
    };
    if (route.children) {
      prev[route.name].screens = resolveScreens(route.children);  // Recursive for children
    }
    return prev;
  }, {});
```

**How it works:**
1. Each route's `name` becomes its key in the config
2. The `path` is either `rewrite` value (if provided) or `name`
3. `exact` flag determines if parent paths are included
4. Children routes are processed recursively

#### Path Calculation Rules

**Rule 1: Default path accumulation**
Without any configuration, paths accumulate based on route hierarchy:
```
Route: Main -> Market -> MarketDetail
Path:  /Main/Market/MarketDetail
```

**Rule 2: `rewrite` replaces current segment only**
```typescript
// Tab router config
{
  name: ETabRoutes.Market,
  rewrite: '/market',     // Replaces 'Market' with 'market'
  children: marketRouters,
}

// Result: /Main/market/... (only current segment changed)
```

**Rule 3: `exact: true` truncates all parent paths**
```typescript
{
  name: EModalRoutes.SettingModal,
  children: ModalSettingStack,
  rewrite: '/settings',
  exact: true,            // Ignores /Modal prefix
}

// Without exact: /Modal/settings/...
// With exact:    /settings/...
```

**Rule 4: Path params with `/:param` syntax**
```typescript
// In marketRouters
{
  name: ETabMarketRoutes.MarketDetail,
  component: MarketDetail,
  rewrite: '/tokens/:token',  // :token is a path parameter
}

// Result path pattern: /market/tokens/:token
// Actual URL example:  /market/tokens/bitcoin
```

#### Complete Examples

**Example 1: Tab Route with rewrite + exact**
```typescript
// Tab router (packages/kit/src/routes/Tab/router.ts)
{
  name: ETabRoutes.Market,
  rewrite: '/market',
  exact: true,              // Path starts from /market, not /Main/Market
  children: marketRouters,
}

// Sub-router (packages/kit/src/routes/Tab/Marktet/router.ts)
export const marketRouters = [
  {
    name: ETabMarketRoutes.TabMarket,
    rewrite: '/',           // Root of /market
    component: MarketHome,
  },
  {
    name: ETabMarketRoutes.MarketDetail,
    rewrite: '/tokens/:token',
    component: MarketDetail,
  },
];

// Resulting paths:
// TabMarket:     /market/
// MarketDetail:  /market/tokens/:token (e.g., /market/tokens/bitcoin)
```

**Example 2: Modal Route with exact**
```typescript
// Modal router (packages/kit/src/routes/Modal/router.tsx)
{
  name: EModalRoutes.SettingModal,
  children: ModalSettingStack,
  rewrite: '/settings',
  exact: true,
}

// Resulting path: /settings/... (not /Modal/settings/...)
```

**Example 3: Onboarding Route**
```typescript
// Onboarding router config
{
  name: EOnboardingV2Routes.OnboardingV2,
  rewrite: '/onboarding',
  exact: true,
  children: OnboardingRouterV2,
}

// Sub-routes
{
  name: EOnboardingPagesV2.GetStarted,
  rewrite: '/get-started',
  component: GetStarted,
}

// Resulting path: /onboarding/get-started
```

**Example 4: Native token detail (no tokenAddress in path)**
```typescript
{
  name: ETabMarketRoutes.MarketNativeDetail,
  component: MarketDetailV2,
  rewrite: '/token/:network',        // Only network, no token address
}

// URL example: /market/token/eth
```

**Example 5: Non-native token detail (with tokenAddress)**
```typescript
{
  name: ETabMarketRoutes.MarketDetailV2,
  component: MarketDetailV2,
  rewrite: '/token/:network/:tokenAddress',
}

// URL example: /market/token/eth/0x1234...
```

#### Path Calculation in buildAllowList

The `pagePath` template function in `routeUtils.ts` calculates full paths:

```typescript
function pagePath(_: TemplateStringsArray, ...screenNames: string[]): string {
  const path = screenNames.reduce((prev, screenName) => {
    const screen = screenConfig[screenName];
    const paths = screen.path.split('/:');
    const rawPath = removeExtraSlash(paths[0]);
    const screenPath = paths.length > 1 ? `${rawPath}/.` : rawPath;
    // If exact, use only current path; otherwise, accumulate
    return screen.exact ? screenPath : addPath(prev, screenPath);
  }, '');
  return `/${path}`;
}

// Usage:
pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.MarketDetail}`
// Result: /market/tokens/. (the /. indicates path params follow)
```

### URL Allow List (Browser Display)

By default, routes don't display in the browser URL bar. To enable URL display, configure in `packages/shared/src/utils/routeUtils.ts`:

```typescript
export const buildAllowList = (screens, perpDisabled, perpTabShowWeb) => {
  const rules = {
    // Show URL with parameters
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Market}${ETabMarketRoutes.MarketDetailV2}`]: {
      showUrl: true,      // Enable URL display
      showParams: true,   // Show query parameters
    },
    // Show URL without parameters
    [pagePath`${ERootRoutes.Main}${ETabRoutes.Swap}${ETabSwapRoutes.TabSwap}`]: {
      showUrl: true,
      showParams: false,  // Hide query parameters
    },
  };
  return rules;
};
```

**Note:** When adding new pages that need browser URL display, configure them in `buildAllowList`.

### Platform-Specific Routing: Web vs Extension

The routing implementation differs between web/native platforms and browser extension:

#### Web/Native: Standard Path Routing

File: `packages/kit/src/routes/config/getStateFromPath.ts`
```typescript
// Simply re-exports from React Navigation
export { getStateFromPath } from '@react-navigation/core';
```

**URL format:** `https://app.onekey.so/market/tokens/bitcoin`

#### Extension: Hash Routing

File: `packages/kit/src/routes/config/getStateFromPath.ext.ts`

The extension uses a **custom implementation** copied from `@react-navigation/core` with hash routing modifications. The file is marked with `// ---CHANGED Begin----` and `// ---CHANGED end----` comments to indicate customizations.

**Why custom implementation is needed:**
- Browser extensions load from local HTML files (e.g., `ui-expand-tab.html`)
- Standard path routing doesn't work with extension URL scheme
- Hash routing allows navigation without page reload

**Key customizations in `getStateFromPath.ext.ts`:**

```typescript
// 1. Store initial pathname for later use (line 98-100)
// ---CHANGED Begin----: initial path from url
let initialPath: string | undefined = globalThis.location.pathname;
// ---CHANGED end----

// 2. Extract path from hash instead of pathname (line 107-109)
export function getStateFromPath<ParamList extends {}>(
  path: string,
  options?: Options<ParamList>
): ResultState | undefined {
  // ---CHANGED Begin----: support hash router
  path = globalThis.location.hash.split('#').pop() || '/';
  // ---CHANGED end----
  // ... rest of function
}

// 3. Rewrite initial path for focused route (line 731-736)
// In createNestedStateObject function:
route = findFocusedRoute(state) as ParsedRoute;
// ---CHANGED Begin----: rewrite hash path to initial path
if (initialPath) {
  route.path = initialPath;
  initialPath = undefined;
}
// ---CHANGED end----
```

**URL format returned (in `index.ts` line 139):**
```typescript
return `${extHtmlFileUrl}#${newPath}`;
// Example: /ui-expand-tab.html#/market/tokens/bitcoin
```

**URL format comparison:**

| Platform | URL Format |
|----------|------------|
| Web | `https://app.onekey.so/market/tokens/bitcoin` |
| Extension | `chrome-extension://xxx/ui-expand-tab.html#/market/tokens/bitcoin` |

**Important notes for extension routing:**

1. The `#` symbol separates the HTML file from the route path
2. Windows Chrome has specific requirements (line 131-137 in index.ts):
   ```typescript
   // /ui-expand-tab.html/#/   NOT working for Windows Chrome
   // /ui-expand-tab.html#/    works fine
   ```
3. When developing extension-specific routes, test on both Mac and Windows Chrome

#### Extension Routing Modifications Summary

The `getStateFromPath.ext.ts` file contains 4 key modifications from the original `@react-navigation/core` implementation:

| # | Location | Modification | Functional Impact |
|---|----------|--------------|-------------------|
| 1 | Lines 33-37 | Import changes | Uses `OneKeyLocalError` instead of native Error; imports utilities from `@react-navigation/core` |
| 2 | Lines 98-100 | `let initialPath = globalThis.location.pathname` | Stores HTML file path (e.g., `/ui-expand-tab.html`) for later use in route state |
| 3 | Lines 107-109 | `path = globalThis.location.hash.split('#').pop()` | **Core change**: Extracts route path from URL hash instead of using passed parameter |
| 4 | Lines 731-736 | Rewrite `route.path` with `initialPath` | Sets focused route's path to initial HTML file path for proper state management |

**Why these modifications are necessary:**
- Browser extensions run from local HTML files, not a web server
- Standard path routing (`/market/tokens/btc`) doesn't work with `chrome-extension://` URLs
- Hash routing (`#/market/tokens/btc`) allows client-side navigation without server requests
- The initial path storage ensures the extension knows its base HTML file location

#### Route Path Output by Platform

In `packages/kit/src/routes/config/index.ts`, the `getPathFromState` function handles platform differences:

```typescript
getPathFromState(state, options) {
  // ... calculate path ...

  if (platformEnv.isExtension) {
    // Extension: return hash-based URL
    if (newPath === '/' && globalThis.location.href.endsWith('#/')) {
      return extHtmlFileUrl;  // e.g., /ui-expand-tab.html
    }
    return `${extHtmlFileUrl}#${newPath}`;  // e.g., /ui-expand-tab.html#/market
  }

  // Web/Desktop: return standard path
  return newPath;  // e.g., /market
}
```

## Page Lifecycle

The `Page` component supports lifecycle callbacks defined in `packages/components/src/layouts/Page/type.ts`:

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

**Usage in Page Component:**
```typescript
import { Page } from '@onekeyhq/components';

function MyPage() {
  return (
    <Page
      onMounted={() => console.log('Page mounted')}
      onUnmounted={() => console.log('Page unmounted')}
      shouldRedirect={() => !hasPermission}
      onRedirected={() => navigation.navigate('Login')}
    >
      <Page.Body>{/* content */}</Page.Body>
    </Page>
  );
}
```

**Use Cases:**

| Callback | Use Case |
|----------|----------|
| `onMounted` | Load data, start animations, track page views |
| `onUnmounted` | Cleanup resources, cancel requests |
| `onClose` | Save draft, confirm unsaved changes |
| `onCancel` | Track cancel actions, cleanup form state |
| `onConfirm` | Track confirm actions, submit data |
| `shouldRedirect` | Auth guards, permission checks |
| `onRedirected` | Navigate to login, show toast |

**Redirect Pattern:**
```typescript
<Page
  shouldRedirect={() => {
    // Return true to immediately go back and trigger onRedirected
    return !isUserAuthenticated;
  }}
  onRedirected={() => {
    // Called after going back, navigate to appropriate screen
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.Login,
    });
  }}
>
```

## Deep Link / Universal Link Configuration

Configure in `packages/kit/src/routes/config/deeplink/index.ts`:

**Example: Adding invite_share deep link**

#### Step 1: Define Deep Link Path

In `packages/shared/src/consts/deeplinkConsts.tsx`:
```typescript
export enum EOneKeyDeepLinkPath {
  url_account = 'url_account',
  market_detail = 'market_detail',
  invite_share = 'invite_share',  // Add new path
}

export type IEOneKeyDeepLinkParams = {
  [EOneKeyDeepLinkPath.invite_share]: {
    utm_source: string;
    code: string;
  };
};
```

#### Step 2: Handle Deep Link

In `packages/kit/src/routes/config/deeplink/index.ts`:
```typescript
async function processDeepLinkUrlAccount(params, times = 0) {
  const { parsedUrl } = params;
  const { hostname, queryParams, scheme, path } = parsedUrl;

  if (scheme === ONEKEY_APP_DEEP_LINK || scheme === ONEKEY_APP_DEEP_LINK_NAME) {
    switch (hostname ?? path?.slice(1)) {
      case EOneKeyDeepLinkPath.invite_share: {
        const { utm_source: utmSource, code } = queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.invite_share];
        if (navigation) {
          navigation.switchTab(ETabRoutes.ReferFriends, {
            screen: ETabReferFriendsRoutes.TabReferAFriend,
            params: { utmSource, code },
          });
        }
        break;
      }
    }
  }
}
```

**Deep Link Format:**
- `onekey-wallet://invite_share?utm_source=twitter&code=ABC123`
- `https://app.onekey.so/wc/connect/wc?uri=...` (Universal Link)

## QR Code / Banner Click Navigation

Configure QR code handlers for scanning and banner clicks.

**Example: MARKET_DETAIL handler**

#### Step 1: Define Handler Type

In `packages/shared/types/qrCode.ts`:
```typescript
export enum EQRCodeHandlerType {
  MARKET_DETAIL = 'MARKET_DETAIL',
  // ... other types
}

export enum EQRCodeHandlerNames {
  marketDetail = 'marketDetail',
  // ... other names
}

export const PARSE_HANDLER_NAMES = {
  all: [
    EQRCodeHandlerNames.marketDetail,
    // ... other handlers
  ],
};
```

#### Step 2: Create Handler

Create `packages/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/handlers/marketDetail.ts`:
```typescript
import { WEB_APP_URL, WEB_APP_URL_DEV, WEB_APP_URL_SHORT } from '@onekeyhq/shared/src/config/appConfig';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';
import type { IMarketDetailValue, IQRCodeHandler } from '../type';

const marketDetail: IQRCodeHandler<IMarketDetailValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue?.data?.urlParamList) {
    const origin = urlValue?.data?.origin;
    // Check if URL matches OneKey web app
    if (
      [WEB_APP_URL, WEB_APP_URL_DEV, WEB_APP_URL_SHORT].includes(origin) &&
      urlValue?.data?.pathname.startsWith('/market/tokens/')
    ) {
      const coinGeckoId = urlValue?.data?.pathname.split('/market/tokens/').pop();
      return {
        type: EQRCodeHandlerType.MARKET_DETAIL,
        data: { origin, coinGeckoId },
      };
    }
  }
  return null;
};

export default marketDetail;
```

#### Step 3: Register Handler

In `packages/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/handlers/index.ts`:
```typescript
import marketDetail from './marketDetail';

export const PARSE_HANDLERS = {
  [EQRCodeHandlerNames.marketDetail]: marketDetail,
  // ... other handlers
};
```

#### Step 4: Handle Result in UI

In `packages/kit/src/views/ScanQrCode/hooks/useParseQRCode.tsx`:
```typescript
const parse = useCallback(async (value, params) => {
  const result = await backgroundApiProxy.serviceScanQRCode.parse(value, options);

  switch (result.type) {
    case EQRCodeHandlerType.MARKET_DETAIL: {
      const { coinGeckoId } = result.data as IMarketDetailValue;
      if (coinGeckoId) {
        await closeScanPage();
        void marketNavigation.pushDetailPageFromDeeplink(navigation, { coinGeckoId });
      }
      break;
    }
  }
}, [navigation]);
```

## Navigation Methods

```typescript
// Push modal
navigation.pushModal(EModalRoutes.NotificationsModal, {
  screen: EModalNotificationsRoutes.NotificationList,
  params: { /* page params */ },
});

// Switch tab
navigation.switchTab(ETabRoutes.Market);

// Navigate within tab
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

When using `navigation.navigate`, **ALWAYS** include the `pop: true` option to ensure proper navigation stack management:

```typescript
// ✅ Correct - with pop: true
navigation.navigate(ERootRoutes.Main, undefined, {
  pop: true,
});

navigation.navigate(ERootRoutes.Main, {
  screen: ETabRoutes.Market,
  params: {
    screen: ETabMarketRoutes.MarketDetail,
    params: { token: 'bitcoin' },
  },
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
- Maintains consistent navigation state across platforms

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
| Web/Native path parser | `packages/kit/src/routes/config/getStateFromPath.ts` |
| Extension path parser | `packages/kit/src/routes/config/getStateFromPath.ext.ts` |
| Deep link config | `packages/kit/src/routes/config/deeplink/index.ts` |
| Deep link consts | `packages/shared/src/consts/deeplinkConsts.tsx` |
| QR handlers | `packages/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/handlers/` |
| Page component | `packages/components/src/layouts/Page/index.tsx` |
| Page lifecycle | `packages/components/src/layouts/Page/hooks.ts` |
