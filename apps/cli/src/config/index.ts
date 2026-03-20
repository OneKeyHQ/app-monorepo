export { ConfigManager } from './config-manager';
export { DEFAULT_CONFIG } from './defaults';
export { configSchema } from './config-schema';
export type { AppConfig } from './config-schema';

export type IEndpointEnv = 'test' | 'prod';

const HOSTS: Record<IEndpointEnv, string> = {
  test: 'onekeytest.com',
  prod: 'onekeycn.com',
};

export function getHost(env: IEndpointEnv): string {
  return HOSTS[env];
}

export const CHAINS: Record<string, { networkId: string; impl: string }> = {
  ethereum: { networkId: 'evm--1', impl: 'evm' },
  eth: { networkId: 'evm--1', impl: 'evm' },
  bsc: { networkId: 'evm--56', impl: 'evm' },
  polygon: { networkId: 'evm--137', impl: 'evm' },
  arbitrum: { networkId: 'evm--42161', impl: 'evm' },
  base: { networkId: 'evm--8453', impl: 'evm' },
  optimism: { networkId: 'evm--10', impl: 'evm' },
};
