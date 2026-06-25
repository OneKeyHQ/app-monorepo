import type { ISetTpslParams } from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal';

export enum EModalPerpRoutes {
  PerpTradersHistoryList = 'PerpTradersHistoryList',
  MobilePerpMarket = 'MobilePerpMarket',
  MobileTokenSelector = 'MobileTokenSelector',
  MobileSetTpsl = 'MobileSetTpsl',
  MobileDepositWithdrawModal = 'MobileDepositWithdrawModal',
  MobileDepositSelectToken = 'MobileDepositSelectToken',
  PerpsInviteeRewardModal = 'PerpsInviteeRewardModal',
  MobilePortfolioPage = 'MobilePortfolioPage',
  PerpGuidePage = 'PerpGuidePage',
}

// Keep this route payload shape duplicated in shared because shared cannot
// import the kit-bg perps token type without breaking package boundaries.
export type IPerpsDepositTokenRouteItem = {
  networkId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  networkLogoURI: string;
  price?: string;
  balanceParsed?: string;
  fiatValue?: string;
  isNative?: boolean;
  logoURI?: string;
};

export type IPerpHistoryTab = 'Trades' | 'Twap' | 'Account';

export type IModalPerpParamList = {
  [EModalPerpRoutes.PerpTradersHistoryList]:
    | { initialTab?: IPerpHistoryTab }
    | undefined;
  [EModalPerpRoutes.MobilePerpMarket]: undefined;
  [EModalPerpRoutes.MobileTokenSelector]: undefined;
  [EModalPerpRoutes.MobileSetTpsl]: ISetTpslParams;
  [EModalPerpRoutes.MobileDepositWithdrawModal]: {
    actionType?: 'deposit' | 'withdraw';
  };
  [EModalPerpRoutes.MobileDepositSelectToken]: {
    depositTokensWithPrice: IPerpsDepositTokenRouteItem[];
    symbol: string;
  };
  [EModalPerpRoutes.PerpsInviteeRewardModal]: undefined;
  [EModalPerpRoutes.MobilePortfolioPage]: undefined;
  [EModalPerpRoutes.PerpGuidePage]: undefined;
};
