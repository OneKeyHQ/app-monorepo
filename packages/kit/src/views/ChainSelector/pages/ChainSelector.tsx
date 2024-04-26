import type { IPageScreenProps } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import type { IServerNetwork } from '@onekeyhq/shared/types';

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
    enableDangerNetwork,
  } = route.params ?? {};
  const { result } = usePromiseResult(async () => {
    let networks: IServerNetwork[] = [];
    if (networkIds && networkIds.length > 0) {
      const resp = await backgroundApiProxy.serviceNetwork.getNetworksByIds({
        networkIds,
      });
      networks = resp.networks;
    } else {
      const resp = await backgroundApiProxy.serviceNetwork.getAllNetworks();
      networks = resp.networks;
    }
    if (enableDangerNetwork) {
      networks = [dangerAllNetworkRepresent, ...networks];
    }
    return networks;
  }, [networkIds, enableDangerNetwork]);

  return (
    <ChainSelectorPageView
      title={title}
      networkId={defaultNetworkId}
      networks={result ?? []}
      onPressItem={(network) => {
        onSelect?.(network);
        navigation.goBack();
      }}
    />
  );
}
