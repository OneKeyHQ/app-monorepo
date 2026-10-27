// Default-deny route classifier for PostHog Session Replay.
//
// Pure function over the root navigation state. Runs in the UI runtime only
// (native `main`, desktop renderer); it has no side effects and imports only
// route enums, so it is safe to unit test in isolation.
//
// Routes are keyed on (root route, modal-or-tab container, leaf) because leaf
// names collide across stacks (TxConfirm, TokenSelector, Buy, MarketDetail…).
// Anything not listed below is denied.

import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import {
  EAccountManagerStacksRoutes,
  EAssetSelectorRoutes,
  EChainSelectorPages,
  EModalAssetDetailRoutes,
  EModalAssetListRoutes,
  EModalFiatCryptoRoutes,
  EModalReceiveRoutes,
  EModalRewardCenterRoutes,
  EModalRoutes,
  EModalSendRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EModalSwapRoutes,
  EModalWalletAddressRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { EPrimeGiftPages } from '@onekeyhq/shared/src/routes/prime';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { EUniversalSearchSource } from '@onekeyhq/shared/types/search';

// safe:       in scope, record.
// inherit:    shared page (confirm, selectors); takes the class of the nearest
//             non-inherit route below it.
// sensitive:  secrets on screen; also blocks recording while it sits anywhere
//             in the visible stack (swipe-back / transitions can reveal it).
// thirdParty: DApps, provider web pages, external wallets.
// outOfScope: everything else (default).
export type IReplayRouteClass =
  | 'safe'
  | 'inherit'
  | 'sensitive'
  | 'thirdParty'
  | 'outOfScope';

export interface IReplayNavRoute {
  readonly name: string;
  readonly params?: unknown;
  readonly state?: IReplayNavState;
}

export interface IReplayNavState {
  readonly index?: number;
  readonly routes: readonly IReplayNavRoute[];
}

export interface IReplayRouteClassifierInput {
  // Root navigation state, as passed to NavigationContainer.onStateChange.
  state: IReplayNavState | undefined;
  // Native only: the Discovery tab currently shows its Earn header sub-tab
  // (settingsPersistAtom.selectedBrowserTab === global_earn). Otherwise the
  // Discovery home is the DApp browser.
  isDiscoveryEarnSelected: boolean;
}

export interface IReplayRouteFrame {
  key: string;
  routeClass: IReplayRouteClass;
}

export interface IReplayRouteDecision {
  allowed: boolean;
  // Human readable key of the visible route, plus the deciding route when it
  // differs. Route names only, never params.
  routeKey: string | undefined;
  // Class of the deciding (first non-inherit) frame.
  routeClass: IReplayRouteClass;
  topKey: string | undefined;
  decidingKey: string | undefined;
  sensitiveKey: string | undefined;
  // Visible frames, top first.
  frames: IReplayRouteFrame[];
}

interface ILeafContext {
  params: unknown;
  isDiscoveryEarnSelected: boolean;
}

export type IReplayLeafRule =
  | IReplayRouteClass
  | ((ctx: ILeafContext) => IReplayRouteClass);

export type IReplayLeafTable = Readonly<Record<string, IReplayLeafRule>>;

// A container either applies one class to every leaf, or looks leaves up in a
// table (missing leaf => outOfScope).
export type IReplayContainerRule = IReplayRouteClass | IReplayLeafTable;

const uniform = <T extends string>(
  values: readonly T[],
  routeClass: IReplayRouteClass,
): Record<T, IReplayRouteClass> =>
  Object.fromEntries(values.map((v) => [v, routeClass])) as Record<
    T,
    IReplayRouteClass
  >;

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export const onboardingV2PageTable: Record<
  EOnboardingPagesV2 | EPrimeGiftPages,
  IReplayRouteClass
> = {
  [EOnboardingPagesV2.GetStarted]: 'safe',
  [EOnboardingPagesV2.CreateNewWallet]: 'safe',
  [EOnboardingPagesV2.CreateOrImportWallet]: 'safe',
  [EOnboardingPagesV2.PickYourDevice]: 'safe',
  [EOnboardingPagesV2.ConnectYourDevice]: 'safe',
  // The camera view it opens is paused by the scanner component, not here.
  [EOnboardingPagesV2.ConnectQRCode]: 'safe',
  [EOnboardingPagesV2.ConnectKeystoneDevice]: 'safe',
  [EOnboardingPagesV2.CheckAndUpdate]: 'safe',
  [EOnboardingPagesV2.DeviceSetup]: 'safe',
  [EOnboardingPagesV2.FinalizeWalletSetup]: 'safe',

  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: 'sensitive',
  [EOnboardingPagesV2.SelectPrivateKeyNetwork]: 'sensitive',
  [EOnboardingPagesV2.BackupWalletReminder]: 'sensitive',
  [EOnboardingPagesV2.ShowRecoveryPhrase]: 'sensitive',
  [EOnboardingPagesV2.VerifyRecoveryPhrase]: 'sensitive',
  [EOnboardingPagesV2.ICloudBackupDetails]: 'sensitive',
  [EOnboardingPagesV2.ImportKeyTag]: 'sensitive',
  [EOnboardingPagesV2.KeyTagBackupDotMap]: 'sensitive',
  [EOnboardingPagesV2.KeyTagEnterPhrase]: 'sensitive',
  [EOnboardingPagesV2.CreatePin]: 'sensitive',
  [EOnboardingPagesV2.ConfirmPin]: 'sensitive',
  [EOnboardingPagesV2.VerifyPin]: 'sensitive',
  [EOnboardingPagesV2.CreatePasscode]: 'sensitive',

  [EOnboardingPagesV2.ConnectWalletSelectNetworks]: 'thirdParty',
  [EOnboardingPagesV2.ConnectExternalWallet]: 'thirdParty',
  [EOnboardingPagesV2.OneKeyIDLogin]: 'thirdParty',

  [EOnboardingPagesV2.ImportWatchedAccount]: 'outOfScope',
  [EOnboardingPagesV2.ICloudBackup]: 'outOfScope',
  [EOnboardingPagesV2.ResetPinGuide]: 'outOfScope',
  [EOnboardingPagesV2.NewPinCreated]: 'outOfScope',
  [EPrimeGiftPages.PrimeGift]: 'outOfScope',
};

export const onboardingV1PageTable: Record<
  EOnboardingPages,
  IReplayRouteClass
> = {
  [EOnboardingPages.ConnectYourDevice]: 'safe',
  [EOnboardingPages.ActivateDevice]: 'safe',
  [EOnboardingPages.ImportWalletOptions]: 'safe',
  [EOnboardingPages.FinalizeWalletSetup]: 'safe',

  [EOnboardingPages.BeforeShowRecoveryPhrase]: 'sensitive',
  [EOnboardingPages.RecoveryPhrase]: 'sensitive',
  [EOnboardingPages.VerifyRecoverPhrase]: 'sensitive',
  [EOnboardingPages.ImportRecoveryPhrase]: 'sensitive',
  [EOnboardingPages.ImportKeyTag]: 'sensitive',
  [EOnboardingPages.ImportPrivateKey]: 'sensitive',
  [EOnboardingPages.ImportCloudBackup]: 'sensitive',

  [EOnboardingPages.ConnectWallet]: 'thirdParty',
  [EOnboardingPages.ConnectWalletOptions]: 'thirdParty',
  [EOnboardingPages.ConnectWalletSelectNetworks]: 'thirdParty',

  [EOnboardingPages.GetStarted]: 'outOfScope',
  [EOnboardingPages.V4MigrationGetStarted]: 'outOfScope',
  [EOnboardingPages.V4MigrationPreview]: 'outOfScope',
  [EOnboardingPages.V4MigrationProcess]: 'outOfScope',
  [EOnboardingPages.V4MigrationDone]: 'outOfScope',
  [EOnboardingPages.OneKeyHardwareWallet]: 'outOfScope',
  [EOnboardingPages.ImportAddress]: 'outOfScope',
  [EOnboardingPages.DeviceManagementGuide]: 'outOfScope',
  [EOnboardingPages.PromptWebDeviceAccess]: 'outOfScope',
};

export const onboardingRootContainerTable: Record<
  EOnboardingV2Routes,
  IReplayContainerRule
> = {
  [EOnboardingV2Routes.OnboardingV2]: onboardingV2PageTable,
};

// ---------------------------------------------------------------------------
// Tabs (root `main`)
// ---------------------------------------------------------------------------

export const marketTabTable: Record<ETabMarketRoutes, IReplayRouteClass> =
  uniform(Object.values(ETabMarketRoutes), 'safe');

export const swapTabTable: Record<ETabSwapRoutes, IReplayRouteClass> = {
  [ETabSwapRoutes.TabSwap]: 'safe',
};

export const earnTabTable: Record<ETabEarnRoutes, IReplayRouteClass> = uniform(
  Object.values(ETabEarnRoutes),
  'safe',
);

export const perpPageTable: Record<EModalPerpRoutes, IReplayRouteClass> = {
  ...uniform(Object.values(EModalPerpRoutes), 'safe'),
  [EModalPerpRoutes.PerpsInviteeRewardModal]: 'outOfScope',
};

export const perpTabTable: IReplayLeafTable = {
  [ETabRoutes.Perp]: 'safe',
  ...perpPageTable,
};

export const homeTabTable: Record<ETabHomeRoutes, IReplayRouteClass> = {
  ...uniform(Object.values(ETabHomeRoutes), 'outOfScope'),
  [ETabHomeRoutes.TabHomeDustSweep]: 'safe',
};

const classifyDiscoveryHome = ({
  isDiscoveryEarnSelected,
}: ILeafContext): IReplayRouteClass =>
  isDiscoveryEarnSelected ? 'safe' : 'thirdParty';

// Native hosts the Earn home as a Discovery header sub-tab plus Earn/Borrow
// pages and Market redirects in the same stack. On desktop the Discovery home
// is the dashboard, which the caller reports as not-Earn.
export const discoveryTabTable: IReplayLeafTable = {
  [ETabDiscoveryRoutes.TabDiscovery]: classifyDiscoveryHome,
  ...earnTabTable,
  [ETabMarketRoutes.MarketDetailV2]: 'safe',
  [ETabMarketRoutes.MarketStockDetail]: 'safe',
  [ETabMarketRoutes.MarketBannerDetail]: 'safe',
};

export const tabContainerTable: Record<ETabRoutes, IReplayContainerRule> = {
  [ETabRoutes.Home]: homeTabTable,
  [ETabRoutes.Market]: marketTabTable,
  [ETabRoutes.Discovery]: discoveryTabTable,
  [ETabRoutes.Developer]: 'outOfScope',
  [ETabRoutes.Earn]: earnTabTable,
  [ETabRoutes.Swap]: swapTabTable,
  [ETabRoutes.Perp]: perpTabTable,
  [ETabRoutes.WebviewPerpTrade]: 'thirdParty',
  [ETabRoutes.MultiTabBrowser]: 'thirdParty',
  [ETabRoutes.DeviceManagement]: 'outOfScope',
  [ETabRoutes.ReferFriends]: 'outOfScope',
  [ETabRoutes.BulkSend]: 'outOfScope',
  [ETabRoutes.SubPage]: 'outOfScope',
};

// ---------------------------------------------------------------------------
// Modals (root `modal` and `iOSFullScreen`)
// ---------------------------------------------------------------------------

export const mainModalTable: IReplayLeafTable = {
  ...uniform(Object.values(EModalAssetListRoutes), 'outOfScope'),
  ...uniform(Object.values(EModalRewardCenterRoutes), 'outOfScope'),
  [ETabHomeRoutes.TabHomeUrlAccountPage]: 'outOfScope',
  [EModalAssetDetailRoutes.TokenDetails]: 'outOfScope',
  [EModalAssetDetailRoutes.NFTDetails]: 'outOfScope',
  [EModalAssetDetailRoutes.HistoryDetails]: 'outOfScope',
  [EModalAssetDetailRoutes.UTXODetails]: 'outOfScope',
  [EModalAssetDetailRoutes.KytRiskDetail]: 'outOfScope',
  [EModalAssetDetailRoutes.DeFiProtocolDetails]: 'safe',
  [EModalAssetDetailRoutes.DeFiProtocolAction]: 'safe',
  [EModalAssetDetailRoutes.MarketDetail]: 'safe',
  [EModalAssetDetailRoutes.MarketChart]: 'safe',
};

export const swapModalTable: Record<EModalSwapRoutes, IReplayRouteClass> = {
  ...uniform(Object.values(EModalSwapRoutes), 'safe'),
  [EModalSwapRoutes.SwapInviteeReward]: 'outOfScope',
};

export const marketModalTable: Record<EModalMarketRoutes, IReplayRouteClass> =
  uniform(Object.values(EModalMarketRoutes), 'safe');

export const stakingModalTable: Record<EModalStakingRoutes, IReplayRouteClass> =
  uniform(Object.values(EModalStakingRoutes), 'safe');

export const fiatCryptoModalTable: Record<
  EModalFiatCryptoRoutes,
  IReplayRouteClass
> = uniform(Object.values(EModalFiatCryptoRoutes), 'safe');

export const receiveModalTable: Record<EModalReceiveRoutes, IReplayRouteClass> =
  {
    ...uniform(Object.values(EModalReceiveRoutes), 'outOfScope'),
    [EModalReceiveRoutes.BuyModal]: 'safe',
    [EModalReceiveRoutes.HeadlessBuyOrders]: 'safe',
    [EModalReceiveRoutes.HeadlessBuyOrderDetail]: 'safe',
    // Shared with the plain Receive flow: only counts above the Buy page.
    [EModalReceiveRoutes.DeriveTypesAddress]: 'inherit',
    [EModalReceiveRoutes.ExchangeOpenRedirect]: 'thirdParty',
  };

export const signatureConfirmModalTable: Record<
  EModalSignatureConfirmRoutes,
  IReplayRouteClass
> = {
  [EModalSignatureConfirmRoutes.TxConfirm]: 'inherit',
  [EModalSignatureConfirmRoutes.TxConfirmFromSwap]: 'inherit',
  [EModalSignatureConfirmRoutes.MessageConfirm]: 'inherit',
  [EModalSignatureConfirmRoutes.BatchTxConfirm]: 'inherit',
  [EModalSignatureConfirmRoutes.TxReplace]: 'inherit',
  [EModalSignatureConfirmRoutes.TxSelectToken]: 'inherit',
  [EModalSignatureConfirmRoutes.TxSelectAggregateToken]: 'inherit',
  [EModalSignatureConfirmRoutes.TxSelectDeriveAddress]: 'inherit',
  [EModalSignatureConfirmRoutes.TxConfirmFromDApp]: 'thirdParty',
  [EModalSignatureConfirmRoutes.MessageConfirmFromDApp]: 'thirdParty',
  [EModalSignatureConfirmRoutes.BatchTxConfirmFromDApp]: 'thirdParty',
  [EModalSignatureConfirmRoutes.TxDataInput]: 'outOfScope',
  [EModalSignatureConfirmRoutes.TxAmountInput]: 'outOfScope',
  [EModalSignatureConfirmRoutes.LnurlPayRequest]: 'outOfScope',
  [EModalSignatureConfirmRoutes.LnurlWithdraw]: 'outOfScope',
  [EModalSignatureConfirmRoutes.LnurlAuth]: 'outOfScope',
  [EModalSignatureConfirmRoutes.WeblnSendPayment]: 'outOfScope',
};

export const sendModalTable: Record<EModalSendRoutes, IReplayRouteClass> = {
  ...uniform(Object.values(EModalSendRoutes), 'outOfScope'),
  [EModalSendRoutes.SendConfirmFromSwap]: 'inherit',
  [EModalSendRoutes.SendConfirmFromDApp]: 'thirdParty',
};

export const assetSelectorModalTable: Record<
  EAssetSelectorRoutes,
  IReplayRouteClass
> = {
  [EAssetSelectorRoutes.TokenSelector]: 'inherit',
  [EAssetSelectorRoutes.AggregateTokenSelector]: 'inherit',
  [EAssetSelectorRoutes.DeriveTypesAddressSelector]: 'inherit',
  [EAssetSelectorRoutes.PrimeInfiniPaymentAssetSelector]: 'outOfScope',
};

export const chainSelectorModalTable: Record<
  EChainSelectorPages,
  IReplayRouteClass
> = {
  [EChainSelectorPages.ChainSelector]: 'inherit',
  [EChainSelectorPages.AccountChainSelector]: 'inherit',
  [EChainSelectorPages.ChainListSearch]: 'inherit',
  [EChainSelectorPages.UnifiedNetworkSelector]: 'inherit',
  [EChainSelectorPages.MultiNetworkSelector]: 'inherit',
  [EChainSelectorPages.TokenSelector]: 'inherit',
  [EChainSelectorPages.AddCustomNetwork]: 'outOfScope',
  [EChainSelectorPages.AllNetworksManager]: 'outOfScope',
};

export const walletAddressModalTable: Record<
  EModalWalletAddressRoutes,
  IReplayRouteClass
> = uniform(Object.values(EModalWalletAddressRoutes), 'inherit');

const classifyUniversalSearch = ({ params }: ILeafContext): IReplayRouteClass =>
  params &&
  typeof params === 'object' &&
  (params as { source?: unknown }).source === EUniversalSearchSource.Market
    ? 'safe'
    : 'outOfScope';

export const universalSearchModalTable: Record<
  EUniversalSearchPages,
  IReplayLeafRule
> = {
  // Only the Market search is in scope; wallet/DApp searches stay paused.
  [EUniversalSearchPages.UniversalSearch]: classifyUniversalSearch,
  [EUniversalSearchPages.MarketDetail]: 'inherit',
};

export const accountManagerStacksTable: Record<
  EAccountManagerStacksRoutes,
  IReplayRouteClass
> = {
  ...uniform(Object.values(EAccountManagerStacksRoutes), 'outOfScope'),
  [EAccountManagerStacksRoutes.ExportPrivateKeysPage]: 'sensitive',
};

export const modalContainerTable: Record<EModalRoutes, IReplayContainerRule> = {
  [EModalRoutes.MainModal]: mainModalTable,
  [EModalRoutes.DiscoveryModal]: 'thirdParty',
  // Password, backup, protection and key export pages live here.
  [EModalRoutes.SettingModal]: 'sensitive',
  [EModalRoutes.TestModal]: 'outOfScope',
  [EModalRoutes.DeveloperModal]: 'outOfScope',
  [EModalRoutes.SwapModal]: swapModalTable,
  [EModalRoutes.PerpModal]: perpPageTable,
  [EModalRoutes.MarketModal]: marketModalTable,
  [EModalRoutes.AccountManagerStacks]: accountManagerStacksTable,
  [EModalRoutes.OnboardingModal]: onboardingV1PageTable,
  // Prime transfer and the Prime master password.
  [EModalRoutes.PrimeModal]: 'sensitive',
  [EModalRoutes.PrimeGiftModal]: 'outOfScope',
  [EModalRoutes.FirmwareUpdateModal]: 'outOfScope',
  [EModalRoutes.AssetSelectorModal]: assetSelectorModalTable,
  [EModalRoutes.ChainSelectorModal]: chainSelectorModalTable,
  [EModalRoutes.SendModal]: sendModalTable,
  [EModalRoutes.ReceiveModal]: receiveModalTable,
  // Camera feed.
  [EModalRoutes.ScanQrCodeModal]: 'sensitive',
  [EModalRoutes.LiteCardModal]: 'sensitive',
  [EModalRoutes.ManualBackupModal]: 'sensitive',
  [EModalRoutes.CloudBackupModal]: 'sensitive',
  [EModalRoutes.WebViewModal]: 'thirdParty',
  [EModalRoutes.AddressBookModal]: 'outOfScope',
  [EModalRoutes.DAppConnectionModal]: 'thirdParty',
  [EModalRoutes.AppUpdateModal]: 'outOfScope',
  [EModalRoutes.FiatCryptoModal]: fiatCryptoModalTable,
  [EModalRoutes.KeyTagModal]: 'sensitive',
  [EModalRoutes.UniversalSearchModal]: universalSearchModalTable,
  [EModalRoutes.StakingModal]: stakingModalTable,
  [EModalRoutes.WalletAddress]: walletAddressModalTable,
  [EModalRoutes.WalletConnectPayModal]: 'thirdParty',
  [EModalRoutes.NotificationsModal]: 'outOfScope',
  [EModalRoutes.ShortcutsModal]: 'outOfScope',
  [EModalRoutes.SignatureConfirmModal]: signatureConfirmModalTable,
  [EModalRoutes.DeviceManagementModal]: 'outOfScope',
  [EModalRoutes.ReferFriendsModal]: 'outOfScope',
  [EModalRoutes.BulkCopyAddressesModal]: 'outOfScope',
  [EModalRoutes.BulkExportHistoryModal]: 'outOfScope',
  [EModalRoutes.BulkSendModal]: 'outOfScope',
  [EModalRoutes.ApprovalManagementModal]: 'outOfScope',
  [EModalRoutes.SignAndVerifyModal]: 'outOfScope',
  [EModalRoutes.NetworkDoctorModal]: 'outOfScope',
  [EModalRoutes.AddressRiskCheckModal]: 'outOfScope',
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

type IRootKind = 'tabs' | 'modal' | 'onboarding' | IReplayRouteClass;

export const rootRouteTable: Record<ERootRoutes, IRootKind> = {
  [ERootRoutes.Main]: 'tabs',
  [ERootRoutes.Modal]: 'modal',
  // Hosts the same full modal router as `modal`.
  [ERootRoutes.iOSFullScreen]: 'modal',
  [ERootRoutes.Onboarding]: 'onboarding',
  // Opened over a chart page; only as safe as the page underneath.
  [ERootRoutes.TradingViewNativeFullscreen]: 'inherit',
  [ERootRoutes.WebView]: 'thirdParty',
  [ERootRoutes.FullScreenPush]: 'outOfScope',
  [ERootRoutes.Gallery]: 'outOfScope',
  [ERootRoutes.NotFound]: 'outOfScope',
  [ERootRoutes.PermissionWebDevice]: 'outOfScope',
  [ERootRoutes.OAuthCallbackWeb]: 'outOfScope',
};

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

const hasOwn = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

function getNestedScreenRoute(params: unknown): IReplayNavRoute | undefined {
  if (!params || typeof params !== 'object') {
    return undefined;
  }
  const { screen, params: childParams } = params as {
    screen?: unknown;
    params?: unknown;
  };
  if (typeof screen !== 'string' || !screen) {
    return undefined;
  }
  return { name: screen, params: childParams };
}

// Routes of a stack from the bottom up to the focused one. A nested navigator
// that has not mounted yet has no state; react-navigation then carries the
// target in params.screen.
function getStackRoutes(route: IReplayNavRoute): readonly IReplayNavRoute[] {
  const { state } = route;
  const routes = state?.routes;
  if (routes?.length) {
    const lastIndex =
      typeof state?.index === 'number'
        ? Math.min(state.index, routes.length - 1)
        : routes.length - 1;
    return routes.slice(0, lastIndex + 1);
  }
  const nested = getNestedScreenRoute(route.params);
  return nested ? [nested] : [];
}

function getFocusedRoute(route: IReplayNavRoute): IReplayNavRoute | undefined {
  const routes = getStackRoutes(route);
  return routes[routes.length - 1];
}

function resolveLeafRule(
  rule: IReplayContainerRule | undefined,
  leaf: IReplayNavRoute | undefined,
  isDiscoveryEarnSelected: boolean,
): IReplayRouteClass {
  if (!rule) {
    return 'outOfScope';
  }
  if (typeof rule === 'string') {
    return rule;
  }
  if (!leaf || !hasOwn(rule, leaf.name)) {
    return 'outOfScope';
  }
  const leafRule = rule[leaf.name];
  return typeof leafRule === 'function'
    ? leafRule({ params: leaf.params, isDiscoveryEarnSelected })
    : leafRule;
}

function pushContainerFrames(
  frames: IReplayRouteFrame[],
  prefix: string,
  container: IReplayNavRoute,
  rule: IReplayContainerRule | undefined,
  isDiscoveryEarnSelected: boolean,
) {
  const leaves = getStackRoutes(container);
  if (!leaves.length) {
    frames.push({
      key: `${prefix}/${container.name}`,
      routeClass: resolveLeafRule(rule, undefined, isDiscoveryEarnSelected),
    });
    return;
  }
  for (let i = leaves.length - 1; i >= 0; i -= 1) {
    const leaf = leaves[i];
    frames.push({
      key: `${prefix}/${container.name}/${leaf.name}`,
      routeClass: resolveLeafRule(rule, leaf, isDiscoveryEarnSelected),
    });
  }
}

function getTableRule(
  table: Readonly<Record<string, IReplayContainerRule>>,
  name: string,
): IReplayContainerRule | undefined {
  return hasOwn(table, name) ? table[name] : undefined;
}

// Visible frames from the top of the screen downwards. Only the focused tab of
// the tab navigator is included; every stack contributes all routes up to its
// focused one.
export function collectReplayRouteFrames({
  state,
  isDiscoveryEarnSelected,
}: IReplayRouteClassifierInput): IReplayRouteFrame[] {
  const frames: IReplayRouteFrame[] = [];
  if (!state) {
    return frames;
  }
  const rootRoutes = getStackRoutes({ name: '', state });
  for (let i = rootRoutes.length - 1; i >= 0; i -= 1) {
    const root = rootRoutes[i];
    const kind = hasOwn(rootRouteTable, root.name)
      ? rootRouteTable[root.name as ERootRoutes]
      : 'outOfScope';
    if (kind === 'tabs') {
      const tab = getFocusedRoute(root);
      if (!tab) {
        frames.push({ key: root.name, routeClass: 'outOfScope' });
      } else {
        pushContainerFrames(
          frames,
          root.name,
          tab,
          getTableRule(tabContainerTable, tab.name),
          isDiscoveryEarnSelected,
        );
      }
    } else if (kind === 'modal' || kind === 'onboarding') {
      const table =
        kind === 'modal' ? modalContainerTable : onboardingRootContainerTable;
      const containers = getStackRoutes(root);
      if (!containers.length) {
        frames.push({ key: root.name, routeClass: 'outOfScope' });
      }
      for (let j = containers.length - 1; j >= 0; j -= 1) {
        const container = containers[j];
        pushContainerFrames(
          frames,
          root.name,
          container,
          getTableRule(table, container.name),
          isDiscoveryEarnSelected,
        );
      }
    } else {
      frames.push({ key: root.name, routeClass: kind });
    }
  }
  return frames;
}

export function classifyReplayRoute(
  input: IReplayRouteClassifierInput,
): IReplayRouteDecision {
  const frames = collectReplayRouteFrames(input);
  const top = frames[0];
  const deciding = frames.find((f) => f.routeClass !== 'inherit');
  const sensitive = frames.find((f) => f.routeClass === 'sensitive');
  const routeClass: IReplayRouteClass = deciding?.routeClass ?? 'outOfScope';
  const allowed = !sensitive && routeClass === 'safe';

  let routeKey = top?.key;
  if (routeKey && deciding && deciding !== top) {
    routeKey = `${routeKey} (via ${deciding.key})`;
  }
  if (routeKey && sensitive && sensitive !== deciding) {
    routeKey = `${routeKey} (blocked by ${sensitive.key})`;
  }

  return {
    allowed,
    routeKey,
    routeClass,
    topKey: top?.key,
    decidingKey: deciding?.key,
    sensitiveKey: sensitive?.key,
    frames,
  };
}
