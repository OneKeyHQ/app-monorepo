import type { IPageScreenProps } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ChainSelectorPageView } from '../components/PageView';

export default function ChainSelectorPage({
  route,
  navigation,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ChainSelector
>) {
  const {
    onSelect,
    defaultNetworkId,
    networkIds,
    title = 'Networks',
  } = route.params ?? {};
  const { result } = usePromiseResult(() => {
    if (networkIds && networkIds.length > 0) {
      return backgroundApiProxy.serviceNetwork.getNetworksByIds({ networkIds });
    }
    return backgroundApiProxy.serviceNetwork.getAllNetworks();
  }, [networkIds]);

  return (
    <ChainSelectorPageView
      title={title}
      networkId={defaultNetworkId}
      networks={result?.networks ?? []}
      onPressItem={(network) => {
        onSelect?.(network);
        navigation.goBack();
      }}
    />
  );
}
