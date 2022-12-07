import { useMemo } from 'react';

import { Box, Token, useIsVerticalLayout } from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../../hooks';
import { useRpcMeasureStatus } from '../../../views/ManageNetworks/hooks';
import Speedindicator from '../modals/NetworkAccountSelectorModal/SpeedIndicator';

import {
  BaseSelectorTrigger,
  INetworkAccountSelectorTriggerProps,
} from './BaseSelectorTrigger';

function NetworkSelectorTrigger({
  type = 'plain',
  size = 'sm',
  bg,
  mode,
}: INetworkAccountSelectorTriggerProps) {
  const { network } = useActiveWalletAccount();
  const { openNetworkSelector } = useNavigationActions();
  const { status: rpcStatus } = useRpcMeasureStatus(network?.id ?? '');
  const activeOption = useMemo(
    () => ({
      label: network?.shortName,
      value: network?.id,
      tokenProps: {
        token: {
          logoURI: network?.logoURI,
          name: network?.shortName,
        },
      },
      badge: network?.impl === 'evm' ? 'EVM' : undefined,
    }),
    [network?.id, network?.impl, network?.logoURI, network?.shortName],
  );
  const isSmallSize = size === 'sm';

  return (
    <BaseSelectorTrigger
      type="plain"
      size={size}
      bg={bg}
      disabledInteractiveBg={isSmallSize}
      icon={
        <Box position="relative">
          <Token size={isSmallSize ? 7 : 7} {...activeOption.tokenProps} />
          {rpcStatus && (
            <Speedindicator
              position="absolute"
              top={isSmallSize ? '-4px' : '-2px'}
              right={isSmallSize ? '-4px' : '-2px'}
              size="10px"
              backgroundColor={rpcStatus?.iconColor}
            />
          )}
        </Box>
      }
      label={isSmallSize ? null : activeOption.label}
      onPress={() => {
        openNetworkSelector({ mode });
      }}
    />
  );
}

export { NetworkSelectorTrigger };
