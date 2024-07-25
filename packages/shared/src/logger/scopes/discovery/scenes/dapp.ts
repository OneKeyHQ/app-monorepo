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
}
