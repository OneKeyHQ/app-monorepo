/* eslint-disable import/no-named-as-default-member */
import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';
import { cloneDeep } from 'lodash';

import type {
  IDialogLoadingProps,
  IQrcodeDrawType,
} from '@onekeyhq/components';
import type { ISubSettingConfig } from '@onekeyhq/kit/src/views/Setting/pages/Tab/config';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { EHardwareUiStateAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import type { IOneKeyHardwareErrorPayload } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';

import appGlobals from '../appGlobals';
// import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

import { EAppEventBusNames } from './appEventBusNames';

import type { EAccountSelectorSceneName, EHomeTab } from '../../types';
import type { IFeeSelectorItem } from '../../types/fee';
import type { ESubscriptionType } from '../../types/hyperliquid/types';
import type {
  INotificationPushMessageInfo,
  INotificationViewDialogPayload,
} from '../../types/notification';
import type { IPrimeTransferData } from '../../types/prime/primeTransferTypes';
import type {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
  IFetchQuotesParams,
  ISwapApproveTransaction,
  ISwapQuoteEvent,
  ISwapToken,
  ISwapTokenBase,
} from '../../types/swap/types';
import type { IAccountToken, ITokenFiat } from '../../types/token';
import type { EHomeWalletTab } from '../../types/wallet';
import type { IOneKeyError } from '../errors/types/errorTypes';
import type { EModalRoutes, ETabRoutes } from '../routes';
import type { IWalletConnectSession } from '../walletConnect/types';
import type { FuseResult } from 'fuse.js';

// Supported hardware error types for dialog display
export const HARDWARE_ERROR_DIALOG_TYPES = {
  DEVICE_NOT_FOUND: 'DeviceNotFound',
  NEED_ONEKEY_BRIDGE: 'NeedOneKeyBridge',
  DEVICE_NOT_OPENED_PASSPHRASE: 'DeviceNotOpenedPassphrase',
} as const;

// Hardware error dialog event payload type
export interface IHardwareErrorDialogPayload {
  errorType: string; // Extensible but type-safe error types
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
}

export type IEventBusPayloadShowToast = {
  // IToastProps
  method: 'success' | 'error' | 'message';
  title: string;
  message?: string;
  duration?: number;
  errorCode?: number;
  httpStatusCode?: number;
  toastId?: string;
  i18nKey?: ETranslations;
  requestId?: string;
  diagnosticText?: string;
};
export interface IAppEventBusPayload {
  [EAppEventBusNames.ConfirmAccountSelected]: undefined;
  [EAppEventBusNames.LocalSystemTimeInvalid]: undefined;
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
  };
  [EAppEventBusNames.WalletConnectCloseModal]: undefined;
  [EAppEventBusNames.WalletConnectModalState]: {
    open: boolean;
  };
  [EAppEventBusNames.WalletConnectConnectSuccess]: {
    session: IWalletConnectSession;
  };
  [EAppEventBusNames.WalletConnectConnectError]: {
    error: IOneKeyError;
  };
  [EAppEventBusNames.ShowToast]: IEventBusPayloadShowToast;
  [EAppEventBusNames.ShowAirGapQrcode]: {
    title?: string;
    drawType: IQrcodeDrawType;
    promiseId?: number;
    value?: string;
    valueUr?: IAirGapUrJson;
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
  [EAppEventBusNames.LoadWebEmbedWebView]: undefined;
  [EAppEventBusNames.LoadWebEmbedWebViewComplete]: undefined;
  [EAppEventBusNames.HardwareVerifyAfterDeviceConfirm]: undefined;
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
  [EAppEventBusNames.EstimateTxFeeRetry]: undefined;
  [EAppEventBusNames.TokenListUpdate]: {
    tokens: IAccountToken[];
    keys: string;
    map: Record<string, ITokenFiat>;
    merge?: boolean;
  };
  [EAppEventBusNames.RefreshTokenList]:
    | undefined
    | {
        accounts: {
          accountId: string;
          networkId: string;
        }[];
      };
  [EAppEventBusNames.RefreshHistoryList]: undefined;
  [EAppEventBusNames.RefreshApprovalList]: undefined;
  [EAppEventBusNames.RefreshBookmarkList]: undefined;
  [EAppEventBusNames.TabListStateUpdate]: {
    isRefreshing: boolean;
    type: EHomeTab;
    accountId: string;
    networkId: string;
  };
  [EAppEventBusNames.AccountDataUpdate]: undefined;
  [EAppEventBusNames.AccountValueUpdate]: undefined;
  [EAppEventBusNames.onDragBeginInListView]: undefined;
  [EAppEventBusNames.onDragEndInListView]: undefined;
  [EAppEventBusNames.SidePanel_BgToUI]: {
    type: 'pushModal';
    payload: {
      modalParams: any;
    };
  };
  [EAppEventBusNames.SidePanel_UIToBg]: {
    type: 'dappRejectId';
    payload: {
      rejectId: number | string;
    };
  };
  [EAppEventBusNames.SwapQuoteEvent]: {
    type: 'message' | 'done' | 'error' | 'close' | 'open';
    event: ISwapQuoteEvent;
    params: IFetchQuotesParams;
    accountId?: string;
    tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
  };
  [EAppEventBusNames.ShowSystemDiskFullWarning]: undefined;
  [EAppEventBusNames.SwapTxHistoryStatusUpdate]: {
    status: ESwapTxHistoryStatus;
    crossChainStatus?: ESwapCrossChainStatus;
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
  };
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
  [EAppEventBusNames.PrimeLoginInvalidToken]: undefined;
  [EAppEventBusNames.PrimeExceedDeviceLimit]: undefined;
  [EAppEventBusNames.PrimeDeviceLogout]: undefined;
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
  [EAppEventBusNames.UnlockApp]: undefined;
  [EAppEventBusNames.AddressBookUpdate]: undefined;
  [EAppEventBusNames.MarketWSDataUpdate]: {
    channel: string;
    tokenAddress: string;
    messageType?: string;
    data: any;
    originalData?: any;
  };
  [EAppEventBusNames.MarketWatchlistOnlyChanged]: {
    showWatchlistOnly: boolean;
  };
  [EAppEventBusNames.ClearStorageOnExtension]: undefined;
  [EAppEventBusNames.SettingsSearchResult]: {
    list: {
      title: string;
      icon: string;
      configs: FuseResult<ISubSettingConfig>[];
    }[];
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
  [EAppEventBusNames.ShowNotificationViewDialog]: {
    payload: INotificationViewDialogPayload;
  };
  [EAppEventBusNames.ShowNotificationPageNavigation]: {
    payload: {
      screen: string;
      params: Record<string, any>;
    };
  };
  [EAppEventBusNames.ShowNotificationInDappPage]: string;
  [EAppEventBusNames.UpdateNotificationBadge]: undefined;
  [EAppEventBusNames.BtcFreshAddressUpdated]: undefined;
  [EAppEventBusNames.BtcFreshAddressConnectDappRejected]: undefined;
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
}

export enum EEventBusBroadcastMethodNames {
  uiToBg = 'uiToBg',
  bgToUi = 'bgToUi',
}
type IEventBusBroadcastMethod = (type: string, payload: any) => Promise<void>;

class AppEventBusClass extends CrossEventEmitter {
  broadcastMethodsResolver: Record<
    EEventBusBroadcastMethodNames,
    ((value: IEventBusBroadcastMethod) => void) | undefined
  > = {
    uiToBg: undefined,
    bgToUi: undefined,
  };

  broadcastMethodsReady: Record<
    EEventBusBroadcastMethodNames,
    Promise<IEventBusBroadcastMethod>
  > = {
    uiToBg: new Promise<IEventBusBroadcastMethod>((resolve) => {
      this.broadcastMethodsResolver.uiToBg = resolve;
    }),
    bgToUi: new Promise<IEventBusBroadcastMethod>((resolve) => {
      this.broadcastMethodsResolver.bgToUi = resolve;
    }),
  };

  broadcastMethods: Record<
    EEventBusBroadcastMethodNames,
    IEventBusBroadcastMethod
  > = {
    uiToBg: async (type: string, payload: any) => {
      const fn = await this.broadcastMethodsReady.uiToBg;
      await fn(type, payload);
    },
    bgToUi: async (type: string, payload: any) => {
      const fn = await this.broadcastMethodsReady.bgToUi;
      await fn(type, payload);
    },
  };

  registerBroadcastMethods(
    name: EEventBusBroadcastMethodNames,
    method: IEventBusBroadcastMethod,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.broadcastMethodsResolver[name]!(method);
  }

  get shouldEmitToSelf() {
    return (
      !platformEnv.isExtensionOffscreen &&
      !platformEnv.isExtensionUi &&
      !platformEnv.isWebEmbed
    );
  }

  override emit<T extends EAppEventBusNames>(
    type: T,
    payload: IAppEventBusPayload[T],
  ): boolean {
    void this.emitToRemote({ type, payload });
    if (this.shouldEmitToSelf) {
      this.emitToSelf({ type, payload });
    }
    return true;
  }

  override once<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.once(type, listener);
  }

  override on<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.on(type, listener);
  }

  override off<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.off(type, listener);
  }

  override addListener<T extends EAppEventBusNames>(
    type: T,
    listener: (payload: IAppEventBusPayload[T]) => void,
  ) {
    return super.addListener(type, listener);
  }

  override removeListener<T extends EAppEventBusNames>(
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
    } catch (e) {
      // ignore
    }
    super.emit(type, payloadCloned);
    return true;
  }

  //

  async emitToRemote(params: { type: string; payload: any }) {
    const { type, payload } = params;
    const convertToRemoteEventPayload = (p: any) => {
      const payloadCloned = cloneDeep(p);
      try {
        if (payloadCloned) {
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          payloadCloned.$$isRemoteEvent = true;
        }
      } catch (e) {
        // ignore
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return payloadCloned;
    };

    if (platformEnv.isExtensionOffscreen || platformEnv.isWebEmbed) {
      // request background
      throw new OneKeyLocalError(
        'offscreen or webembed event bus not support yet.',
      );
    }
    if (platformEnv.isNative) {
      // requestToWebEmbed
    }
    if (platformEnv.isExtensionUi) {
      // request background
      return this.broadcastMethods.uiToBg(
        type,
        convertToRemoteEventPayload(payload),
      );
    }
    if (platformEnv.isExtensionBackground) {
      // requestToOffscreen
      // requestToAllUi
      return this.broadcastMethods.bgToUi(
        type,
        convertToRemoteEventPayload(payload),
      );
    }
  }
}
const appEventBus = new AppEventBusClass();

appGlobals.$appEventBus = appEventBus;

export { appEventBus, AppEventBusClass, EAppEventBusNames };
