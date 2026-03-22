export { ConfigManager } from './config-manager';
export { DEFAULT_CONFIG } from './defaults';
export { configSchema } from './config-schema';
export type { IAppConfig } from './config-schema';

export type IEndpointEnv = 'test' | 'prod';

const HOSTS: Record<IEndpointEnv, string> = {
  test: 'onekeytest.com',
  prod: 'onekeycn.com',
};

export function getHost(env: IEndpointEnv): string {
  return HOSTS[env];
}

export interface IChainConfig {
  networkId: string;
  impl: string;
  /** Native token decimals (e.g. 18 for ETH) — from presetNetworks.decimals */
  nativeDecimals: number;
  /** Fee unit decimals (e.g. 9 for Gwei) — from presetNetworks.feeMeta.decimals */
  feeDecimals: number;
  /** Fee unit symbol (e.g. "Gwei") — from presetNetworks.feeMeta.symbol */
  feeSymbol: string;
  /** Native token symbol (e.g. "ETH") — from presetNetworks.symbol */
  nativeSymbol: string;
}

// Source of truth: packages/shared/src/config/presetNetworks.ts
// Every value here MUST match the corresponding presetNetworks entry exactly.
export const CHAINS: Record<string, IChainConfig> = {
  ethereum: {
    networkId: 'evm--1',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'ETH',
  },
  eth: {
    networkId: 'evm--1',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'ETH',
  },
  sepolia: {
    networkId: 'evm--11155111',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'TETH',
  },
  bsc: {
    networkId: 'evm--56',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'BNB',
  },
  polygon: {
    networkId: 'evm--137',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'POL',
  },
  arbitrum: {
    networkId: 'evm--42161',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'ETH',
  },
  base: {
    networkId: 'evm--8453',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'ETH',
  },
  optimism: {
    networkId: 'evm--10',
    impl: 'evm',
    nativeDecimals: 18,
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeSymbol: 'ETH',
  },
};
