import type { FC } from 'react';
import { useMemo } from 'react';

import { Box, Token } from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigationActions } from '../../../hooks';
import { useRpcMeasureStatus } from '../../../views/ManageNetworks/hooks';
import Speedindicator from '../modals/NetworkAccountSelectorModal/SpeedIndicator';

import { BaseSelectorTrigger } from './BaseSelectorTrigger';

import type { INetworkAccountSelectorTriggerProps } from './BaseSelectorTrigger';

interface NetworkSelectorTriggerProps
  extends INetworkAccountSelectorTriggerProps {
  showName?: boolean;
}

const NetworkSelectorTrigger: FC<NetworkSelectorTriggerProps> = ({
  showName = true,
  type = 'plain',
  bg,
  mode,
  iconSize = 6,
}) => {
  const { network } = useActiveWalletAccount();
  const { openNetworkSelector } = useNavigationActions();
  const { status: rpcStatus, loading } = useRpcMeasureStatus(network?.id ?? '');
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
      icon={
        <Box position="relative">
          <Token size={iconSize} {...activeOption.tokenProps} />
          {rpcStatus && !loading && (
            <Speedindicator
              position="absolute"
              top={-1}
              right={-1}
              size="10px"
              backgroundColor={rpcStatus?.iconColor}
            />
          )}
        </Box>
      }
      label={showName && activeOption.label}
      onPress={() => {
        openNetworkSelector({ mode });
      }}
    />
  );
};

export { NetworkSelectorTrigger };
