import {
  useIsNativeAtom,
  useNetworkIdAtom,
  usePerpsInfoAtom,
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
  const [isNative] = useIsNativeAtom();
  const [websocketConfig] = useTokenDetailWebsocketAtom();
  const [perpsInfo] = usePerpsInfoAtom();

  const isReady = !isLoading && !!tokenDetail;

  return {
    tokenDetail,
    isLoading,
    tokenAddress,
    networkId,
    isNative,
    websocketConfig,
    perpsInfo,
    isReady,
  };
}
