import type { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';

import type {
  EAvailableAssetsTypeEnum,
  IEarnAvailableAsset,
} from '../../types/earn';
import type {
  IBorrowAsset,
  IEarnAlert,
  IEarnTokenInfo,
  IEarnTokenItem,
  IProtocolInfo,
  IStakeProtocolDetails,
} from '../../types/staking';

export enum EModalStakingRoutes {
  InvestmentDetails = 'InvestmentDetails',
  Stake = 'Stake',
  Withdraw = 'Withdraw',
  ManagePosition = 'ManagePosition',
  BorrowManagePosition = 'BorrowManagePosition',
  BorrowTokenSelect = 'BorrowTokenSelect',
  BorrowReserveDetails = 'BorrowReserveDetails',
  Claim = 'Claim',
  ProtocolDetails = 'ProtocolDetails',
  ProtocolDetailsV2 = 'ProtocolDetailsV2',
  ProtocolDetailsV2Share = 'ProtocolDetailsV2Share',
  AssetProtocolList = 'AssetProtocolList',
  ClaimOptions = 'ClaimOptions',
  WithdrawOptions = 'WithdrawOptions',
  PortfolioDetails = 'PortfolioDetails',
  HistoryList = 'HistoryList',
  BorrowHistoryList = 'BorrowHistoryList',
  EarnTokenSelect = 'EarnTokenSelect',
  EarnAssetSearch = 'EarnAssetSearch',
}

type IBaseRouteParams = {
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
};

interface IDetailPageInfoParams extends IBaseRouteParams {
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  symbol?: string;
  provider?: string;
}
export type IModalStakingParamList = {
  [EModalStakingRoutes.InvestmentDetails]: undefined;
  [EModalStakingRoutes.ProtocolDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
    vault?: string;
  };
  [EModalStakingRoutes.ProtocolDetailsV2]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
    vault?: string;
  };
  [EModalStakingRoutes.ProtocolDetailsV2Share]: {
    network: string; // network name, like 'ethereum', 'bitcoin'
    symbol: string;
    provider: string;
    vault?: string;
    details?: IStakeProtocolDetails;
    // note: does not contain accountId, etc. account information
  };
  [EModalStakingRoutes.ManagePosition]: {
    networkId: string;
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
    vault?: string;
    tab?: 'deposit' | 'withdraw';
    tokenImageUri?: string;
  };
  [EModalStakingRoutes.BorrowManagePosition]: IBaseRouteParams & {
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    symbol: string;
    logoURI?: string;
    providerLogoURI?: string;
    type?: EManagePositionType;
  };
  [EModalStakingRoutes.BorrowTokenSelect]: IBaseRouteParams & {
    provider: string;
    marketAddress: string;
    action: 'supply' | 'borrow';
    currentReserveAddress?: string;
    onSelect?: (asset: IBorrowAsset) => void;
  };
  [EModalStakingRoutes.BorrowReserveDetails]: {
    networkId: string;
    provider: string;
    marketAddress: string;
    reserveAddress: string;
    symbol: string;
    logoURI?: string;
    accountId?: string;
    indexedAccountId?: string;
  };
  [EModalStakingRoutes.Stake]: IDetailPageInfoParams & {
    currentAllowance: string;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.Withdraw]: IDetailPageInfoParams & {
    rate?: string;
    identity?: string;
    amount?: string;
    fromPage?: EModalStakingRoutes.WithdrawOptions;
    onSuccess?: () => void;
    allowPartialWithdraw?: boolean;
  };
  [EModalStakingRoutes.Claim]: IDetailPageInfoParams & {
    amount?: string;
    onSuccess?: () => void;
    identity?: string;
    claimableAmount?: string;
  };
  [EModalStakingRoutes.ClaimOptions]: IDetailPageInfoParams & {
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.WithdrawOptions]: IDetailPageInfoParams & {
    onSuccess?: () => void;
    isInModalContext?: boolean;
  };
  [EModalStakingRoutes.AssetProtocolList]: IBaseRouteParams & {
    symbol: string;
    filter?: boolean;
  };
  [EModalStakingRoutes.PortfolioDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
  };
  [EModalStakingRoutes.HistoryList]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    stakeTag?: string;
    protocolVault?: string;
    filterType?: string;
    title?: string;
    alerts?: IEarnAlert[];
  };
  [EModalStakingRoutes.BorrowHistoryList]: IBaseRouteParams & {
    provider: string;
    marketAddress: string;
    title?: string;
    type?: string;
  };
  [EModalStakingRoutes.EarnTokenSelect]: {
    networkId: string;
    accountId: string;
    provider: string;
    symbol: string;
    vault?: string;
    action: 'stake' | 'unstake';
    currentTokenAddress?: string;
    onSelect?: (token: IEarnTokenItem) => void;
  };
  [EModalStakingRoutes.EarnAssetSearch]: {
    availableAssetsByType: Partial<
      Record<EAvailableAssetsTypeEnum, IEarnAvailableAsset[]>
    >;
    initialCategoryType?: EAvailableAssetsTypeEnum;
    onAssetSelect?: (
      asset: IEarnAvailableAsset,
      categoryType: EAvailableAssetsTypeEnum,
    ) => void;
  };
};
