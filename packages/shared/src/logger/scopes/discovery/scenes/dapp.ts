import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

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
    isConnectWallet: boolean;
    isSendTxn: boolean;
    walletAddress: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public connectDapp(params: {
    dappName: string;
    dappDomain: string;
    network?: string;
    isSuccess: boolean;
    failReason?: string;
    walletAddress?: string;
  }) {
    return params;
  }
}
