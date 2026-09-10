import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
} from '../../engine/engineConsts';

export type IAllNetworkAddressMethodName =
  | 'evmGetAddress'
  | 'btcGetPublicKey'
  | 'solGetAddress'
  | 'tronGetAddress';

// SDK batch-address dispatch is shared by all third-party hardware vendors.
const ALL_NETWORK_ADDRESS_METHODS: Partial<
  Record<string, IAllNetworkAddressMethodName>
> = {
  [IMPL_BTC]: 'btcGetPublicKey',
  [IMPL_EVM]: 'evmGetAddress',
  [IMPL_SOL]: 'solGetAddress',
  [IMPL_TRON]: 'tronGetAddress',
};

export function getAllNetworkAddressMethod(network: string | undefined) {
  return network ? ALL_NETWORK_ADDRESS_METHODS[network] : undefined;
}
