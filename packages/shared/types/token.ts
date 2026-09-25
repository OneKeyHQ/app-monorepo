import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { IRiskTokenManagementDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityRiskTokenManagement';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export enum ETokenListSortType {
  Name = 'name',
  Price = 'price',
  Value = 'value',
}

export enum ETokenDappType {
  WalletToken = 'walletToken',
}

export type ITokenDappType = ETokenDappType | (string & {});

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
  // Scaled-UI / rebase tokens (e.g. xStocks on Solana Token-2022 Scaled UI
  // Amount, TON TEP-0526). Raw on-chain balances never change; wallets must
  // display `balanceParsed × balanceMultiplier` and build transactions with
  // the raw amount. Absent/invalid means no scaling. See tokenRebaseUtils.
  balanceMultiplier?: string;

  // for all networks
  order?: number;
  networkId?: string;
  networkName?: string;
  networkShortName?: string;
  accountId?: string;
  mergeAssets?: boolean;

  // for aggregate token
  isAggregateToken?: boolean;
  commonSymbol?: string;

  // for defi
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;

  // Shared-balance group (e.g. Arc evm--5042: native USDC and the ERC-20
  // interface 0x3600… read the SAME balance). The server marks the member
  // that must be skipped by totals with BOTH fields together; the primary and
  // every other token lack both. `sharedBalanceWith` is the primary's
  // `address` and may be '' (native), so presence checks must use
  // `!== undefined`. See sharedBalanceUtils.
  sharedBalanceExcluded?: boolean;
  sharedBalanceWith?: string;
};

export type ITokenFiat = {
  balance: string;
  balanceParsed: string;
  // See IToken.balanceMultiplier — mirrored here so display leaves that only
  // subscribe to the fiat map can compute the display balance. `balance` /
  // `balanceParsed` above stay RAW; `fiatValue` is already multiplied
  // server-side.
  balanceMultiplier?: string;
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  totalBalance?: string;
  totalBalanceParsed?: string;
  fiatValue: string;
  frozenBalanceFiatValue?: string;
  totalBalanceFiatValue?: string;
  price: number;
  price24h?: number;
  // Currency id (e.g. 'usd', 'eur') the above fiat fields are stored in.
  // Internal cache writes normalize to 'usd' so a currency switch can re-render
  // existing data via client-side conversion instead of clearing the cache.
  currency?: string;
  // RESOLVED shared-balance decision (see IToken.sharedBalanceExcluded):
  // true only when a valid primary is present in the summed set, so fiat-map
  // consumers that never see the token object can still skip this entry in
  // totals. Row display keeps using `fiatValue` unchanged.
  sharedBalanceExcludedFromTotal?: boolean;
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

export type IHomeTokenRequestInvalidation = {
  mainRuntimeId: string;
  generation: number;
};

export type IHomeTokenRequest = IHomeTokenRequestInvalidation & {
  ownerKey: string;
};

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
  homeRequest?: IHomeTokenRequest;
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
  withoutDappToken?: boolean;
  withoutWalletToken?: boolean;
};

export type ITokenData = {
  data: IAccountToken[];
  keys: string;
  map: Record<string, ITokenFiat>; // key: networkId_tokenAddress
  fiatValue?: string;
  currency?: string;
};

export type IFetchAccountTokensResp = {
  homeTokenRoundRef?: string;
  mergeDeriveAssets?: boolean;
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

export type IFetchTokenDetailBatchQuery = {
  accountAddress: string;
};

export type IFetchTokenDetailBatchParams = {
  accountId: string;
  networkId: string;
  contractList: string[];
  queries: IFetchTokenDetailBatchQuery[];
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

export type IFetchTokenDetailBatchItem = {
  accountAddress: string;
  tokens: IFetchTokenDetailItem[];
};

export type IFetchTokenDetailBatchResp = IFetchTokenDetailBatchItem[];

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
