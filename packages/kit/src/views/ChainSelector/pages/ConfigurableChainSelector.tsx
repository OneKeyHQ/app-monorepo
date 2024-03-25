import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ConfigurableListView } from '../components/ConfigurableListView';

export default function ChainSelectorPage({
  route,
  navigation,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ConfigurableChainSelector
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
    <Page>
      <Page.Header title={title} />
      <Page.Body>
        <ConfigurableListView
          networks={result?.networks ?? []}
          onPress={(network) => {
            onSelect?.(network);
            navigation.goBack();
          }}
          networkId={defaultNetworkId}
        />
      </Page.Body>
    </Page>
  );
}
