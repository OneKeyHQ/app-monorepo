import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export type IWalletAllNetworkLowBalanceParams = {
  source: 'home_all_network';
  balanceBucket: 'lt_1_usd';
  thresholdUsd: '1';
  thresholdCurrency: 'usd';
  walletType: 'hd' | 'hw' | 'qr';
};

export class WalletBalanceScene extends BaseScene {
  @LogToServer()
  public walletAllNetworkLowBalance(params: IWalletAllNetworkLowBalanceParams) {
    return params;
  }
}
