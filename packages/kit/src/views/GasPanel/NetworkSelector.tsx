/* eslint-disable react/no-unstable-nested-components */
import { useMemo } from 'react';

import {
  Box,
  HStack,
  Icon,
  Menu,
  Pressable,
  Text,
  Token,
} from '@onekeyhq/components';

import { useManageNetworks, useNetworkSimple } from '../../hooks';

import { supportedNetworks } from './config';

interface Props {
  selectedNetworkId: string;
  setSelectedNetworkId: React.Dispatch<React.SetStateAction<string>>;
}

function NetworkSelector(props: Props) {
  const { selectedNetworkId, setSelectedNetworkId } = props;

  const { allNetworks } = useManageNetworks(undefined);

  const selectableNetworks = useMemo(
    () =>
      allNetworks.filter((network) => supportedNetworks.includes(network.id)),
    [allNetworks],
  );

  const selectedNetwork = useNetworkSimple(selectedNetworkId);

  const activeOption = useMemo(
    () => ({
      label: selectedNetwork?.name,
      value: selectedNetwork?.id,
      tokenProps: {
        token: {
          logoURI: selectedNetwork?.logoURI,
          name: selectedNetwork?.shortName,
        },
      },
      badge: selectedNetwork?.impl === 'evm' ? 'EVM' : undefined,
    }),
    [
      selectedNetwork?.id,
      selectedNetwork?.impl,
      selectedNetwork?.logoURI,
      selectedNetwork?.name,
      selectedNetwork?.shortName,
    ],
  );

  return (
    <Menu
      w="190"
      trigger={(triggerProps) => (
        <Pressable accessibilityLabel="More options menu" {...triggerProps}>
          <HStack alignItems="center" space={3}>
            <Token size={6} {...activeOption.tokenProps} />
            <Text typography="Body1">{selectedNetwork?.name}</Text>
            <Icon size={20} name="ChevronDownMini" color="icon-subdued" />
          </HStack>
        </Pressable>
      )}
    >
      {selectableNetworks.map((network) => (
        <Menu.Item
          key={network.id}
          onPress={() => setSelectedNetworkId(network.id)}
        >
          <HStack space={4} alignItems="center">
            <Box width="20px">
              {selectedNetworkId === network.id && (
                <Icon name="CheckMini" size={20} color="interactive-default" />
              )}
            </Box>
            <Text typography="Body1">{network.name}</Text>
          </HStack>
        </Menu.Item>
      ))}
    </Menu>
  );
}

export { NetworkSelector };
