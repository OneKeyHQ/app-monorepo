import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

type IWalletActionBaseParams = {
  walletType: string;
  networkId: string;
  source: 'homePage' | 'tokenDetails' | 'earn' | 'swap';
};

export class WalletActionsScene extends BaseScene {
  @LogToServer()
  public actionBuy(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionSell(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionTrade(
    params: IWalletActionBaseParams & {
      tradeType: ESwapTabSwitchType;
    },
  ) {
    return params;
  }

  @LogToServer()
  public actionSend(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionReceive(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionEarn(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionCopyAddress(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionViewInExplorer(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionExportPublicKey(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionExportXpub(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionExportPrivateKey(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionExportXprvt(params: IWalletActionBaseParams) {
    return params;
  }
}
