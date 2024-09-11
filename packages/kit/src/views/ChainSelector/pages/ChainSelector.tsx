import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { PureChainSelector } from '../components/PureChainSelector';

export default function ChainSelectorPage({
  route,
  navigation,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ChainSelector
>) {
  const intl = useIntl();
  const {
    onSelect,
    defaultNetworkId,
    networkIds,
    disableNetworkIds,
    grouped,
    title = intl.formatMessage({ id: ETranslations.global_networks }),
  } = route.params ?? {};
  const { result } = usePromiseResult(async () => {
    const resp = await backgroundApiProxy.serviceNetwork.getAllNetworks({
      excludeAllNetworkItem: true,
    });
    let networks: IServerNetwork[] = resp.networks;
    let disableNetwork: IServerNetwork[] | undefined;
    if (disableNetworkIds && disableNetworkIds.length > 0) {
      disableNetwork = networks.filter((o) => disableNetworkIds.includes(o.id));
    }
    if (networkIds && networkIds.length > 0) {
      const networkIdIndex = networkIds.reduce((acc, item, index) => {
        acc[item] = index;
        return acc;
      }, {} as Record<string, number>);
      networks = networks.filter((o) => {
        let isOK = networkIds.includes(o.id);
        if (disableNetworkIds && disableNetworkIds?.length > 0) {
          isOK = isOK && !disableNetworkIds.includes(o.id);
        }
        return isOK;
      });
      networks.sort((a, b) => networkIdIndex[a.id] - networkIdIndex[b.id]);
    }
    return { networks, disableNetwork };
  }, [networkIds, disableNetworkIds]);

  return (
    <PureChainSelector
      title={title}
      networkId={defaultNetworkId}
      networks={result?.networks ?? []}
      unavailable={result?.disableNetwork}
      grouped={grouped}
      onPressItem={(network) => {
        onSelect?.(network);
        navigation.goBack();
      }}
    />
  );
}
