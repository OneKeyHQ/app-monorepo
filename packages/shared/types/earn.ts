import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';

import type { IEarnPermit2ApproveSignData, IEarnText } from './staking';

export enum EEarnProviderEnum {
  Lido = 'Lido',
  Everstake = 'Everstake',
  Babylon = 'Babylon',
  Morpho = 'Morpho',
  Pendle = 'Pendle',
  Falcon = 'Falcon',
  Ethena = 'Ethena',
  Momentum = 'Momentum',
  Lista = 'Lista',
  Stakefish = 'Stakefish',
  Kamino = 'Kamino',
}

export type ISupportedSymbol =
  | 'ETH'
  | 'ADA'
  | 'USDC'
  | 'USDT'
  | 'DAI'
  | 'WETH'
  | 'cbBTC'
  | 'WBTC'
  | 'POL'
  | 'SOL'
  | 'ATOM'
  | 'APT'
  | 'BTC'
  | 'SBTC'
  | 'USDf'
  | 'MORPHO'
  | 'LISTA'
  | 'USDe'
  | 'sUSDe'
  | 'sUSDai'
  | 'cUSD'
  | 'srUSDe'
  | 'jrUSDe'
  | 'cUSDO'
  | 'syrupUSDT'
  | 'sENA'
  | 'uniBTC'
  | 'slisBNBx'
  | 'PlasmaUSD'
  | 'wstETH'
  | 'weETH'
  | 'aUSDT0'
  | 'stcUSD'
  | 'kHYPE';

export interface IStakingFlowConfig {
  enabled: boolean;
  tokenAddress: string;
  displayProfit: boolean;
  stakingWithApprove?: boolean;
  withdrawWithTx?: boolean;
  unstakeWithSignMessage?: boolean;
  withdrawSignOnly?: boolean;
  claimWithTx?: boolean;
  usePublicKey?: boolean;
  claimWithAmount?: boolean;
  allowPartialWithdraw?: boolean;
}

interface IProviderConfig {
  supportedSymbols: ISupportedSymbol[];
  configs: {
    [key in ISupportedSymbol]?: IStakingFlowConfig;
  };
}

interface INetworkStakingConfig {
  providers: {
    [key in EEarnProviderEnum]?: IProviderConfig;
  };
}

export interface IStakingConfig {
  [networkId: string]: INetworkStakingConfig;
}

export interface IEarnPermitCache {
  accountId: string;
  networkId: string;
  tokenAddress: string;
  amount: string;
  signature: string;
  permit2Data?: IEarnPermit2ApproveSignData;
  expiredAt: number;
}

export interface IEarnPermitCacheKey {
  accountId: string;
  networkId: string;
  tokenAddress: string;
  amount: string;
}

export enum EAvailableAssetsTypeEnum {
  All = 'all',
  StableCoins = 'stableCoins',
  NativeTokens = 'nativeTokens',
  SimpleEarn = 'simpleEarn',
  FixedRate = 'fixedRate',
  Staking = 'staking',
}

export interface IEarnAvailableAssetProtocol {
  networkId: string;
  provider: string;
  vault?: string;
}

export interface IEarnAvailableAssetAprInfo {
  highlight?: {
    text: string;
    color?: ColorTokens;
    icon?: {
      icon: IKeyOfIcons;
      color?: ColorTokens;
    };
  };
  normal?: {
    text: string;
    color?: ColorTokens;
  };
  deprecated?: {
    text: string;
    color?: ColorTokens;
  };
  button?: {
    type: string;
    text?: IEarnText;
    disabled?: boolean;
  };
}

export interface IEarnAvailableAssetBadge {
  tag: string;
  badgeType: string;
}

export interface IEarnAvailableAsset {
  name: string;
  symbol: string;
  logoURI: string;
  apr: string;
  aprWithoutFee: string;
  tags: string[];
  rewardUnit: string;
  protocols: IEarnAvailableAssetProtocol[];
  badges?: IEarnAvailableAssetBadge[];
  aprInfo?: IEarnAvailableAssetAprInfo;
  bgColor?: string;
  icon?: {
    icon: IKeyOfIcons | string;
    color?: ColorTokens;
    bgColor?: string;
  };
}

export interface IEarnAvailableAssetV2 {
  type: 'normal' | 'airdrop';
  networkId: string;
  provider: string;
  symbol: string;
  vault?: string;
  ptAddress?: string;
}
