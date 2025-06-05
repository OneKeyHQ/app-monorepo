import type { FC } from 'react';

import { Button, Popover } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

import { NetworksSearchPanel } from './NetworksSearchPanel';

import type { INetworksSearchPanelProps } from './NetworksSearchPanel';

interface IMoreButtonProps
  extends Omit<IButtonProps, 'children'>,
    Omit<INetworksSearchPanelProps, 'networkId'> {
  selectedNetworkId?: string;
}

const MoreButton: FC<IMoreButtonProps> = ({
  networks = [],
  selectedNetworkId,
  onNetworkSelect,
  ...rest
}) => (
  <Popover
    title="Select Network"
    renderContent={
      <NetworksSearchPanel
        networks={networks}
        networkId={selectedNetworkId}
        onNetworkSelect={onNetworkSelect}
      />
    }
    renderTrigger={
      <Button
        variant="tertiary"
        size="medium"
        iconAfter="ChevronDownSmallOutline"
        iconColor="$iconSubdued"
        $platform-native={{
          px: '$2',
          py: '$1',
        }}
        color="$textSubdued"
        {...rest}
      >
        More
      </Button>
    }
  />
);

export { MoreButton };
