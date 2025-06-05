import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Popover } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

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
}) => {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const handleNetworkSelect = (network: ISwapNetwork) => {
    onNetworkSelect?.(network);
    setIsOpen(false);
  };

  return (
    <Popover
      title="Select Network"
      open={isOpen}
      onOpenChange={setIsOpen}
      renderContent={
        <NetworksSearchPanel
          networks={networks}
          networkId={selectedNetworkId}
          onNetworkSelect={handleNetworkSelect}
        />
      }
      renderTrigger={
        <Button
          m="$0.5"
          size="small"
          variant="tertiary"
          iconAfter={
            isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
          }
          iconColor="$iconSubdued"
          color="$textSubdued"
          {...rest}
        >
          {intl.formatMessage({ id: ETranslations.global_more })}
        </Button>
      }
    />
  );
};

export { MoreButton };
