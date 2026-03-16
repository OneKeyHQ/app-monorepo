import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

export enum EPerpPageEnterSource {
  TabBar = 'tabBar',
  Notification = 'notification',
  MarketList = 'marketList',
  MarketBanner = 'marketBanner',
  WalletBanner = 'walletBanner',
  UniversalSearch = 'search',
  PopularTrading = 'popularTrading',
  Referral = 'referral',
  Shortcut = 'shortcut',
  DirectUrl = 'directUrl',
}

export interface IPerpDepositInitiateParams {
  userAddress: string;
  receiverAddress: string;
  txId?: string;
  token: IPerpsDepositToken;
  amount: string;
  toAmount: string;
  status: ESwapTxHistoryStatus;
  errorMessage?: string;
}

export interface IPerpUserSelectDepositTokenParams {
  userAddress: string;
  depositToken: IPerpsDepositToken;
}
