import type { FC } from 'react';
import { useMemo } from 'react';

import { Box, Token } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  CreateWalletModalRoutes,
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

import { BaseSelectorTrigger } from './BaseSelectorTrigger';

import type { ISelectorTriggerSharedProps } from './BaseSelectorTrigger';

interface ImportAccountNetworkSelectorTeiggerProps
  extends ISelectorTriggerSharedProps {
  showName?: boolean;
  onSelected?: (networkId: string) => void;
}

const ImportAccountNetworkSelectorTeigger: FC<
  ImportAccountNetworkSelectorTeiggerProps
> = ({ showName = true, type = 'basic', bg, onSelected }) => {
  const { network } = useActiveWalletAccount();
  const navigation = useAppNavigation();
  const activeOption = useMemo(
    () => ({
      label: network?.name,
      value: network?.id,
      tokenProps: {
        token: {
          logoURI: network?.logoURI,
          name: network?.shortName,
        },
      },
      badge: network?.impl === 'evm' ? 'EVM' : undefined,
    }),
    [
      network?.id,
      network?.impl,
      network?.logoURI,
      network?.name,
      network?.shortName,
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
      label={showName && activeOption.label}
      onPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManageNetwork,
          params: {
            screen: ManageNetworkModalRoutes.NetworkSelector,
            params: {
              onSelected,
            },
          },
        });
      }}
      borderRadius={12}
      px={2}
      py={3}
      space={3}
      justifyContent="space-between"
    />
  );
};

export { ImportAccountNetworkSelectorTeigger };
