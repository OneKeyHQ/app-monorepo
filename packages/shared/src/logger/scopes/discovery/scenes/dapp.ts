import type { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export enum EEnterMethod {
  banner = 'banner',
  dashboard = 'dashboard',
  search = 'search',
  addressBar = 'addressBar',
  history = 'history',
  bookmark = 'bookmark',
  bookmarkInSearch = 'bookmarkInSearch',
  historyInSearch = 'historyInSearch',
}

export class DappScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public enterDapp(params: {
    dappDomain: string;
    dappName: string;
    dappCatalog?: string;
    enterMethod: EEnterMethod;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public dappUse(params: {
    dappName: string;
    dappDomain: string;
    action: 'ConnectWallet' | 'SendTxn';
    network?: string;
    failReason?: string;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dappOpenModal(params: {
    request: IJsBridgeMessagePayload;
    screens: any[];
    params?: any;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dappRequest(params: { request: IJsBridgeMessagePayload }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public disconnect(params: {
    dappDomain: string;
    disconnectType: 'Injected' | 'WalletConnect';
    disconnectFrom:
      | 'Browser'
      | 'SettingModal'
      | 'ExtPanel'
      | 'ExtFloatingTrigger';
  }) {
    return params;
  }

  @LogToLocal()
  public dappRiskDetect(params: {
    riskLevel: EHostSecurityLevel;
    showContinueOperateCheckBox: boolean;
    currentContinueOperate: boolean;
  }) {
    return params;
  }
}
