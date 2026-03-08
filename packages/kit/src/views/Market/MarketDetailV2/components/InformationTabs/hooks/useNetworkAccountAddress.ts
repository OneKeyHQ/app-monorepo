import { useNetworkAccount } from './useNetworkAccount';

export function useNetworkAccountAddress(networkId: string) {
  const { accountAddress } = useNetworkAccount(networkId);

  return {
    accountAddress,
  };
}
