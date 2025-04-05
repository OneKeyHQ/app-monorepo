/* eslint-disable import/no-named-as-default-member */
import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';
import { cloneDeep } from 'lodash';

import type {
  IDialogLoadingProps,
  IQrcodeDrawType,
} from '@onekeyhq/components';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { EHardwareUiStateAction } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';

import appGlobals from '../appGlobals';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

import type { EAccountSelectorSceneName, EHomeTab } from '../../types';
import type { IFeeSelectorItem } from '../../types/fee';
import type {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
  IFetchQuotesParams,
  ISwapQuoteEvent,
  ISwapToken,
} from '../../types/swap/types';
import type { IAccountToken, ITokenFiat } from '../../types/token';
import type { IOneKeyError } from '../errors/types/errorTypes';

export enum EFinalizeWalletSetupSteps {
  CreatingWallet = 'CreatingWallet',
  GeneratingAccounts = 'GeneratingAccounts',
  EncryptingData = 'EncryptingData',
  Ready = 'Ready',
}
export enum EAppEventBusNames {
  ConfirmAccountSelected = 'ConfirmAccountSelected',
  WalletClear = 'WalletClear',
  WalletUpdate = 'WalletUpdate',
  WalletRemove = 'WalletRemove',
  WalletRename = 'WalletRename',
  AccountUpdate = 'AccountUpdate',
  AccountRemove = 'AccountRemove',
  AddDBAccountsToWallet = 'AddDBAccountsToWallet',
  RenameDBAccounts = 'RenameDBAccounts',
  CloseCurrentBrowserTab = 'CloseCurrentBrowserTab',
  DAppConnectUpdate = 'DAppConnectUpdate',
  OnSwitchDAppNetwork = 'OnSwitchDAppNetwork',
  DAppNetworkUpdate = 'DAppNetworkUpdate',
  DAppLastFocusUrlUpdate = 'DAppLastFocusUrlUpdate',
  SyncDappAccountToHomeAccount = 'SyncDappAccountToHomeAccount',
  GlobalDeriveTypeUpdate = 'GlobalDeriveTypeUpdate',
  NetworkDeriveTypeChanged = 'NetworkDeriveTypeChanged',
  AccountSelectorSelectedAccountUpdate = 'AccountSelectorSelectedAccountUpdate',
  FinalizeWalletSetupStep = 'FinalizeWalletSetupStep',
  FinalizeWalletSetupError = 'FinalizeWalletSetupError',
  WalletConnectOpenModal = 'WalletConnectOpenModal',
  WalletConnectCloseModal = 'WalletConnectCloseModal',
  WalletConnectModalState = 'WalletConnectModalState',
  ShowDialogLoading = 'ShowDialogLoading',
  HideDialogLoading = 'HideDialogLoading',
  ShowToast = 'ShowToast',
  ShowAirGapQrcode = 'ShowAirGapQrcode',
  HideAirGapQrcode = 'HideAirGapQrcode',
  RealmInit = 'RealmInit',
  V4RealmInit = 'V4RealmInit',
  SyncDeviceLabelToWalletName = 'SyncDeviceLabelToWalletName',
  UpdateWalletAvatarByDeviceSerialNo = 'UpdateWalletAvatarByDeviceSerialNo',
  BatchCreateAccount = 'BatchCreateAccount',
  ExtensionContextMenuUpdate = 'ExtensionContextMenuUpdate',
  ShowFirmwareUpdateFromBootloaderMode = 'ShowFirmwareUpdateFromBootloaderMode',
  ShowFirmwareUpdateForce = 'ShowFirmwareUpdateForce',
  BeginFirmwareUpdate = 'BeginFirmwareUpdate', // notification begin hardware update, stop hardware progressing
  FinishFirmwareUpdate = 'FinishFirmwareUpdate',
  LoadWebEmbedWebView = 'LoadWebEmbedWebView',
  LoadWebEmbedWebViewComplete = 'LoadWebEmbedWebViewComplete',
  HardwareVerifyAfterDeviceConfirm = 'HardwareVerifyAfterDeviceConfirm',
  SwitchMarketHomeTab = 'SwitchMarketHomeTab',
  RefreshMarketWatchList = 'RefreshMarketWatchList',
  RefreshCustomRpcList = 'RefreshCustomRpcList',
  ClearLocalHistoryPendingTxs = 'ClearLocalHistoryPendingTxs',
  TxFeeInfoChanged = 'TxFeeInfoChanged',
  SignatureConfirmContainerMounted = 'SignatureConfirmContainerMounted',
  CloseHardwareUiStateDialogManually = 'CloseHardwareUiStateDialogManually',
  HardCloseHardwareUiStateDialog = 'CloseHardwareUiStateDialog',
  HistoryTxStatusChanged = 'HistoryTxStatusChanged',
  EstimateTxFeeRetry = 'estimateTxFeeRetry',
  TokenListUpdate = 'TokenListUpdate',
  TabListStateUpdate = 'TabListStateUpdate',
  RefreshTokenList = 'RefreshTokenList',
  RefreshHistoryList = 'RefreshHistoryList',
  RefreshBookmarkList = 'RefreshBookmarkList',
  AccountDataUpdate = 'AccountDataUpdate',
  onDragBeginInListView = 'onDragBeginInListView',
  onDragEndInListView = 'onDragEndInListView',
  SidePanel_BgToUI = 'SidePanel_BgToUI',
  SidePanel_UIToBg = 'SidePanel_UIToBg',
  SwapQuoteEvent = 'SwapQuoteEvent',
  SwapTxHistoryStatusUpdate = 'SwapTxHistoryStatusUpdate',
  AddedCustomNetwork = 'AddedCustomNetwork',
  ShowFindInWebPage = 'ShowFindInWebPage',
  ChangeTokenDetailTabVerticalScrollEnabled = 'ChangeTokenDetailTabVerticalScrollEnabled',
  RefreshNetInfo = 'RefreshNetInfo',
  ShowSwitchAccountSelector = 'ShowSwitchAccountSelector',
  PrimeLoginInvalidToken = 'PrimeLoginInvalidToken',
  PrimeExceedDeviceLimit = 'PrimeExceedDeviceLimit',
  PrimeDeviceLogout = 'PrimeDeviceLogout',
  PrimeMasterPasswordInvalid = 'PrimeMasterPasswordInvalid',
  CreateAddressByDialog = 'CreateAddressByDialog',
  CheckAddressBeforeSending = 'CheckAddressBeforeSending',
  HideTabBar = 'HideTabBar',
  RequestHardwareUIDialog = 'RequestHardwareUIDialog',
  RequestDeviceInBootloaderForWebDevice = 'RequestDeviceInBootloaderForWebDevice',
  // AccountNameChanged = 'AccountNameChanged',
  // CurrencyChanged = 'CurrencyChanged',
  // BackupRequired = 'BackupRequired',
  // NotificationStatusChanged = 'NotificationStatusChanged',
  // StoreInitedFromPersistor = 'StoreInitedFromPersistor',
  // Unlocked = 'Unlocked',
  // HttpServerRequest = 'HttpServerRequest',
}

export type IEventBusPayloadShowToast = {
  // IToastProps
  method: 'success' | 'error' | 'message';
  title: string;
  message?: string;
  duration?: number;
  errorCode?: number;
  toastId?: string;
  i18nKey?: ETranslations;
};
export interface IAppEventBusPayload {
  [EAppEventBusNames.ConfirmAccountSelected]: undefined;
  [EAppEventBusNames.ShowDialogLoading]: IDialogLoadingProps;
  [EAppEventBusNames.HideDialogLoading]: undefined;
  [EAppEventBusNames.WalletClear]: undefined;
  [EAppEventBusNames.WalletUpdate]: undefined;
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
  [EAppEventBusNames.RefreshBookmarkList]: undefined;
  [EAppEventBusNames.TabListStateUpdate]: {
    isRefreshing: boolean;
    type: EHomeTab;
    accountId: string;
    networkId: string;
  };
  [EAppEventBusNames.AccountDataUpdate]: undefined;
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
  [EAppEventBusNames.CheckAddressBeforeSending]: {
    promiseId: number;
    type: 'scam' | 'contract';
  };
  [EAppEventBusNames.HideTabBar]: boolean;
  [EAppEventBusNames.RequestHardwareUIDialog]: {
    uiRequestType: EHardwareUiStateAction;
  };
  [EAppEventBusNames.RequestDeviceInBootloaderForWebDevice]: undefined;
}

export enum EEventBusBroadcastMethodNames {
  uiToBg = 'uiToBg',
  bgToUi = 'bgToUi',
}
type IEventBusBroadcastMethod = (type: string, payload: any) => Promise<void>;

class AppEventBus extends CrossEventEmitter {
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
  }) {
    const { type, payload, isRemote } = params;
    defaultLogger.app.eventBus.emitToSelf({
      eventName: type,
    });
    const payloadCloned = cloneDeep(payload);
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
      throw new Error('offscreen or webembed event bus not support yet.');
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
const appEventBus = new AppEventBus();

if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$appEventBus = appEventBus;
}

export { appEventBus };
