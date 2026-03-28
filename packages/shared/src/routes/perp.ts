import type { ISetTpslParams } from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal';

export enum EModalPerpRoutes {
  PerpTradersHistoryList = 'PerpTradersHistoryList',
  MobilePerpMarket = 'MobilePerpMarket',
  MobileTokenSelector = 'MobileTokenSelector',
  MobileSetTpsl = 'MobileSetTpsl',
  MobileDepositWithdrawModal = 'MobileDepositWithdrawModal',
  PerpsInviteeRewardModal = 'PerpsInviteeRewardModal',
  MobilePortfolioPage = 'MobilePortfolioPage',
}

export type IModalPerpParamList = {
  [EModalPerpRoutes.PerpTradersHistoryList]: undefined;
  [EModalPerpRoutes.MobilePerpMarket]: undefined;
  [EModalPerpRoutes.MobileTokenSelector]: undefined;
  [EModalPerpRoutes.MobileSetTpsl]: ISetTpslParams;
  [EModalPerpRoutes.MobileDepositWithdrawModal]: {
    actionType?: 'deposit' | 'withdraw';
  };
  [EModalPerpRoutes.PerpsInviteeRewardModal]: undefined;
  [EModalPerpRoutes.MobilePortfolioPage]: undefined;
};
