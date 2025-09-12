import type { FC, ReactNode } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Popover } from '@onekeyhq/components';
import type { IButtonProps, IPopoverProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { NetworksSearchPanel } from './NetworksSearchPanel';

import type { INetworksSearchPanelProps } from './NetworksSearchPanel';

interface IMoreButtonProps
  extends Omit<IButtonProps, 'children'>,
    Omit<INetworksSearchPanelProps, 'networkId'> {
  selectedNetworkId?: string;
  customTrigger?: (isOpen: boolean, onPress: () => void) => ReactNode;
  placement?: IPopoverProps['placement'];
}

const MoreButton: FC<IMoreButtonProps> = ({
  networks = [],
  selectedNetworkId,
  onNetworkSelect,
  customTrigger,
  placement,
  ...rest
}) => {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const handleNetworkSelect = (network: IServerNetwork) => {
    onNetworkSelect?.(network);
    setIsOpen(false);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const renderTrigger = () => {
    if (customTrigger) {
      return customTrigger(isOpen, handleToggle);
    }

    return (
      <Button
        m="$0.5"
        size="small"
        variant="tertiary"
        iconAfter={
          isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
        }
        iconColor="$iconSubdued"
        color="$textSubdued"
        onPress={handleToggle}
        {...rest}
      >
        {intl.formatMessage({ id: ETranslations.global_more })}
      </Button>
    );
  };

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.global_select_network })}
      open={isOpen}
      onOpenChange={setIsOpen}
      placement={placement}
      floatingPanelProps={{
        maxWidth: 384,
      }}
      renderContent={
        <NetworksSearchPanel
          networks={networks}
          networkId={selectedNetworkId}
          onNetworkSelect={handleNetworkSelect}
        />
      }
      renderTrigger={renderTrigger()}
    />
  );
};

export { MoreButton };
