import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { MoreButton } from './MoreButton';
import { NetworksFilterItem } from './NetworksFilterItem';

interface ISwapNetworkToggleGroupProps {
  networks: ISwapNetwork[];
  disableNetworks?: string[];
  moreNetworksCount?: number;
  onSelectNetwork: (network: ISwapNetwork) => void;
  selectedNetwork?: ISwapNetwork;
  onMoreNetwork: () => void;
}

const MarketNetworkFilter = ({
  networks,
  selectedNetwork,
  onSelectNetwork,
  disableNetworks,
  moreNetworksCount,
  onMoreNetwork,
}: ISwapNetworkToggleGroupProps) => {
  const { width } = useWindowDimensions();
  const intl = useIntl();
  const isWiderScreen = width > 680;
  const filteredNetworks = useMemo(
    () => (isWiderScreen ? networks : networks.slice(0, 20)),
    [networks, isWiderScreen],
  );
  return (
    <XStack px="$5" pt="$1" pb="$3" gap="$2">
      {filteredNetworks.map((network) => (
        <NetworksFilterItem
          key={network.networkId}
          networkName={network.name}
          disabled={Boolean(disableNetworks?.includes(network.networkId))}
          networkImageUri={network.logoURI}
          tooltipContent={
            network.isAllNetworks
              ? intl.formatMessage({ id: ETranslations.global_all_networks })
              : network.name
          }
          isSelected={network?.networkId === selectedNetwork?.networkId}
          onPress={
            disableNetworks?.includes(network.networkId)
              ? undefined
              : () => {
                  onSelectNetwork(network);
                }
          }
        />
      ))}
      {moreNetworksCount && moreNetworksCount > 0 ? (
        <MoreButton onPress={onMoreNetwork} />
      ) : null}
    </XStack>
  );
};

export default memo(MarketNetworkFilter);
