import type { ISetTpslParams } from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal';

export enum EModalPerpRoutes {
  PerpTradersHistoryList = 'PerpTradersHistoryList',
  MobilePerpMarket = 'MobilePerpMarket',
  MobileTokenSelector = 'MobileTokenSelector',
  MobileSetTpsl = 'MobileSetTpsl',
  MobileDepositWithdrawModal = 'MobileDepositWithdrawModal',
}

export type IModalPerpParamList = {
  [EModalPerpRoutes.PerpTradersHistoryList]: undefined;
  [EModalPerpRoutes.MobilePerpMarket]: undefined;
  [EModalPerpRoutes.MobileTokenSelector]: undefined;
  [EModalPerpRoutes.MobileSetTpsl]: ISetTpslParams;
  [EModalPerpRoutes.MobileDepositWithdrawModal]: undefined;
};
