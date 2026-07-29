import type { ISetTpslParams } from '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal';

import type { IUnifoldSupportedAsset } from '../../types/unifoldDeposit';

export enum EModalPerpRoutes {
  PerpTradersHistoryList = 'PerpTradersHistoryList',
  MobilePerpMarket = 'MobilePerpMarket',
  MobileTokenSelector = 'MobileTokenSelector',
  MobileSetTpsl = 'MobileSetTpsl',
  MobileDepositWithdrawModal = 'MobileDepositWithdrawModal',
  MobileDepositSelectToken = 'MobileDepositSelectToken',
  MobileUnifoldDepositTransfer = 'MobileUnifoldDepositTransfer',
  MobileUnifoldSourceSelector = 'MobileUnifoldSourceSelector',
  MobileUnifoldDepositTracker = 'MobileUnifoldDepositTracker',
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

export type IUnifoldSourceSelectorResult =
  | {
      requestId: string;
      mode: 'token';
      assetSymbol: string;
    }
  | {
      requestId: string;
      mode: 'chain';
      assetSymbol: string;
      chainType: string;
      chainId: string;
    };

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
    depositTokenListOwnerKey?: string;
    hasLoadedDepositTokenBalances?: boolean;
    symbol: string;
  };
  // expectedRecipient is never trusted directly: the session hook cross-checks
  // it against the live active-account atom and fails closed on mismatch.
  [EModalPerpRoutes.MobileUnifoldDepositTransfer]: {
    expectedRecipient: string;
    sourceSelectorResult?: IUnifoldSourceSelectorResult;
  };
  [EModalPerpRoutes.MobileUnifoldSourceSelector]: {
    requestId: string;
    mode: 'token' | 'chain';
    assets: IUnifoldSupportedAsset[];
    selectedAssetSymbol?: string;
    selectedChainType?: string;
    selectedChainId?: string;
  };
  [EModalPerpRoutes.MobileUnifoldDepositTracker]: {
    expectedRecipient: string;
  };
  [EModalPerpRoutes.PerpsInviteeRewardModal]: undefined;
  [EModalPerpRoutes.MobilePortfolioPage]: undefined;
  [EModalPerpRoutes.PerpGuidePage]: undefined;
};
