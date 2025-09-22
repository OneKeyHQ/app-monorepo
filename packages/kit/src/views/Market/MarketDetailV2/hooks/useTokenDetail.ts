import {
  useNetworkIdAtom,
  useTokenAddressAtom,
  useTokenDetailAtom,
  useTokenDetailLoadingAtom,
  useTokenDetailWebsocketAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

export function useTokenDetail() {
  const [tokenDetail] = useTokenDetailAtom();
  const [isLoading] = useTokenDetailLoadingAtom();
  const [tokenAddress] = useTokenAddressAtom();
  const [networkId] = useNetworkIdAtom();
  const [websocketConfig] = useTokenDetailWebsocketAtom();

  const isReady = !isLoading && !!tokenDetail;

  return {
    tokenDetail,
    isLoading,
    tokenAddress,
    networkId,
    websocketConfig,
    isReady,
  };
}
