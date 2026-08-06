import type {
  EAvailableAssetsTypeEnum,
  IEarnAvailableAsset,
} from '../../types/earn';
import type {
  EManagePositionType,
  IBorrowAsset,
  IEarnAlert,
  IEarnTokenInfo,
  IEarnTokenItem,
  IEarnWithdrawType,
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
  BorrowEModeSwitch = 'BorrowEModeSwitch',
  BorrowEModeNeedAction = 'BorrowEModeNeedAction',
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

type IBorrowManagePositionRouteParams = IBaseRouteParams & {
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  providerDisplayName?: string;
  providerLogoURI?: string;
  type?: EManagePositionType;
};

type IBorrowTokenSelectAction =
  | {
      navigateOnSelect: {
        screen: EModalStakingRoutes.BorrowManagePosition;
        params: Pick<
          IBorrowManagePositionRouteParams,
          'providerDisplayName' | 'providerLogoURI'
        > & {
          type: EManagePositionType;
        };
      };
      onSelect?: never;
      closeOnSelect?: never;
    }
  | {
      navigateOnSelect?: never;
      onSelect?: (asset: IBorrowAsset) => void;
      /** Defaults to true. Set false when onSelect navigates onward itself, so
       * the list stays underneath and Back returns to it. */
      closeOnSelect?: boolean;
    };

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
    enableProtocolSwitch?: boolean;
  };
  [EModalStakingRoutes.BorrowManagePosition]: IBorrowManagePositionRouteParams;
  [EModalStakingRoutes.BorrowEModeSwitch]: IBaseRouteParams & {
    provider: string;
    marketAddress: string;
  };
  [EModalStakingRoutes.BorrowEModeNeedAction]: IBaseRouteParams & {
    provider: string;
    marketAddress: string;
    targetEModeId: number;
    categoryLabel: string;
  };
  [EModalStakingRoutes.BorrowTokenSelect]: IBaseRouteParams & {
    provider: string;
    marketAddress: string;
    action: 'supply' | 'borrow';
    currentReserveAddress?: string;
  } & IBorrowTokenSelectAction;
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
    withdrawType?: IEarnWithdrawType;
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
