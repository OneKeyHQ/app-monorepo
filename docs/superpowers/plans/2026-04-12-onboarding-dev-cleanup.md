# Onboarding Dev Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Temporarily disable all non-onboarding code to maximize dev speed during onboarding v2 redesign.

**Architecture:** Surgical commenting in 5 existing files + 1 new placeholder component. All disabled code marked with `// [ONBOARDING-DEV]` for easy searchability. Recovery via single `git revert`.

**Tech Stack:** React Native, TypeScript, React Navigation, Jotai

**Parallelism:** Tasks 2-7 modify independent files and can run in parallel. Task 1 must complete before Task 2. Task 8 depends on all others.

---

### Task 1: Create Placeholder Home Component

**Files:**
- Create: `packages/kit/src/views/Home/pages/OnboardingDevPlaceholder.tsx`

- [ ] **Step 1: Create the placeholder component**

```tsx
import { useCallback } from 'react';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

function OnboardingDevPlaceholder() {
  const navigation = useAppNavigation();

  const handleReenterOnboarding = useCallback(() => {
    navigation.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.GetStarted,
      },
    });
  }, [navigation]);

  const handleClearAndRestart = useCallback(async () => {
    await backgroundApiProxy.serviceApp.resetApp();
  }, []);

  return (
    <Page>
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        gap="$4"
        p="$4"
      >
        <SizableText size="$headingXl">Onboarding Dev Mode</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          Placeholder for onboarding redesign development.
        </SizableText>
        <YStack gap="$3" w="100%" maxWidth={300} pt="$4">
          <Button size="large" onPress={handleReenterOnboarding}>
            Re-enter Onboarding
          </Button>
          <Button
            size="large"
            variant="destructive"
            onPress={handleClearAndRestart}
          >
            Clear Data & Restart
          </Button>
        </YStack>
      </YStack>
    </Page>
  );
}

export default OnboardingDevPlaceholder;
```

---

### Task 2: Replace Home Router

**Files:**
- Modify: `packages/kit/src/views/Home/router/index.ts`

- [ ] **Step 1: Comment out original content and add dev version**

Replace the entire file content with:

```ts
// [ONBOARDING-DEV] Original home router commented out for onboarding dev mode
// To restore: git revert this commit

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const OnboardingDevPlaceholder = LazyLoadPage(
  () => import('../pages/OnboardingDevPlaceholder'),
);

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: OnboardingDevPlaceholder,
    rewrite: '/',
  },
];

/* [ONBOARDING-DEV] Original content below:
import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';
import { urlAccountLandingRewrite } from '../pages/urlAccount/urlAccountUtils';

const HomePageContainer = LazyLoadPage(
  () => import('../pages/HomePageContainer'),
);

const UrlAccountPageContainer = LazyLoadPage(async () => {
  const { UrlAccountPageContainer: UrlAccountPageContainerModule } =
    await import('../pages/urlAccount/UrlAccountPage');
  return { default: UrlAccountPageContainerModule };
});

const UrlAccountLanding = LazyLoadPage(async () => {
  const { UrlAccountLanding: UrlAccountLandingModule } =
    await import('../pages/urlAccount/UrlAccountPage');
  return { default: UrlAccountLandingModule };
});

const ReferralLanding = LazyLoadPage(async () => {
  const { ReferralLandingPage } =
    await import('../pages/referralLanding/ReferralLandingPage');
  return { default: ReferralLandingPage };
});

const BulkSendAddressesInput = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAddressesInput'),
);

const BulkSendAmountsInput = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendAmountsInput'),
);

const BulkSendProcess = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/BulkSend/pages/BulkSendProcess'),
);

const ApprovalListPage = LazyLoadPage(
  () => import('../pages/ApprovalListPage'),
);

export const urlAccountRoutes = [
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
  },
];

export const referralLandingRewrite = '/r/:code/app/:page';
export const referralLandingRewriteWithoutPage = '/r/:code/app';
export const referralLandingRewriteCodeOnly = '/r/:code';

export const homeRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabHomeRoutes.TabHome,
    component: HomePageContainer,
    rewrite: '/',
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccountLanding,
    component: UrlAccountLanding,
    rewrite: urlAccountLandingRewrite,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeUrlAccountPage,
    component: UrlAccountPageContainer,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeReferralLanding,
    component: ReferralLanding,
    rewrite: referralLandingRewrite,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeReferralLandingWithoutPage,
    component: ReferralLanding,
    rewrite: referralLandingRewriteWithoutPage,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeReferralLandingCodeOnly,
    component: ReferralLanding,
    rewrite: referralLandingRewriteCodeOnly,
    exact: true,
  },
  {
    name: ETabHomeRoutes.TabHomeBulkSendAddressesInput,
    component: BulkSendAddressesInput,
    exact: true,
    rewrite: '/bulk-send-addresses',
  },
  {
    name: ETabHomeRoutes.TabHomeBulkSendAmountsInput,
    component: BulkSendAmountsInput,
    rewrite: '/bulk-send-amounts',
  },
  {
    name: ETabHomeRoutes.TabHomeBulkSendProcess,
    component: BulkSendProcess,
    rewrite: '/bulk-send-process',
  },
  {
    name: ETabHomeRoutes.TabHomeApprovalList,
    component: ApprovalListPage,
    exact: true,
    rewrite: '/approval-list',
  },
];
*/
```

---

### Task 3: Simplify Tab Router

**Files:**
- Modify: `packages/kit/src/routes/Tab/router.ts`

- [ ] **Step 1: Comment out unused imports and replace function**

Replace the entire file content with:

```ts
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useMemo } from 'react';

import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { homeRouters } from '../../views/Home/router';

import type { INativeTabBarIcon } from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';

// [ONBOARDING-DEV] Only wallet icon kept for placeholder Home tab
const nativeTabIcons = {
  wallet: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/wallet-4.svg')
      : require('@onekeyhq/components/svg/outline/wallet-4.svg'),
};

type IGetTabRouterParams = {
  freezeOnBlur?: boolean;
};

// [ONBOARDING-DEV] Simplified: only Home tab for onboarding dev mode
export const useTabRouterConfig = (params?: IGetTabRouterParams) =>
  useMemo(
    () =>
      [
        {
          name: ETabRoutes.Home,
          tabBarIcon: (focused?: boolean) =>
            focused ? 'Wallet4Solid' : 'Wallet4Outline',
          nativeTabBarIcon: nativeTabIcons.wallet,
          translationId: ETranslations.global_wallet,
          freezeOnBlur: Boolean(params?.freezeOnBlur),
          rewrite: '/',
          exact: true,
          children: homeRouters,
          trackId: 'global-wallet',
        },
      ] as ITabNavigatorConfig<ETabRoutes>[],
    [params?.freezeOnBlur],
  );

// [ONBOARDING-DEV] disabled
export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  undefined;

/* [ONBOARDING-DEV] Original content below:
import { useCallback, useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';

import { rootNavigationRef, useMedia } from '@onekeyhq/components';
import type {
  INativeTabBarIcon,
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import { usePerpTabConfig } from '../../hooks/usePerpTabConfig';
import { developerRouters } from '../../views/Developer/router';
import { useDeviceManagerModalStyle } from '../../views/DeviceManagement/hooks/useDeviceManagerModalStyle';
import { homeRouters } from '../../views/Home/router';
import { perpRouters } from '../../views/Perp/router';
import { perpTradeRouters as perpWebviewRouters } from '../../views/PerpTrade/router';

import { deviceManagementRouters } from './DeviceManagement/router';
import { discoveryRouters } from './Discovery/router';
import { earnRouters } from './Earn/router';
import { marketRouters } from './Marktet/router';
import { multiTabBrowserRouters } from './MultiTabBrowser/router';
import { referFriendsRouters } from './ReferFriends/router';
import { swapRouters } from './Swap/router';

const nativeTabIcons = {
  wallet: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/wallet-4.svg')
      : require('@onekeyhq/components/svg/outline/wallet-4.svg'),
  swap: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/switch-hor.svg')
      : require('@onekeyhq/components/svg/outline/switch-hor.svg'),
  discover: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/compass.svg')
      : require('@onekeyhq/components/svg/outline/compass.svg'),
  market: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/trading-view-candles.svg')
      : require('@onekeyhq/components/svg/outline/trading-view-candles.svg'),
  perp: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/trade.svg')
      : require('@onekeyhq/components/svg/outline/trade.svg'),
  earn: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/coins.svg')
      : require('@onekeyhq/components/svg/outline/coins.svg'),
  developer: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/code-brackets.svg')
      : require('@onekeyhq/components/svg/outline/code-brackets.svg'),
};

type IGetTabRouterParams = {
  freezeOnBlur?: boolean;
};

const getDiscoverRouterConfig = (
  params?: IGetTabRouterParams,
  tabBarStyle?: ITabNavigatorConfig<ETabRoutes>['tabBarStyle'],
): ITabNavigatorConfig<ETabRoutes> => ({
  name: ETabRoutes.Discovery,
  rewrite: '/discovery',
  exact: true,
  tabBarIcon: (focused?: boolean) =>
    focused ? 'CompassSolid' : 'CompassOutline',
  nativeTabBarIcon: nativeTabIcons.discover,
  translationId: platformEnv.isNative
    ? ETranslations.global_discover
    : ETranslations.global_browser,
  freezeOnBlur: Boolean(params?.freezeOnBlur),
  children: discoveryRouters,
  tabBarStyle,
  trackId: 'global-browser',
});

export const useTabRouterConfig = (params?: IGetTabRouterParams) => {
  const { md } = useMedia();
  const { isModalStack } = useDeviceManagerModalStyle();
  const isShowDesktopDiscover = platformEnv.isDesktop;
  const isWebDappMode = platformEnv.isWebDappMode;
  const isShowMDDiscover =
    !isShowDesktopDiscover &&
    !platformEnv.isWebDappMode &&
    !platformEnv.isExtensionUiPopup &&
    !(platformEnv.isExtensionUiSidePanel && md);
  const shouldShowMarketTab = !(
    platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel
  );
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  const handleMarketTabPress = useCallback(() => {
    const nav = rootNavigationRef.current;
    if (nav) {
      nav.dispatch(
        CommonActions.navigate({
          name: ETabRoutes.Market,
          params: { screen: ETabMarketRoutes.TabMarket },
          pop: true,
        }),
      );
    }
  }, []);
  const referFriendsTabConfig = useMemo(
    () => ({
      name: ETabRoutes.ReferFriends,
      tabBarIcon: (focused?: boolean) =>
        focused ? 'GiftSolid' : 'GiftOutline',
      translationId: ETranslations.sidebar_refer_a_friend,
      rewrite: '/refer-friends',
      exact: true,
      children: referFriendsRouters,
      trackId: 'global-referral',
      freezeOnBlur: Boolean(params?.freezeOnBlur),
    }),
    [params?.freezeOnBlur],
  );
  return useMemo(() => {
    const tabs = [
      {
        name: ETabRoutes.Home,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'Wallet4Solid' : 'Wallet4Outline',
        nativeTabBarIcon: nativeTabIcons.wallet,
        translationId: ETranslations.global_wallet,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: isWebDappMode ? '/wallet' : '/',
        exact: true,
        children: homeRouters,
        trackId: 'global-wallet',
        hiddenIcon: isWebDappMode,
      },
      shouldShowMarketTab ? { ... Market config ... } : undefined,
      { ... Swap config ... },
      { ... WebviewPerpTrade config ... },
      { ... Perp config ... },
      { ... Earn config ... },
      platformEnv.isNative ? undefined : { ... DeviceManagement config ... },
      !platformEnv.isNative ? referFriendsTabConfig : undefined,
      isShowMDDiscover ? getDiscoverRouterConfig(params) : undefined,
      isShowDesktopDiscover ? getDiscoverRouterConfig(params) : undefined,
      platformEnv.isDev ? { ... Developer config ... } : undefined,
    ].filter((i) => !!i);
    if (isWebDappMode && tabs.length >= 2) { ... market reorder ... }
    return tabs;
  }, [ ... deps ... ]) as ITabNavigatorConfig<ETabRoutes>[];
};

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined = {
  name: ETabRoutes.MultiTabBrowser,
  children: multiTabBrowserRouters,
};
*/
```

---

### Task 4: Trim Modal Routes

**Files:**
- Modify: `packages/kit/src/routes/Modal/router.tsx`

- [ ] **Step 1: Comment out unused imports**

Add `// [ONBOARDING-DEV]` prefix and comment out these import lines:

```ts
// [ONBOARDING-DEV] import { ActionCenterRouter } from '../../views/ActionCenter/router';
// [ONBOARDING-DEV] import { ModalAddressBookRouter } from '../../views/AddressBook/router';
// [ONBOARDING-DEV] import { ModalApprovalManagementStack } from '../../views/ApprovalManagement/router';
// [ONBOARDING-DEV] import { AppUpdateRouter } from '../../views/AppUpdate/router';
// [ONBOARDING-DEV] import { BulkCopyAddressesModalRouter } from '../../views/BulkCopyAddresses/router';
// [ONBOARDING-DEV] import { BulkSendModalRouter } from '../../views/BulkSend/router';
// [ONBOARDING-DEV] import { DAppConnectionRouter } from '../../views/DAppConnection/router';
// [ONBOARDING-DEV] import { ModalDiscoveryStack } from '../../views/Discovery/router';
// [ONBOARDING-DEV] import { ModalFiatCryptoRouter } from '../../views/FiatCrypto/router';
// [ONBOARDING-DEV] import { LiteCardPages } from '../../views/LiteCard/router';
// [ONBOARDING-DEV] import { ManualBackupRouter } from '../../views/ManualBackup/router';
// [ONBOARDING-DEV] import { ModalMarketStack } from '../../views/Market/router';
// [ONBOARDING-DEV] import { NetworkDoctorModalRouter } from '../../views/NetworkDoctor/router';
// [ONBOARDING-DEV] import { ModalNotificationsRouter } from '../../views/Notifications/router';
// [ONBOARDING-DEV] import { ModalPerpStack } from '../../views/Perp/router';
// [ONBOARDING-DEV] import { PrimeRouter } from '../../views/Prime/router';
// [ONBOARDING-DEV] import { ModalReceiveStack } from '../../views/Receive/router';
// [ONBOARDING-DEV] import { ReferFriendsRouter } from '../../views/ReferFriends/router';
// [ONBOARDING-DEV] import { ModalSendStack } from '../../views/Send/router';
// [ONBOARDING-DEV] import { ShortcutsModalRouter } from '../../views/Shortcuts/router';
// [ONBOARDING-DEV] import { ModalSignAndVerifyRouter } from '../../views/SignAndVerifyMessage/router';
// [ONBOARDING-DEV] import { ModalSignatureConfirmStack } from '../../views/SignatureConfirm/router';
// [ONBOARDING-DEV] import { StakingModalRouter } from '../../views/Staking/router';
// [ONBOARDING-DEV] import { ModalSwapStack } from '../../views/Swap/router';
// [ONBOARDING-DEV] import { TestModalRouter } from '../../views/TestModal/router';
// [ONBOARDING-DEV] import { UniversalSearchRouter } from '../../views/UniversalSearch/router';
// [ONBOARDING-DEV] import { WalletAddressModalRouter } from '../../views/WalletAddress/router';
// [ONBOARDING-DEV] import { ModalWebViewStack } from '../../views/WebView/router';
```

- [ ] **Step 2: Comment out modal route entries in `router` array**

Keep these entries in the `router` array (lines 71-234):
- `MainModal` (EModalRoutes.MainModal)
- `SettingModal` (EModalRoutes.SettingModal)
- `AccountManagerStacks` (EModalRoutes.AccountManagerStacks)
- `onboardingRouterConfig` (EModalRoutes.OnboardingModal)
- `FirmwareUpdateModal` (EModalRoutes.FirmwareUpdateModal)
- `AssetSelectorModal` (EModalRoutes.AssetSelectorModal)
- `ChainSelectorModal` (EModalRoutes.ChainSelectorModal)
- `ScanQrCodeModal` (EModalRoutes.ScanQrCodeModal)
- `CloudBackupModal` (EModalRoutes.CloudBackupModal)
- `DeviceManagementModal` (EModalRoutes.DeviceManagementModal)
- `KeyTagModal` (EModalRoutes.KeyTagModal)

Comment out (with `// [ONBOARDING-DEV]`) these entries:
- `DiscoveryModal`, `SwapModal`, `PerpModal`, `MarketModal`, `PrimeModal`, `SendModal`, `SignatureConfirmModal`, `ReceiveModal`, `DAppConnectionModal`, `LiteCardModal`, `ManualBackupModal`, `WebViewModal`, `AddressBookModal`, `AppUpdateModal`, `FiatCryptoModal`, `UniversalSearchModal`, `StakingModal`, `WalletAddress`, `NotificationsModal`, `ShortcutsModal`, `ReferFriendsModal`, `BulkCopyAddressesModal`, `BulkSendModal`, `ApprovalManagementModal`, `SignAndVerifyModal`, `NetworkDoctorModal`

Also comment out the dev-mode `TestModal` push block (lines 237-242).

- [ ] **Step 3: Empty `fullModalRouter` and `fullScreenPushRouterConfig`**

Replace:
```ts
// [ONBOARDING-DEV] fullModalRouter disabled - no iOS full-screen modals needed
export const fullModalRouter: IModalRootNavigatorConfig<EModalRoutes>[] = [];

// [ONBOARDING-DEV] fullScreenPushRouterConfig disabled - no ActionCenter needed
export const fullScreenPushRouterConfig: IModalRootNavigatorConfig<EFullScreenPushRoutes>[] =
  [];
```

---

### Task 5: Trim Container Overlays

**Files:**
- Modify: `packages/kit/src/provider/Container/index.tsx`

- [ ] **Step 1: Comment out unused imports**

Add `// [ONBOARDING-DEV]` prefix and comment out:

```ts
// [ONBOARDING-DEV] import { WalletBackupPreCheckContainer } from '../../components/WalletBackup';
// [ONBOARDING-DEV] import { PrimeGlobalEffect } from '../../views/Prime/hooks/PrimeGlobalEffect';
// [ONBOARDING-DEV] import { ColdStartByNotification } from './ColdStartByNotification';
// [ONBOARDING-DEV] import { DiskFullWarningDialogContainer } from './DiskFullWarningDialogContainer';
// [ONBOARDING-DEV] import { ForceFirmwareUpdateContainer } from './ForceFirmwareUpdateContainer';
// [ONBOARDING-DEV] import InAppNotification from './InAppNotification';
// [ONBOARDING-DEV] import { PrimeLoginContainerLazy } from './PrimeLoginContainer';
// [ONBOARDING-DEV] import { PrevCheckBeforeSendingContainer } from './PrevCheckBeforeSendingContainer';
// [ONBOARDING-DEV] import { RookieShareContainer } from './RookieShareContainer';
// [ONBOARDING-DEV] import { VerifyTxContainer } from './VerifyTxContainer';
// [ONBOARDING-DEV] import { WebPerformanceMonitorContainer } from './WebPerformanceMonitor';
```

Also comment out the `PageTrackerContainer` lazy load (line 43-46):
```ts
// [ONBOARDING-DEV] const PageTrackerContainer = LazyLoad(
//   () => import('./PageTrackerContainer'),
//   100,
// );
```

- [ ] **Step 2: Comment out components in `DetailRouter`**

In the `DetailRouter` function, comment out these JSX lines:

```tsx
function DetailRouter() {
  return (
    <NavigationContainer>
      {/* [ONBOARDING-DEV] <InAppNotification /> */}
      <GlobalRootAppNavigationUpdate />
      <JotaiContextRootProvidersAutoMount />
      <Bootstrap />
      <FullWindowOverlayContainer />
      <AirGapQrcodeDialogContainer />
      <CreateAddressContainer />
      {/* [ONBOARDING-DEV] <PrevCheckBeforeSendingContainer /> */}
      {/* [ONBOARDING-DEV] <WalletBackupPreCheckContainer /> */}
      {/* [ONBOARDING-DEV] <VerifyTxContainer /> */}
      <HardwareUiStateContainer />
      {/* [ONBOARDING-DEV] <PrimeLoginContainerLazy /> */}
      <KeylessWalletContainerLazy />
      <KeylessWebAutoConnectHashCleanupContainer />
      <DialogLoadingContainer />
      {/* [ONBOARDING-DEV] <DiskFullWarningDialogContainer /> */}
      <CloudBackupContainer />

      {/* [ONBOARDING-DEV] <PageTrackerContainer /> */}
      <ErrorToastContainer />
      <GlobalErrorHandlerContainer />
      {/* [ONBOARDING-DEV] <ForceFirmwareUpdateContainer /> */}
      {/* [ONBOARDING-DEV] <ColdStartByNotification /> */}
      {/* [ONBOARDING-DEV] <PrimeGlobalEffect /> */}
      {/* [ONBOARDING-DEV] <WebPerformanceMonitorContainer /> */}
      <PasswordVerifyPortalContainer />
      {/* [ONBOARDING-DEV] <RookieShareContainer /> */}
    </NavigationContainer>
  );
}
```

---

### Task 6: Trim Bootstrap Hooks

**Files:**
- Modify: `packages/kit/src/provider/Bootstrap.tsx`

- [ ] **Step 1: Comment out hook calls in `Bootstrap()` function**

In the `Bootstrap` function body (around lines 816-826), comment out these calls:

```ts
  useFetchCurrencyList();
  // [ONBOARDING-DEV] useFetchMarketBasicConfig();
  // [ONBOARDING-DEV] useFetchPerpConfig();
  useAboutVersion();
  useDesktopEvents();
  // [ONBOARDING-DEV] useLaunchEvents();
  // [ONBOARDING-DEV] useCheckUpdateOnDesktop();
  // [ONBOARDING-DEV] useIntercomInit();
  // [ONBOARDING-DEV] useClearStorageOnExtension();
  // [ONBOARDING-DEV] useRemindDevelopmentBuildExtension();
  // [ONBOARDING-DEV] useTabletDetailView();
```

That's it for this file. The hook definitions remain (they're exported), so no import changes needed. Only the calls are disabled.

---

### Task 7: Trim ServiceBootstrap

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceBootstrap.ts`

- [ ] **Step 1: Comment out non-onboarding service calls**

In the `init()` method, comment out specific lines in the `Promise.all` and the void calls below it:

```ts
  public async init() {
    await localDb.readyDb;
    try {
      await this.backgroundApi.serviceSetting.initSystemLocale();
    } catch (error) {
      console.error(error);
    }
    try {
      await Promise.all([
        this.backgroundApi.serviceSetting.refreshLocaleMessages(),
        this.backgroundApi.walletConnect.initializeOnStart(),
        this.backgroundApi.serviceWalletConnect.dappSide.cleanupInactiveSessions(),
        // [ONBOARDING-DEV] this.backgroundApi.serviceSwap.syncSwapHistoryPendingList(),
        // [ONBOARDING-DEV] this.backgroundApi.serviceSetting.fetchReviewControl(),
        this.backgroundApi.servicePassword.addExtIntervalCheckLockStatusListener(),
        this.backgroundApi.serviceNotification.init(),
        // [ONBOARDING-DEV] this.backgroundApi.serviceToken.clearLastActiveTabNameData(),
      ]);
    } catch (error) {
      console.error(error);
    }

    // wait for local messages to be loaded
    // [ONBOARDING-DEV] void this.backgroundApi.serviceContextMenu.init();
    if (platformEnv.isExtension) {
      try {
        await this.backgroundApi.serviceDevSetting.initAnalytics();
      } catch (error) {
        console.error(error);
      }
    }
    // [ONBOARDING-DEV] void this.backgroundApi.serviceDevSetting.saveDevModeToSyncStorage();
    void this.backgroundApi.simpleDb.customTokens.migrateFromV1LegacyData();
    void this.backgroundApi.simpleDb.recentRecipients.migrateFromOldStorage();
    void this.backgroundApi.serviceAccount.migrateHdWalletsBackedUpStatus();
    void this.backgroundApi.serviceHistory.migrateFilterScamHistorySetting();
    void this.backgroundApi.serviceAccount.migrateHardwareLtcXPub();
    void this.backgroundApi.serviceSetting.migrateBTCFreshAddressSetting();
    void this.backgroundApi.serviceHardware.removeDeviceHomeScreen();
    // [ONBOARDING-DEV] void systemTimeUtils.startServerTimeInterval();
    // [ONBOARDING-DEV] void this.backgroundApi.serviceIpTable.init();
    void this.backgroundApi.serviceCloudBackupV2.init();
    // [ONBOARDING-DEV] void this.backgroundApi.serviceSetting
    //   .restoreFiatPaySiteWhitelistFromPersist()
    //   .then(() =>
    //     this.backgroundApi.serviceSetting.fetchFiatPaySiteWhitelist(),
    //   );
  }
```

---

### Task 8: Verify & Commit

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd packages/kit && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: no errors related to our changes (existing codebase errors are OK)

- [ ] **Step 2: Start desktop app and verify**

Run: `yarn app:desktop`

Verify:
1. App boots without crash
2. Onboarding screen appears (for new user) or Home placeholder appears (for existing wallet)
3. "Re-enter Onboarding" button navigates to onboarding GetStarted page
4. "Clear Data & Restart" button resets app and restarts
5. All onboarding paths load their pages (create wallet, import, hardware, etc.)

- [ ] **Step 3: Commit all changes as a single commit**

```bash
git add packages/kit/src/views/Home/pages/OnboardingDevPlaceholder.tsx \
  packages/kit/src/views/Home/router/index.ts \
  packages/kit/src/routes/Tab/router.ts \
  packages/kit/src/routes/Modal/router.tsx \
  packages/kit/src/provider/Container/index.tsx \
  packages/kit/src/provider/Bootstrap.tsx \
  packages/kit-bg/src/services/ServiceBootstrap.ts

git commit -m "chore: temporary onboarding-dev cleanup for redesign work

Disable non-onboarding routes, containers, and services to speed up
dev iteration. All changes marked with [ONBOARDING-DEV] comment.

To restore: git revert this commit"
```
