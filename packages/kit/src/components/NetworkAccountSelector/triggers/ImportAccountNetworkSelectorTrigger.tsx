import type { FC } from 'react';
import { useMemo } from 'react';

import { Box, Token } from '@onekeyhq/components';
import type { INetwork } from '@onekeyhq/engine/src/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

import { BaseSelectorTrigger } from './BaseSelectorTrigger';

import type { ISelectorTriggerSharedProps } from './BaseSelectorTrigger';

interface ImportAccountNetworkSelectorTriggerProps
  extends ISelectorTriggerSharedProps {
  selectedNetwork: INetwork;
  showName?: boolean;
  onSelected?: (networkId: string) => void;
  selectableNetworks?: INetwork[];
}

const ImportAccountNetworkSelectorTrigger: FC<
  ImportAccountNetworkSelectorTriggerProps
> = ({
  showName = true,
  type = 'basic',
  bg,
  selectedNetwork,
  selectableNetworks,
  onSelected,
}) => {
  const navigation = useAppNavigation();
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
    <BaseSelectorTrigger
      type={type}
      bg={bg}
      hasArrow
      icon={
        <Box position="relative">
          <Token size={6} {...activeOption.tokenProps} />
        </Box>
      }
      label={showName && selectedNetwork.name}
      onPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManageNetwork,
          params: {
            screen: ManageNetworkModalRoutes.NetworkSelector,
            params: {
              selectedNetworkId: selectedNetwork.id,
              selectableNetworks,
              onSelected,
              rpcStatusDisabled: true,
            },
          },
        });
      }}
      borderRadius={12}
      px={2}
      py={2.5}
      space={3}
      justifyContent="space-between"
    />
  );
};

export { ImportAccountNetworkSelectorTrigger };
