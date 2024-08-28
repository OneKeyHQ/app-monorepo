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
    disableNetworkIds = [],
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
      networks = networks.filter(
        (o) => networkIds.includes(o.id) && !disableNetworkIds.includes(o.id),
      );
    }
    return { networks, disableNetwork };
  }, [networkIds, disableNetworkIds]);

  return (
    <PureChainSelector
      title={title}
      networkId={defaultNetworkId}
      networks={result?.networks ?? []}
      unavailable={result?.disableNetwork}
      onPressItem={(network) => {
        onSelect?.(network);
        navigation.goBack();
      }}
    />
  );
}
