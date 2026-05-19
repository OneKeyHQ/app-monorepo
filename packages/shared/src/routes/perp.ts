import type { ISetTpslParams } from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal';

export enum EModalPerpRoutes {
  PerpTradersHistoryList = 'PerpTradersHistoryList',
  MobilePerpMarket = 'MobilePerpMarket',
  MobileTokenSelector = 'MobileTokenSelector',
  MobileSetTpsl = 'MobileSetTpsl',
  MobileDepositWithdrawModal = 'MobileDepositWithdrawModal',
  PerpsInviteeRewardModal = 'PerpsInviteeRewardModal',
  MobilePortfolioPage = 'MobilePortfolioPage',
  PerpGuidePage = 'PerpGuidePage',
  PerpPortfolioModal = 'PerpPortfolioModal',
}

export type IModalPerpParamList = {
  [EModalPerpRoutes.PerpTradersHistoryList]: undefined;
  [EModalPerpRoutes.MobilePerpMarket]: undefined;
  [EModalPerpRoutes.MobileTokenSelector]: undefined;
  [EModalPerpRoutes.MobileSetTpsl]: ISetTpslParams;
  [EModalPerpRoutes.MobileDepositWithdrawModal]: {
    actionType?:
      | 'deposit'
      | 'depositSelect'
      | 'withdraw'
      | 'walletDeposit'
      | 'relay';
  };
  [EModalPerpRoutes.PerpsInviteeRewardModal]: undefined;
  [EModalPerpRoutes.MobilePortfolioPage]: undefined;
  [EModalPerpRoutes.PerpGuidePage]: undefined;
  [EModalPerpRoutes.PerpPortfolioModal]: undefined;
};
