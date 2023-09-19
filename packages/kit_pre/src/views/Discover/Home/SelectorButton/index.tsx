import type { FC } from 'react';
import { useCallback } from 'react';

import { Button, Image } from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { useNetwork } from '../../../../hooks';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { DiscoverModalRoutes } from '../../type';

type SelectorButtonProps = {
  networkIds: string[];
  networkId: string;
  onItemSelect?: (item: string) => void;
};

export const SelectorButton: FC<SelectorButtonProps> = ({
  networkIds,
  networkId,
  onItemSelect,
}) => {
  const { network } = useNetwork({ networkId });
  const onSelect = useCallback(
    (item: string) => {
      onItemSelect?.(item);
    },
    [onItemSelect],
  );

  return (
    <Button
      onPress={() => {
        getAppNavigation().navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Discover,
          params: {
            screen: DiscoverModalRoutes.ChainSelector,
            params: {
              networkIds,
              onSelect,
            },
          },
        });
      }}
      height="32px"
      type="plain"
      size="sm"
      rightIconName="ChevronDownMini"
      textProps={{ color: 'text-subdued' }}
      leftIcon={<Image size="6" src={network?.logoURI} />}
    >
      {network?.name || 'All Network'}
    </Button>
  );
};
