import type {
  IPerpsDepositWithdrawActionType,
  ISetTpslParams,
} from '@onekeyhq/shared/types/hyperliquid/routes';

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
    actionType?: IPerpsDepositWithdrawActionType;
  };
  [EModalPerpRoutes.PerpsInviteeRewardModal]: undefined;
  [EModalPerpRoutes.MobilePortfolioPage]: undefined;
  [EModalPerpRoutes.PerpGuidePage]: undefined;
  [EModalPerpRoutes.PerpPortfolioModal]: undefined;
};
