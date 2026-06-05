import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IWalletAssetStatus = 'low' | 'funded';
export type IWalletAssetStatusPreviousStatus = IWalletAssetStatus | 'unknown';
export type IWalletAssetStatusBalanceBucket = 'lt_1_usd' | 'gte_1_usd';
export type IWalletAssetStatusChangeReason =
  | 'below_threshold'
  | 'above_threshold';

export type IWalletAssetStatusBaseParams = {
  source: 'home_all_network';
  scope: 'instance';
  assetStatus: IWalletAssetStatus;
  balanceBucket: IWalletAssetStatusBalanceBucket;
  thresholdUsd: '1';
  thresholdCurrency: 'usd';
  assetBasis: 'all_eligible_wallets_token_usd';
  eligibleWalletTypes: 'hd_hw_qr';
  eligibleWalletCount: number;
  eligibleAccountCount: number;
  knownAccountCount: number;
  unknownAccountCount: number;
};

export type IWalletAssetStatusChangedParams = IWalletAssetStatusBaseParams & {
  previousStatus: IWalletAssetStatusPreviousStatus;
  currentStatus: IWalletAssetStatus;
  changeReason: IWalletAssetStatusChangeReason;
};

export type IWalletAssetStatusEvaluatedParams = IWalletAssetStatusBaseParams;

function normalizeAssetStatusParams<T extends IWalletAssetStatusBaseParams>(
  params: T,
) {
  return params;
}

function normalizeAssetStatusChangedParams(
  params: IWalletAssetStatusChangedParams,
) {
  return params;
}

export class WalletBalanceScene extends BaseScene {
  @LogToLocal()
  @LogToServer()
  public walletAssetStatusEvaluated(params: IWalletAssetStatusEvaluatedParams) {
    return normalizeAssetStatusParams(params);
  }

  @LogToLocal()
  @LogToServer()
  public walletAssetStatusChanged(params: IWalletAssetStatusChangedParams) {
    return normalizeAssetStatusChangedParams(params);
  }
}
