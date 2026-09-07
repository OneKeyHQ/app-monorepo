/* eslint-disable import/no-named-as-default-member */
import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';
import { cloneDeep } from 'lodash';

import type { IDialogLoadingProps } from '@onekeyhq/components';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  EHardwareUiStateAction,
  IJotaiContextStoreData,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import type { EThirdPartyDevicePermissionDeniedReason } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import type {
  IOneKeyErrorI18nInfo,
  IOneKeyHardwareErrorPayload,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';

import appGlobals from '../appGlobals';
// import { defaultLogger } from '../logger/logger';
import platformEnv, { ERuntimeRole } from '../platformEnv';

import { EAppEventBusNames } from './appEventBusNames';

import type { EAccountSelectorSceneName, EHomeTab } from '../../types';
import type {
  IDeFiProtocol,
  IFetchAccountDeFiPositionsResp,
  IProtocolSummary,
} from '../../types/defi';
import type { EHardwareVendor } from '../../types/device';
import type { IFeeSelectorItem } from '../../types/fee';
import type { ESubscriptionType } from '../../types/hyperliquid/types';
import type { IMarketWsDataUpdatePayload } from '../../types/marketV2';
import type {
  INotificationPushMessageInfo,
  INotificationViewDialogPayload,
} from '../../types/notification';
import type { IPrimeTransferData } from '../../types/prime/primeTransferTypes';
import type { EPrimeAuthSessionSource } from '../../types/prime/primeTypes';
import type { IRookieShareData } from '../../types/rookieGuide';
import type {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
  ISwapApproveTransaction,
  ISwapQuoteEventPayload,
  ISwapToken,
  ISwapTokenBase,
} from '../../types/swap/types';
import type { IAccountToken, ITokenFiat } from '../../types/token';
import type { EDecodedTxStatus } from '../../types/tx';
import type { EHomeWalletTab } from '../../types/wallet';
import type { IOneKeyError } from '../errors/types/errorTypes';
import type { EModalRoutes, ETabRoutes, IWebViewPageParams } from '../routes';
import type { INativeStorageContractViolation } from '../storage/nativeStorageTypes';
import type { IStorageFullDiagnostics } from '../storageChecker/types';
import type { IWalletConnectSession } from '../walletConnect/types';
import type { DeviceStateEvent } from '@onekeyfe/hd-core';
import type { FuseResult } from 'fuse.js';

// Supported hardware error types for dialog display
export const HARDWARE_ERROR_DIALOG_TYPES = {
  DEVICE_NOT_FOUND: 'DeviceNotFound',
  BLE_DEVICE_BOND_ERROR: 'BleDeviceBondError',
  NEED_ONEKEY_BRIDGE: 'NeedOneKeyBridge',
  DEVICE_NOT_OPENED_PASSPHRASE: 'DeviceNotOpenedPassphrase',
} as const;

// Hardware error dialog event payload type
export interface IHardwareErrorDialogPayload {
  errorType: string; // Extensible but type-safe error types
  vendor?: EHardwareVendor | string;
  payload?: IOneKeyHardwareErrorPayload | Record<string, unknown>; // Original error payload with type safety
  errorCode?: number | string; // Hardware error code
  errorMessage?: string; // Error message
}

export enum EFinalizeWalletSetupSteps {
  // Regular wallet steps
  CreatingWallet = 'CreatingWallet',
  GeneratingAccounts = 'GeneratingAccounts',
  EncryptingData = 'EncryptingData',
  Ready = 'Ready',
  // Hardware-only pre-step (UI-driven, not emitted from actions layer)
  ConnectingDevice = 'ConnectingDevice',
}

export type IEventBusPayloadShowToast = {
  // IToastProps
  method: 'success' | 'error' | 'message' | 'warning';
  title: string;
  message?: string;
  icon?: string;
  duration?: number;
  errorCode?: number | string;
  errorClassName?: string;
  errorName?: string;
  // hardware device the error came from, when the error carries one
  connectId?: string;
  httpStatusCode?: number;
  toastId?: string;
  i18nKey?: ETranslations;
  i18nInfo?: IOneKeyErrorI18nInfo;
  requestId?: string;
  diagnosticText?: string;
};

export type ILinuxUdevGuideReason =
  | 'not-linux'
  | 'snap'
  | 'flatpak'
  | 'missing-pkexec'
  | 'cancelled'
  | 'not-authorized'
  | 'failed'
  | 'webusb-access-denied'
  | 'unknown';

export type IEventBusPayloadShowLinuxUdevGuide = {
  reason?: ILinuxUdevGuideReason;
};

export type IEventBusPayloadShowLocalSecretEnvelopeErrorDialog = {
  technicalMessage: string;
};

export type IEventBusPayloadAccountDataUpdate =
  | undefined
  | {
      isManualRefresh?: boolean;
      refreshSource?: 'home-header' | 'pull-to-refresh';
    };

// The item shape is owned by kit's settings config; it stays opaque here so
// shared never depends on kit types or its search-results presentation.
export type ISettingsSearchResultItem = FuseResult<unknown>;

export interface IAppEventBusPayload {
  [EAppEventBusNames.ConfirmAccountSelected]: {
    num: number;
    indexedAccountId?: string;
    othersWalletAccountId?: string;
  };
  [EAppEventBusNames.LocalSystemTimeInvalid]: undefined;
  [EAppEventBusNames.LocalSystemTimeStatusChanged]: {
    status: 'VALID' | 'INVALID' | 'UNKNOWN';
  };
  [EAppEventBusNames.ShowDialogLoading]: IDialogLoadingProps;
  [EAppEventBusNames.HideDialogLoading]: undefined;
  [EAppEventBusNames.WalletClear]: undefined;
  [EAppEventBusNames.WalletUpdate]: undefined;
  [EAppEventBusNames.SwapApprovingSuccess]: {
    approvedSwapInfo: ISwapApproveTransaction;
    enableFilled?: boolean;
  };
  [EAppEventBusNames.SwapSpeedApprovingReset]: {
    approvedSwapInfo: ISwapApproveTransaction;
  };
  [EAppEventBusNames.SwapSpeedBalanceUpdate]: {
    orderFromToken: ISwapTokenBase;
    orderToToken: ISwapTokenBase;
  };
  [EAppEventBusNames.SwapSpeedBuildTxSuccess]: {
    fromToken: ISwapTokenBase;
    toToken: ISwapTokenBase;
    fromAmount: string;
    toAmount: string;
  };
  [EAppEventBusNames.SwapStockTokenSelected]: ISwapToken;
  [EAppEventBusNames.WalletRemove]: {
    walletId: string;
  };
  [EAppEventBusNames.WalletRename]: {
    walletId: string;
  };
  [EAppEventBusNames.AccountUpdate]: undefined;
  [EAppEventBusNames.AccountRemove]: undefined;
  [EAppEventBusNames.AddDBAccountsToWallet]: {
    walletId: string;
    accounts: IDBAccount[];
  };
  [EAppEventBusNames.RenameDBAccounts]: {
    accounts: IDBAccount[];
  };
  [EAppEventBusNames.CloseCurrentBrowserTab]: undefined;
  [EAppEventBusNames.DAppConnectUpdate]: undefined;
  [EAppEventBusNames.DAppLastFocusUrlUpdate]: undefined;
  [EAppEventBusNames.GlobalDeriveTypeUpdate]: undefined;
  [EAppEventBusNames.NetworkDeriveTypeChanged]: undefined;
  [EAppEventBusNames.AccountSelectorSelectedAccountUpdate]: {
    selectedAccount: IAccountSelectorSelectedAccount;
    selectedAccountUpdatedAt: number | undefined;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  };
  [EAppEventBusNames.OnSwitchDAppNetwork]: {
    state: 'switching' | 'completed';
  };
  [EAppEventBusNames.DAppNetworkUpdate]: {
    networkId: string;
    sceneName: string;
    sceneUrl: string;
    num: number;
  };
  [EAppEventBusNames.FinalizeWalletSetupStep]: {
    step: EFinalizeWalletSetupSteps;
  };
  [EAppEventBusNames.FinalizeWalletSetupError]: {
    error: IOneKeyError | undefined;
  };
  [EAppEventBusNames.WalletConnectOpenModal]: {
    uri: string;
    // bg connect attempt generation; lets main-runtime consumers match
    // terminal close/modal-state events to the pairing they belong to
    attemptId?: number;
  };
  [EAppEventBusNames.WalletConnectCloseModal]:
    | {
        // scope the close to one attempt; omitted means wildcard close
        attemptId?: number;
      }
    | undefined;
  [EAppEventBusNames.WalletConnectModalState]: {
    open: boolean;
    attemptId?: number;
  };
  [EAppEventBusNames.WalletConnectConnectSuccess]: {
    session: IWalletConnectSession;
    attemptId?: number;
  };
  [EAppEventBusNames.WalletConnectConnectError]: {
    error: IOneKeyError;
    attemptId?: number;
  };
  [EAppEventBusNames.ShowToast]: IEventBusPayloadShowToast;
  [EAppEventBusNames.NativeStorageContractViolation]: INativeStorageContractViolation;
  [EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog]: IEventBusPayloadShowLocalSecretEnvelopeErrorDialog;
  [EAppEventBusNames.ShowAirGapQrcode]: {
    title?: string;
    promiseId?: number;
    valueUr: IAirGapUrJson;
  };
  [EAppEventBusNames.HideAirGapQrcode]: {
    flag?: string; // close toast should skipReject: flag=skipReject
  };
  [EAppEventBusNames.RealmInit]: undefined;
  [EAppEventBusNames.V4RealmInit]: undefined;
  [EAppEventBusNames.SyncDeviceLabelToWalletName]: {
    walletId: string;
    dbDeviceId: string;
    label: string;
    walletName: string | undefined;
  };
  [EAppEventBusNames.UpdateWalletAvatarByDeviceSerialNo]: {
    walletId: string;
    dbDeviceId: string;
    avatarInfo: IAvatarInfo;
  };
  [EAppEventBusNames.BatchCreateAccount]: {
    totalCount: number;
    createdCount: number;
    progressTotal: number;
    progressCurrent: number;
    networkId?: string;
    deriveType?: string | IAccountDeriveTypes;
    error?: IOneKeyError;
  };
  [EAppEventBusNames.SDKGetAllNetworkAddressesStart]: undefined;
  [EAppEventBusNames.SDKGetAllNetworkAddressesEnd]: undefined;
  [EAppEventBusNames.ExtensionContextMenuUpdate]: undefined;
  [EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode]: {
    connectId: string | undefined;
    existsFirmware?: boolean;
  };
  [EAppEventBusNames.ShowFirmwareUpdateForce]: {
    connectId: string | undefined;
  };
  [EAppEventBusNames.BeginFirmwareUpdate]: undefined;
  [EAppEventBusNames.FinishFirmwareUpdate]: undefined;
  [EAppEventBusNames.FirmwareUpdateDetectStatusChanged]: undefined;
  [EAppEventBusNames.LoadWebEmbedWebView]: undefined;
  [EAppEventBusNames.LoadWebEmbedWebViewComplete]: undefined;
  [EAppEventBusNames.HardwareVerifyAfterDeviceConfirm]: undefined;
  // The authenticity card's exits, from the DeviceStage driver back to
  // whoever is running the check (OK-59934).
  [EAppEventBusNames.DeviceStageAuthAction]: {
    action: 'retry' | 'support' | 'continueAnyway';
  };
  // The passphrase teach card's Continue, from the DeviceStage driver
  // back to the flow that primed the card before its hardware call
  // (the account selector's Add-hidden-wallet, OK-59934).
  [EAppEventBusNames.DeviceStagePassphraseIntroContinue]: undefined;
  [EAppEventBusNames.SwitchMarketHomeTab]: {
    tabIndex: number;
  };
  [EAppEventBusNames.SwitchWalletHomeTab]: {
    id: EHomeWalletTab;
  };
  [EAppEventBusNames.RefreshMarketWatchList]: undefined;
  [EAppEventBusNames.RefreshCustomRpcList]: undefined;
  [EAppEventBusNames.ClearLocalHistoryPendingTxs]: undefined;
  [EAppEventBusNames.TxFeeInfoChanged]: {
    feeSelectorItems: IFeeSelectorItem[];
  };
  [EAppEventBusNames.SignatureConfirmContainerMounted]: undefined;
  [EAppEventBusNames.CloseHardwareUiStateDialogManually]: undefined;
  [EAppEventBusNames.HardCloseHardwareUiStateDialog]: undefined;
  [EAppEventBusNames.HistoryTxStatusChanged]: undefined;
  [EAppEventBusNames.LocalPendingTxConfirmed]: {
    accountId: string;
    indexedAccountId?: string;
    accountAddress?: string;
    deriveType?: string | IAccountDeriveTypes;
    perpsAccountId?: string | null;
    perpsIndexedAccountId?: string | null;
    perpsAccountAddress?: string;
    perpsDeriveType?: string | IAccountDeriveTypes;
    networkId: string;
    txid: string;
    status: EDecodedTxStatus;
    isPerpsDepositTx?: boolean;
  };
  [EAppEventBusNames.DeFiPositionRefreshed]: {
    accountId: string;
    indexedAccountId?: string;
    networkId: string;
    overview: IFetchAccountDeFiPositionsResp['data']['totals'];
    protocols: IDeFiProtocol[];
    protocolMap: Record<string, IProtocolSummary>;
  };
  [EAppEventBusNames.DeFiEnabledNetworksChanged]: undefined;
  [EAppEventBusNames.EstimateTxFeeRetry]: undefined;
  [EAppEventBusNames.GasAccountSubmitRetryScheduled]: {
    attempt: number;
    maxAttempts: number;
    retryAfterSec: number;
    scheduledAt: number;
  };
  [EAppEventBusNames.GasAccountSubmitRetryCleared]: undefined;
  // TokenList cells Phase-2 BG frame transport (D2=A). The structure event
  // carries the FULL idempotent structure snapshot for an owner (generation is
  // monotonic); the valuation event carries the FULL current fiat map for an
  // owner (idempotent, self-healing via the apply-layer fiatEqual guard). Both
  // carry their owner key + a monotonic version so the UI shell can drop a
  // stale PULL result and detect a generation/version gap.
  [EAppEventBusNames.TokenListStructureFrame]: {
    ownerKey: string;
    structureVersion: number;
    structure: IStructureSnapshot;
  };
  [EAppEventBusNames.TokenListValuationFrame]: {
    ownerKey: string;
    valuationVersion: number;
    valuation: IValuationFrame;
  };
  // TokenList cells Phase-2 risky frame (design 2026-06-16 §R0). FULL idempotent
  // risky snapshot for an owner: the risky token list + its `$key -> ITokenFiat`
  // map. `riskyVersion` is monotonic and INDEPENDENT of the structure/valuation
  // versions; the UI shell version-guards + drops stale PULLs against it. Carries
  // the owner's `storeData` so the receive shell can identity-check it (never
  // diffed — always the whole current risky set).
  [EAppEventBusNames.TokenListRiskyFrame]: {
    ownerKey: string;
    riskyVersion: number;
    riskyTokens: IAccountToken[];
    riskyMap: Record<string, ITokenFiat>;
    storeData: IJotaiContextStoreData;
  };
  [EAppEventBusNames.AllNetworksTokenListSettled]: {
    accountAddress?: string;
    accountId?: string;
    accountName?: string;
    aggregateTokenMap: Record<string, ITokenFiat>;
    deviceConnectId?: string;
    deviceDbId?: string;
    indexedAccountId?: string;
    indexedAccountIndex?: number;
    indexedAccountName?: string;
    networkId?: string;
    ownerAccountId?: string;
    ownerNetworkId?: string;
    totalFiat: string;
    totalFiatCurrency: string;
    totalTokenCount: number;
    tokenMap: Record<string, ITokenFiat>;
    tokens: IAccountToken[];
    walletId?: string;
    walletType?: string;
  };
  [EAppEventBusNames.RefreshTokenList]:
    | undefined
    | {
        accounts: {
          accountId: string;
          networkId: string;
          // Stable across network switches for HD accounts; forwarded so a
          // frozen token list (whose own `indexedAccount` closure may be
          // stale) resolves aggregate hidden/custom tokens against the right
          // indexed account. Undefined for Others (imported/watch-only).
          indexedAccountId?: string;
        }[];
        // When true, the home token list refreshes strictly against the
        // provided account/network instead of its own active account. Used by
        // emitters from a different home tab right after a network switch,
        // when the (inactive) token list is frozen and its closures still
        // point at the previous network.
        refreshByProvidedAccounts?: boolean;
      };
  [EAppEventBusNames.RefreshHistoryList]: undefined;
  [EAppEventBusNames.RefreshApprovalList]: undefined;
  [EAppEventBusNames.RefreshBookmarkList]: undefined;
  [EAppEventBusNames.InvalidateDiscoveryHomeBookmarksPrefetch]: undefined;
  [EAppEventBusNames.TabListStateUpdate]: {
    isRefreshing: boolean;
    type: EHomeTab;
    accountId: string;
    networkId: string;
  };
  [EAppEventBusNames.AccountDataUpdate]: IEventBusPayloadAccountDataUpdate;
  [EAppEventBusNames.AccountValueUpdate]: undefined;
  [EAppEventBusNames.onDragBeginInListView]: undefined;
  [EAppEventBusNames.onDragEndInListView]: undefined;
  [EAppEventBusNames.SidePanel_BgToUI]: {
    type: 'pushModal';
    payload: {
      modalParams: any;
    };
  };
  [EAppEventBusNames.SidePanel_UIToBg]:
    | {
        type: 'dappRejectId';
        payload: {
          rejectId: number | string;
        };
      }
    | {
        type: 'rejectDappRequest';
        payload: {
          rejectId: number | string;
          errorMessage?: string;
        };
      };
  [EAppEventBusNames.SwapQuoteEvent]: ISwapQuoteEventPayload;
  [EAppEventBusNames.ShowSystemDiskFullWarning]:
    | IStorageFullDiagnostics
    | undefined;
  [EAppEventBusNames.ShowLinuxBundleUdevGuide]: IEventBusPayloadShowLinuxUdevGuide;
  [EAppEventBusNames.SwapTxHistoryStatusUpdate]: {
    status: ESwapTxHistoryStatus;
    crossChainStatus?: ESwapCrossChainStatus;
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
  };
  [EAppEventBusNames.RefreshSwapHistoryList]: undefined;
  // De-facto "network list changed, refresh" signal. Emitted not only when a
  // custom network is added/removed, but also after a server-network sync that
  // changes the set (e.g. a network delisted to TRASH). All network selectors
  // listen to it to re-pull their network list.
  [EAppEventBusNames.AddedCustomNetwork]: undefined;
  [EAppEventBusNames.SyncDappAccountToHomeAccount]: {
    selectedAccount: IAccountSelectorSelectedAccount;
  };
  [EAppEventBusNames.ShowFindInWebPage]: {
    tabId: string;
  };
  [EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled]: {
    enabled: boolean;
  };
  [EAppEventBusNames.RefreshNetInfo]: undefined;
  [EAppEventBusNames.ShowSwitchAccountSelector]: {
    networkId: string;
  };
  [EAppEventBusNames.CreateAddressByDialog]: {
    networkId: string;
    indexedAccountId: string;
    promiseId: number;
    autoCreateAddress: boolean;
    deriveType: IAccountDeriveTypes;
  };
  [EAppEventBusNames.PrimeLoginInvalidToken]:
    | {
        authSessionSource?: EPrimeAuthSessionSource;
        clearedByBackground?: boolean;
        // Auth-state commit generation (simpleDb.prime.getAuthStateGeneration)
        // observed by the bg cleanup when it decided to clear. Handlers must
        // treat the event as STALE and skip their sign-outs when the current
        // generation differs: a login commit that landed after the clear
        // decision owns the shared session slot, and a stale sign-out would
        // destroy the fresh login's persisted session.
        authStateGeneration?: number;
      }
    | undefined;
  // Emitted from the bg runtime after it clears the shared keyless Supabase
  // session storage (wallet removal / cleanup). JS heaps are isolated per
  // runtime, so the main runtime must sign out its own in-memory keyless
  // client copy when this arrives.
  [EAppEventBusNames.KeylessAuthSessionCleared]: undefined;
  [EAppEventBusNames.PrimeAuthSessionSourceCommitted]: {
    authSessionSource: EPrimeAuthSessionSource;
    callerName: string;
  };
  [EAppEventBusNames.IdentityLifecycleCommitted]: {
    revision: number;
    oneKeyIdState: 'loggedIn' | 'loggedOut';
  };
  [EAppEventBusNames.PrimeSubscriptionPurchaseSuccess]: {
    // UI-local event: use emitToSelf so multiple Extension surfaces cannot race
    // to show the same post-purchase dialog.
    onekeyUserId: string;
    // A purchase flow reserves this BG-owned claim before refreshing Prime
    // state, preventing another Extension Home runtime from winning the race.
    claimId?: string;
  };
  [EAppEventBusNames.PrimeExceedDeviceLimit]: undefined;
  [EAppEventBusNames.PrimeDeviceLogout]: {
    operationId: string;
    messageId: string;
  };
  [EAppEventBusNames.PrimeMasterPasswordInvalid]: undefined;
  [EAppEventBusNames.PrimeTransferDataReceived]: {
    data: IPrimeTransferData;
  };
  [EAppEventBusNames.PrimeTransferForceExit]: {
    title: string;
    description: string;
  };
  [EAppEventBusNames.PrimeTransferCancel]: undefined;
  [EAppEventBusNames.CheckAddressBeforeSending]: {
    promiseId: number;
    type: 'scam' | 'contract';
  };
  [EAppEventBusNames.HideTabBar]: boolean;
  [EAppEventBusNames.RequestHardwareUIDialog]: {
    uiRequestType: EHardwareUiStateAction;
  };
  [EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog]: {
    vendor: EHardwareVendor;
    reason: EThirdPartyDevicePermissionDeniedReason;
  };
  [EAppEventBusNames.RequestDeviceInBootloaderForWebDevice]: undefined;
  [EAppEventBusNames.RequestDeviceForSwitchFirmwareWebDevice]: undefined;
  [EAppEventBusNames.EnabledNetworksChanged]: undefined;
  [EAppEventBusNames.CheckWalletBackupStatus]: {
    promiseId: number;
    walletId: string;
  };
  [EAppEventBusNames.doubleConfirmTxFeeInfo]: {
    promiseId: number;
  };
  [EAppEventBusNames.HardwareFeaturesUpdate]: {
    deviceId: string;
  };
  [EAppEventBusNames.HardwareDeviceStateUpdate]: DeviceStateEvent;
  [EAppEventBusNames.HardwareConnectionStateUpdate]: undefined;
  [EAppEventBusNames.UnlockApp]: undefined;
  [EAppEventBusNames.LockApp]: undefined;
  [EAppEventBusNames.AddressBookUpdate]: undefined;
  [EAppEventBusNames.MarketWSDataUpdate]: IMarketWsDataUpdatePayload;
  [EAppEventBusNames.MarketWatchlistOnlyChanged]: {
    showWatchlistOnly: boolean;
  };
  [EAppEventBusNames.ClearStorageOnExtension]: undefined;
  [EAppEventBusNames.SupabaseStorageCacheCleared]: {
    sourceId: string;
  };
  [EAppEventBusNames.SettingsSearchResult]: {
    list: ISettingsSearchResultItem[];
    searchText: string;
  };
  [EAppEventBusNames.DesktopBleRepairRequired]: {
    connectId: string;
    deviceId?: string;
    deviceName?: string;
    features?: any;
    promiseId?: number;
  };
  [EAppEventBusNames.ShowHardwareErrorDialog]: IHardwareErrorDialogPayload;
  [EAppEventBusNames.SwapPanelDismissKeyboard]: undefined;
  [EAppEventBusNames.HyperliquidDataUpdate]: {
    type: string;
    subType: ESubscriptionType;
    data: unknown;
  };
  [EAppEventBusNames.PerpsWebSocketRecovered]: undefined;
  [EAppEventBusNames.PerpsTvPriceScaleRefreshed]: {
    symbol: string;
    priceScale: number;
  };
  [EAppEventBusNames.PerpsUnifoldDepositTerminalDelivery]: {
    deliveryId: string;
  };
  [EAppEventBusNames.PerpsSubscriptionsRecovered]: undefined;
  [EAppEventBusNames.PerpSwitchActiveInstrument]: {
    mode: 'perp' | 'spot';
    coin: string;
  };
  [EAppEventBusNames.PerpSwitchInfoPanelTab]: {
    tab: 'Positions' | 'Balances';
  };
  [EAppEventBusNames.PerpShowFundingHistory]: undefined;
  [EAppEventBusNames.HyperliquidConnectionChange]: {
    type: 'connection';
    subType: 'datastream';
    data: {
      status: 'connected' | 'disconnected';
      lastConnected: number;
      service: string;
      activeSubscriptions: number;
    };
    metadata: {
      timestamp: number;
      source: string;
    };
  };
  [EAppEventBusNames.ShowFallbackUpdateDialog]: {
    version: string | null | undefined;
  };
  [EAppEventBusNames.StartAutoDownloadUpdate]: {
    // The resolved update decision (jsBundleUpgrade / appShellUpdate /
    // jsBundleRollback) — carried for foreground logging / diagnostics only.
    decision: string;
  };
  [EAppEventBusNames.ShowAppUpdateIncompleteDialog]: undefined;
  [EAppEventBusNames.PendingInstallTaskProcessFinished]: undefined;
  [EAppEventBusNames.ShowNotificationViewDialog]: {
    payload: INotificationViewDialogPayload;
  };
  [EAppEventBusNames.ShowNotificationPageNavigation]: {
    payload: {
      screen: string;
      params: Record<string, any>;
    };
    extras?: {
      params?: {
        coin?: string;
        type?: string;
        [key: string]: any;
      };
      [key: string]: any;
    };
  };
  [EAppEventBusNames.ShowNotificationInDappPage]: string;
  [EAppEventBusNames.ShowNotificationInWebViewOverlay]: IWebViewPageParams;
  [EAppEventBusNames.UpdateNotificationBadge]: undefined;
  [EAppEventBusNames.BtcFreshAddressUpdated]: undefined;
  [EAppEventBusNames.BtcFreshAddressConnectDappRejected]: undefined;
  [EAppEventBusNames.BtcFindAddressUpdated]: undefined;
  [EAppEventBusNames.ClientLogUploadProgress]: {
    stage: ELogUploadStage;
    progressPercent?: number;
    retry?: number;
    message?: string;
  };
  [EAppEventBusNames.SwitchDiscoveryTabInNative]: {
    tab:
      | ETranslations.global_market
      | ETranslations.global_browser
      | ETranslations.global_earn;
    openUrl?: boolean;
    shouldConsumePendingUrl?: boolean;
    showWebPage?: boolean;
    switchType?: 'default' | 'tap' | 'swipe';
  };
  [EAppEventBusNames.SwitchEarnMode]: {
    mode: 'earn' | 'borrow';
    switchType?: 'default' | 'tap';
  };
  [EAppEventBusNames.SwitchEarnTab]: {
    tab: 'assets' | 'portfolio' | 'faqs';
  };
  [EAppEventBusNames.SwitchTabBar]: {
    route: ETabRoutes;
  };
  [EAppEventBusNames.PushPageInTabletDetailView]: any;
  [EAppEventBusNames.PushModalPageInTabletDetailView]: {
    route: EModalRoutes;
    params: any;
  };
  [EAppEventBusNames.CleanTokenDetailInTabletDetailView]: undefined;
  [EAppEventBusNames.MarketHomePageEnter]: {
    from: EEnterWay;
  };
  [EAppEventBusNames.MarketWatchListV2Changed]: undefined;
  [EAppEventBusNames.SwapLimitOrderBuildSuccess]: undefined;
  [EAppEventBusNames.RefreshNativeTokenInfo]: undefined;
  [EAppEventBusNames.ShowInAppPushNotification]: {
    notificationId: string | undefined;
    title: string;
    description: string;
    icon: string | undefined;
    remotePushMessageInfo: INotificationPushMessageInfo;
  };
  [EAppEventBusNames.ExecuteNotificationCommand]: {
    action: string;
    data?: Record<string, unknown>;
  };
  [EAppEventBusNames.ShowRookieShare]: {
    data: IRookieShareData;
  };
  [EAppEventBusNames.CreateNewBrowserTab]: undefined;
  [EAppEventBusNames.ClearSavedBrowserActiveTab]: undefined;
  [EAppEventBusNames.NavigateModalFromBackgroundThread]: {
    screen: any;
    params: any;
  };
  [EAppEventBusNames.HomePageReady]: undefined;
  [EAppEventBusNames.ModalNavigatorMounted]: undefined;
  [EAppEventBusNames.TrayActionWillNavigate]: undefined;
  [EAppEventBusNames.MemoryPressureWarning]: {
    /** 'low' (Android only) or 'critical' (iOS + Android). See native spec. */
    level: 'low' | 'critical';
    /** Process RSS in bytes at the moment the warning fired; `0` if unknown. */
    rss: number;
    /** Wall-clock timestamp (ms since unix epoch). */
    timestamp: number;
  };
}

/**
 * Cross-process event message exchanged between event bus nodes.
 *
 * `originNodeId` carries the sender's identity so receivers can avoid
 * processing their own echoes (a foreground that just emitted locally still
 * receives the broadcast back from the background).
 */
export interface IRemoteEventMessage {
  type: string;
  payload: unknown;
  originNodeId: string;
}

/**
 * Transports the event bus uses to talk to other processes. Each runtime
 * registers exactly one of these based on its `runtimeRole`:
 *   - `Main` role registers `sendToBackground`
 *   - `Background` role registers `broadcastToForegrounds`
 * `Standalone` registers nothing — every emit stays local.
 */
export interface IEventBusTransports {
  sendToBackground?: (msg: IRemoteEventMessage) => Promise<void> | void;
  broadcastToForegrounds?: (msg: IRemoteEventMessage) => Promise<void> | void;
}

/**
 * Generates a short, sufficiently-unique nodeId for this runtime instance.
 * Same process → same id for its lifetime; different processes (popup vs.
 * expand-tab vs. side-panel vs. background) get different ids.
 */
function generateNodeId(): string {
  const role = platformEnv.runtimeRole;
  // eslint-disable-next-line no-bitwise
  const random = (Math.random() * 0xff_ff_ff_ff) >>> 0;
  return `${role}-${random.toString(36)}-${Date.now().toString(36)}`;
}

/**
 * Tags a payload that is about to cross a process boundary with
 * `$$isRemoteEvent: true`. Listeners may inspect this metadata flag to detect
 * remote-origin events (see e.g. AccountSelectorEffects). The flag is *not*
 * used for routing — echo prevention is handled by `originNodeId` in the
 * transport layer.
 */
function convertToRemoteEventPayload(payloadValue: unknown): unknown {
  const payloadCloned = cloneDeep(payloadValue);
  try {
    if (payloadCloned && typeof payloadCloned === 'object') {
      (
        payloadCloned as {
          $$isRemoteEvent?: boolean;
        }
      ).$$isRemoteEvent = true;
    }
  } catch (_e) {
    // ignore
  }
  return payloadCloned;
}

/**
 * AppEventBus
 * -----------
 * Cross-process event bus. The two responsibilities — fire local listeners
 * and propagate to other processes — are decided purely by `runtimeRole`,
 * not by scattered platform checks.
 *
 * Routing invariant
 *   For every `emit(type, payload)` call, every listener for `type` in every
 *   process where the bus is alive fires *exactly once*. Self-echo is
 *   prevented by tagging messages with `originNodeId` and skipping them at
 *   the receiver.
 *
 * Per-role behavior
 *   `Main`       → emit fires local listeners + sends to background.
 *                  Inbound broadcasts from background fire local listeners
 *                  unless `originNodeId === this.nodeId` (own echo).
 *   `Background` → emit fires local listeners + broadcasts to all
 *                  foregrounds. Inbound from a foreground fires local
 *                  listeners + re-broadcasts to *all* foregrounds (sender
 *                  identifies its own echo by `originNodeId`).
 *   `Standalone` → emit fires local listeners only. No transports.
 */
class AppEventBusClass extends CrossEventEmitter {
  /** Stable id for this runtime instance; survives the lifetime of the process. */
  readonly nodeId: string = generateNodeId();

  private transports: IEventBusTransports = {};

  /**
   * Called by per-platform glue code during runtime bootstrap. Calls *merge*
   * — both `BackgroundApi` (background-side) and `BackgroundApiProxy`
   * (foreground-side) constructors run in the same JS context for several
   * runtimes (ext background, native bg-thread, standalone desktop/web).
   * Each constructor only registers the transport relevant to its role; the
   * merge guarantees that a `background`-role bus retains its
   * `broadcastToForegrounds` even after a proxy constructor later wires
   * `sendToBackground`.
   *
   * Re-registering the same key replaces only that key; pass `undefined` to
   * clear it explicitly.
   */
  registerTransports(transports: IEventBusTransports): void {
    this.transports = { ...this.transports, ...transports };
  }

  override emit<T extends keyof IAppEventBusPayload>(
    type: T,
    payload: IAppEventBusPayload[T],
  ): boolean {
    // Local listeners always fire on the originating node — no platform
    // exception. Cross-process delivery is a separate, additive step.
    this.emitToSelf({ type, payload, isRemote: false });

    switch (platformEnv.runtimeRole) {
      case ERuntimeRole.Main:
        void this.transports.sendToBackground?.({
          type,
          payload: convertToRemoteEventPayload(payload),
          originNodeId: this.nodeId,
        });
        break;
      case ERuntimeRole.Background:
        void this.transports.broadcastToForegrounds?.({
          type,
          payload: convertToRemoteEventPayload(payload),
          originNodeId: this.nodeId,
        });
        break;
      case ERuntimeRole.Standalone:
        break;
      default:
        break;
    }
    return true;
  }

  /**
   * Bridge handler entry point: the background received an event from a
   * foreground. Runs background listeners and re-broadcasts to all
   * foregrounds. The original sender will skip its own echo via
   * `originNodeId`.
   *
   * `emitToSelf` runs with default cloning so any synchronous mutation by a
   * BG listener stays isolated from the payload subsequently re-broadcast
   * to foregrounds.
   */
  dispatchInboundFromForeground(msg: IRemoteEventMessage): void {
    this.emitToSelf({
      type: msg.type as keyof IAppEventBusPayload,
      payload: msg.payload,
      isRemote: true,
    });
    void this.transports.broadcastToForegrounds?.(msg);
  }

  /**
   * Bridge handler entry point: a foreground received a broadcast from the
   * background. Skips the message if it's our own echo, otherwise fires
   * local listeners.
   */
  dispatchInboundFromBackground(msg: IRemoteEventMessage): void {
    if (msg.originNodeId === this.nodeId) {
      return;
    }
    this.emitToSelf({
      type: msg.type as keyof IAppEventBusPayload,
      payload: msg.payload,
      isRemote: true,
      cloned: false,
    });
  }

  override once<T extends keyof IAppEventBusPayload>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.once(type, listener);
  }

  override on<T extends keyof IAppEventBusPayload>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.on(type, listener);
  }

  override off<T extends keyof IAppEventBusPayload>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.off(type, listener);
  }

  override addListener<T extends keyof IAppEventBusPayload>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.addListener(type, listener);
  }

  override removeListener<T extends keyof IAppEventBusPayload>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.removeListener(type, listener);
  }

  emitToSelf(params: {
    type: EAppEventBusNames;
    payload: any;
    isRemote?: boolean;
    cloned?: boolean;
  }) {
    const { type, payload, isRemote, cloned = true } = params;
    const payloadCloned = cloned ? cloneDeep(payload) : payload;
    try {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (payloadCloned?.$$isRemoteEvent && !isRemote) {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        payloadCloned.$$isRemoteEvent = undefined;
      }
    } catch (_e) {
      // ignore
    }
    super.emit(type, payloadCloned);
    return true;
  }
}

const appEventBus = new AppEventBusClass();

appGlobals.$appEventBus = appEventBus;

export { appEventBus, AppEventBusClass, EAppEventBusNames };
