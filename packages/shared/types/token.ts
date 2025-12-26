import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { IRiskTokenManagementDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityRiskTokenManagement';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export enum ETokenListSortType {
  Name = 'name',
  Price = 'price',
  Value = 'value',
}

export type IToken = {
  decimals: number;
  name: string;
  symbol: string;
  address: string;
  logoURI?: string;
  isNative: boolean | undefined;
  riskLevel?: number;
  uniqueKey?: string;
  sendAddress?: string;
  coingeckoId?: string;

  // for all networks
  order?: number;
  networkId?: string;
  networkName?: string;
  accountId?: string;
  mergeAssets?: boolean;

  // for aggregate token
  isAggregateToken?: boolean;
  commonSymbol?: string;

  // for defi
  defiMarked?: boolean;
};

export type ITokenFiat = {
  balance: string;
  balanceParsed: string;
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  totalBalance?: string;
  totalBalanceParsed?: string;
  fiatValue: string;
  frozenBalanceFiatValue?: string;
  totalBalanceFiatValue?: string;
  price: number;
  price24h?: number;
};

export enum ECustomTokenStatus {
  Hidden = 'hidden',
  Custom = 'custom',
}

export type IAccountToken = { $key: string } & IToken;
export type IAccountTokenWithAccountId = IAccountToken & {
  accountId: string;
};
export type ICloudSyncCustomTokenInfo = Omit<IAccountToken, 'accountId'>;
export type ICloudSyncCustomToken = ICloudSyncCustomTokenInfo & {
  accountXpubOrAddress: string;
  tokenStatus: ECustomTokenStatus;
};
export type ICustomTokenItem = IAccountToken;

export type IFetchAccountTokensParams = {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  cursor?: string;
  limit?: number;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
  hiddenTokens?: string[];
  unblockedTokens?: string[];
  blockedTokens?: string[];
  flag?: string;
  isAllNetworks?: boolean;
  isManualRefresh?: boolean;

  allNetworksAccountId?: string;
  allNetworksNetworkId?: string;
  saveToLocal?: boolean;
  saveToLocalLimit?: number;
  customTokensRawData?: ICustomTokenDBStruct;
  blockedTokensRawData?: IRiskTokenManagementDBStruct['blockedTokens'];
  unblockedTokensRawData?: IRiskTokenManagementDBStruct['unblockedTokens'];
  excludeDeFiMarkedTokens?: boolean;
};

export type ITokenData = {
  data: IAccountToken[];
  keys: string;
  map: Record<string, ITokenFiat>; // key: networkId_tokenAddress
  fiatValue?: string;
};

export type IFetchAccountTokensResp = {
  allTokens?: ITokenData;
  tokens: ITokenData;
  riskTokens: ITokenData;
  smallBalanceTokens: ITokenData;
  accountId?: string;
  networkId?: string;
  isSameAllNetworksAccountData?: boolean;
  aggregateTokenListMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  aggregateTokenMap?: Record<string, ITokenFiat>;
};

export type IFetchTokenDetailParams = {
  accountId: string;
  networkId: string;
  contractList: string[];
  withFrozenBalance?: boolean;
  withCheckInscription?: boolean;
};

export type ISearchTokensParams = {
  accountId: string;
  networkId: string;
  contractList?: string[];
  keywords?: string;
};

export type ISearchTokenItem = {
  info: IToken;
};

export type IFetchTokenDetailResp = IAccountToken[];
export type IFetchTokenDetailItem = {
  info: IToken;
} & ITokenFiat;

/**
 * dApp add custom token route params
 */
export type IAddCustomTokenRouteParams = {
  token?: IAccountToken;
  walletId: string;
  isOthersWallet?: boolean;
  indexedAccountId?: string;
  accountId: string;
  networkId: string;
  deriveType: IAccountDeriveTypes;
  onSuccess?: () => void;
};

export type IWatchAssetParameter =
  | IEthWatchAssetParameter
  | ITronWatchAssetParameter
  | IConfluxWatchAssetParameter;

export type IEthWatchAssetParameter = {
  type: 'ERC20' | 'ERC721' | 'ERC1155';
  options: IWatchAssetOptions;
};

export type ITronWatchAssetParameter = {
  type: 'trc20';
  options: IWatchAssetOptions;
};

export type IConfluxWatchAssetParameter = {
  type: 'CRC20';
  options: IWatchAssetOptions;
};

type IWatchAssetOptions = {
  address: string;
  symbol?: string;
  decimals?: number;
  image?: string;
};

/**
 * Token aggregate map
 */

export enum EAggregateTokenStatus {
  Active = 'active',
  Inactive = 'inactive',
  Deprecated = 'deprecated',
}

export enum EAggregateTokenStandard {
  ERC20 = 'ERC-20',
  TRC20 = 'TRC-20',
  SPL = 'SPL',
  NEP141 = 'NEP-141',
  APTOS = 'APTOS',
  SUI = 'SUI',
  NATIVE = 'NATIVE',
}

export interface IAggregateToken {
  networkId: string;
  chainKey: string;
  vmType: string;
  decimals: number;
  tokenStandard: EAggregateTokenStandard;
  isOfficial: boolean;
  whyIncluded: string;
  supportedByWallet: boolean;
  status: EAggregateTokenStatus;
  address?: string;
  assetType?: string;
  commonSymbol: string;
  order: number;
  logoURI?: string;
  name: string;
}

export type IHomeDefaultToken = {
  symbol: string;
  networkId: string;
  logoURI: string;
  order: number;
};
