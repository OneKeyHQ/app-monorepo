# Onboarding Dev Cleanup - Design Spec

## Goal

Temporarily disable all non-onboarding code in the app to maximize dev speed during onboarding v2 redesign. Changes must be easily reversible via `git revert`.

## Constraints

- Platforms: iOS + Desktop
- All onboarding v2 paths must remain fully functional (create/import/hardware/WalletConnect/OneKey ID/iCloud Backup/KeyTag)
- Onboarding completion lands on a placeholder Home page
- Recovery: single `git revert <cleanup-commit>` to restore everything

## Approach

Surgical commenting in 5 key files + 1 new placeholder component. All commented lines marked with `// [ONBOARDING-DEV]` for searchability.

## Changes

### 1. Tab Routes (`packages/kit/src/routes/Tab/router.ts`)

**Keep**: Home tab only (replace children with placeholder component)

**Comment out**:
- Market, Swap, Perp, WebviewPerpTrade, Earn, DeviceManagement, ReferFriends, Discovery, Developer tabs
- `tabExtraConfig` (MultiTabBrowser)
- Related imports: `developerRouters`, `perpRouters`, `perpWebviewRouters`, `deviceManagementRouters`, `discoveryRouters`, `earnRouters`, `marketRouters`, `multiTabBrowserRouters`, `referFriendsRouters`, `swapRouters`
- `usePerpTabConfig` hook call
- `handleMarketTabPress` callback
- `referFriendsTabConfig` memo
- `isShowDesktopDiscover`, `isShowMDDiscover`, `shouldShowMarketTab` variables
- `isWebDappMode` market reorder logic
- Unused dependencies from useMemo

### 2. Modal Routes (`packages/kit/src/routes/Modal/router.tsx`)

**Keep** (onboarding dependencies):
- MainModal, AccountManagerStacks, OnboardingModal (v1 config), SettingModal, FirmwareUpdateModal, AssetSelectorModal, ChainSelectorModal, ScanQrCodeModal, CloudBackupModal, DeviceManagementModal, KeyTagModal

**Comment out** (~20 routes):
- DiscoveryModal, SwapModal, PerpModal, MarketModal, PrimeModal, SendModal, ReceiveModal, SignatureConfirmModal, FiatCryptoModal, StakingModal, UniversalSearchModal, NotificationsModal, ShortcutsModal, ReferFriendsModal, BulkCopyAddressesModal, BulkSendModal, ApprovalManagementModal, SignAndVerifyModal, NetworkDoctorModal, WalletAddress, AddressBookModal, WebViewModal, LiteCardModal, ManualBackupModal, DAppConnectionModal, AppUpdateModal
- Their corresponding imports
- `fullModalRouter` array (iOS full screen modals for Send/Receive/SignatureConfirm/DAppConnection/AppUpdate)
- `fullScreenPushRouterConfig` (ActionCenter)

### 3. Container (`packages/kit/src/provider/Container/index.tsx`)

**Keep** (onboarding dependencies):
- NavigationContainer, GlobalRootAppNavigationUpdate, JotaiContextRootProvidersAutoMount, Bootstrap, FullWindowOverlayContainer, AirGapQrcodeDialogContainer, CreateAddressContainer, HardwareUiStateContainer, KeylessWalletContainerLazy, KeylessWebAutoConnectHashCleanupContainer, DialogLoadingContainer, CloudBackupContainer, ErrorToastContainer, GlobalErrorHandlerContainer, PasswordVerifyPortalContainer, AppStateLockContainer, GlobalWalletConnectModalContainer

**Comment out**:
- InAppNotification
- PrevCheckBeforeSendingContainer
- WalletBackupPreCheckContainer
- VerifyTxContainer
- PrimeLoginContainerLazy
- PrimeGlobalEffect
- WebPerformanceMonitorContainer
- RookieShareContainer
- ColdStartByNotification
- ForceFirmwareUpdateContainer
- DiskFullWarningDialogContainer
- PageTrackerContainer

### 4. Bootstrap (`packages/kit/src/provider/Bootstrap.tsx`)

**Keep**:
- useFetchCurrencyList
- useAboutVersion
- useDesktopEvents
- useLogVersionInfo
- Boot Recovery logic
- Dev auto-navigation logic
- Performance monitor logic (dev mode)
- onboardingConnectWalletLoading reset

**Comment out**:
- useFetchMarketBasicConfig
- useFetchPerpConfig
- useLaunchEvents
- useCheckUpdateOnDesktop
- useIntercomInit
- useClearStorageOnExtension
- useRemindDevelopmentBuildExtension
- useTabletDetailView

### 5. ServiceBootstrap (`packages/kit-bg/src/services/ServiceBootstrap.ts`)

**Keep**:
- serviceSetting.initSystemLocale
- serviceSetting.refreshLocaleMessages
- walletConnect.initializeOnStart
- serviceWalletConnect.dappSide.cleanupInactiveSessions
- servicePassword.addExtIntervalCheckLockStatusListener
- serviceNotification.init
- serviceCloudBackupV2.init
- All DB migrations (conservative)

**Comment out**:
- serviceSwap.syncSwapHistoryPendingList
- serviceSetting.fetchReviewControl
- serviceToken.clearLastActiveTabNameData
- serviceContextMenu.init
- serviceDevSetting.initAnalytics
- serviceDevSetting.saveDevModeToSyncStorage
- systemTimeUtils.startServerTimeInterval
- serviceIpTable.init
- fiatPay whitelist restore & fetch

### 6. New: Placeholder Home Page

A minimal component at `packages/kit/src/views/Home/pages/OnboardingDevPlaceholder.tsx`:

- Centered layout with two buttons:
  1. **Re-enter Onboarding** - navigates to `ERootRoutes.Onboarding` > `EOnboardingV2Routes.OnboardingV2` > `EOnboardingPagesV2.GetStarted`
  2. **Clear Wallet Data & Restart** - calls wallet/account cleanup services, then navigates to onboarding
- Simple, functional, no styling beyond basic centering

## Recovery

```bash
git revert <cleanup-commit-hash>
```

All temporary changes are in a single dedicated commit, separate from any future onboarding redesign commits. The `[ONBOARDING-DEV]` marker in comments allows manual search if needed.

## Out of Scope

- No changes to `packages/shared` or `packages/kit-bg` beyond ServiceBootstrap
- No changes to the provider tree (`packages/kit/src/provider/index.tsx`)
- No changes to onboarding v2 code itself
- No environment variable or feature flag mechanism
