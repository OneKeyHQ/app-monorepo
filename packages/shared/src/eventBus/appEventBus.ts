/* eslint-disable import/no-named-as-default-member */
import { CrossEventEmitter } from '@onekeyfe/cross-inpage-provider-core';

import type { IQrcodeDrawType } from '@onekeyhq/components';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';

import appGlobals from '../appGlobals';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

import type { EAccountSelectorSceneName, EHomeTab } from '../../types';
import type { IFeeSelectorItem } from '../../types/fee';
import type {
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
  ShowToast = 'ShowToast',
  ShowAirGapQrcode = 'ShowAirGapQrcode',
  HideAirGapQrcode = 'HideAirGapQrcode',
  RealmInit = 'RealmInit',
  V4RealmInit = 'V4RealmInit',
  SyncDeviceLabelToWalletName = 'SyncDeviceLabelToWalletName',
  BatchCreateAccount = 'BatchCreateAccount',
  ExtensionContextMenuUpdate = 'ExtensionContextMenuUpdate',
  ShowFirmwareUpdateFromBootloaderMode = 'ShowFirmwareUpdateFromBootloaderMode',
  ShowFirmwareUpdateForce = 'ShowFirmwareUpdateForce',
  BeginFirmwareUpdate = 'BeginFirmwareUpdate', // notification begin hardware update, stop hardware progressing
  LoadWebEmbedWebView = 'LoadWebEmbedWebView',
  LoadWebEmbedWebViewComplete = 'LoadWebEmbedWebViewComplete',
  HardwareVerifyAfterDeviceConfirm = 'HardwareVerifyAfterDeviceConfirm',
  SwitchMarketHomeTab = 'SwitchMarketHomeTab',
  ClearLocalHistoryPendingTxs = 'ClearLocalHistoryPendingTxs',
  TxFeeInfoChanged = 'TxFeeInfoChanged',
  SendConfirmContainerMounted = 'SendConfirmContainerMounted',
  CloseHardwareUiStateDialogManually = 'CloseHardwareUiStateDialogManually',
  HardCloseHardwareUiStateDialog = 'CloseHardwareUiStateDialog',
  HistoryTxStatusChanged = 'HistoryTxStatusChanged',
  EstimateTxFeeRetry = 'estimateTxFeeRetry',
  TokenListUpdate = 'TokenListUpdate',
  TabListStateUpdate = 'TabListStateUpdate',
  RefreshTokenList = 'RefreshTokenList',
  AccountDataUpdate = 'AccountDataUpdate',
  onDragBeginInListView = 'onDragBeginInListView',
  onDragEndInListView = 'onDragEndInListView',
  SidePanel_BgToUI = 'SidePanel_BgToUI',
  SidePanel_UIToBg = 'SidePanel_UIToBg',
  SwapQuoteEvent = 'SwapQuoteEvent',
  AddedCustomNetwork = 'AddedCustomNetwork',
  ShowFindInWebPage = 'ShowFindInWebPage',
  ChangeTokenDetailTabVerticalScrollEnabled = 'ChangeTokenDetailTabVerticalScrollEnabled',
  RefreshNetInfo = 'RefreshNetInfo',
  ShowSwitchAccountSelector = 'ShowSwitchAccountSelector',
  CreateAddressByDialog = 'CreateAddressByDialog',
  // AccountNameChanged = 'AccountNameChanged',
  // CurrencyChanged = 'CurrencyChanged',
  // BackupRequired = 'BackupRequired',
  // NotificationStatusChanged = 'NotificationStatusChanged',
  // StoreInitedFromPersistor = 'StoreInitedFromPersistor',
  // Unlocked = 'Unlocked',
  // HttpServerRequest = 'HttpServerRequest',
}

export interface IAppEventBusPayload {
  [EAppEventBusNames.ConfirmAccountSelected]: undefined;
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
  [EAppEventBusNames.ShowToast]: {
    // IToastProps
    method: 'success' | 'error' | 'message';
    title: string;
    message?: string;
    duration?: number;
    errorCode?: number;
  };
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
  [EAppEventBusNames.LoadWebEmbedWebView]: undefined;
  [EAppEventBusNames.LoadWebEmbedWebViewComplete]: undefined;
  [EAppEventBusNames.HardwareVerifyAfterDeviceConfirm]: undefined;
  [EAppEventBusNames.SwitchMarketHomeTab]: {
    tabIndex: number;
  };
  [EAppEventBusNames.ClearLocalHistoryPendingTxs]: undefined;
  [EAppEventBusNames.TxFeeInfoChanged]: {
    feeSelectorItems: IFeeSelectorItem[];
  };
  [EAppEventBusNames.SendConfirmContainerMounted]: undefined;
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
    if (this.shouldEmitToSelf) {
      defaultLogger.app.eventBus.emitToSelf({
        eventName: type,
      });
      this.emitToSelf(type, payload);
    }
    void this.emitToRemote(type, payload);
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

  emitToSelf(type: EAppEventBusNames, ...args: any[]) {
    super.emit(type, ...args);
    return true;
  }

  async emitToRemote(type: string, payload: any) {
    if (platformEnv.isExtensionOffscreen || platformEnv.isWebEmbed) {
      // request background
      throw new Error('offscreen or webembed event bus not support yet.');
    }
    if (platformEnv.isNative) {
      // requestToWebEmbed
    }
    if (platformEnv.isExtensionUi) {
      // request background
      return this.broadcastMethods.uiToBg(type, payload);
    }
    if (platformEnv.isExtensionBackground) {
      // requestToOffscreen
      // requestToAllUi
      return this.broadcastMethods.bgToUi(type, payload);
    }
  }
}
const appEventBus = new AppEventBus();

if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$appEventBus = appEventBus;
}

export { appEventBus };
