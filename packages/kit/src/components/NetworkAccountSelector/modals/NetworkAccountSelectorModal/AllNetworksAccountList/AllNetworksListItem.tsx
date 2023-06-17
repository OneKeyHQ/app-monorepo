/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import * as React from 'react';

import { Box, Pressable, Text } from '@onekeyhq/components';

import { useAllNetworkAccountValue } from '../../../../../hooks';
import { useAccountSelectorChangeAccountOnPress } from '../../../hooks/useAccountSelectorChangeAccountOnPress';

import { AllNetworksAccountItemSelectDropdown } from './AllNetworkItemSelectDropdown';

type ListItemProps = {
  label?: string;
  isActive?: boolean;
  accountIndex: number;
  walletId: string;
  networkId: string;
};

const defaultProps = {} as const;

const AllNetworksListItem: FC<ListItemProps> = ({
  label,
  isActive,
  accountIndex,
  walletId,
  networkId,
}) => {
  const { onPressChangeAccountForAllNetwork } =
    useAccountSelectorChangeAccountOnPress();

  const value = useAllNetworkAccountValue({
    accountIndex,
  });
  return (
    <Pressable
      onPress={() => {
        onPressChangeAccountForAllNetwork({
          accountIndex,
          networkId,
          walletId,
        });
      }}
    >
      {({ isHovered, isPressed }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          p={2}
          pr={1.5}
          rounded="xl"
          bgColor={
            isActive
              ? 'surface-selected'
              : isPressed
              ? 'surface-pressed'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <Box flex={1} mr={3}>
            <Text typography="Body2Strong" isTruncated numberOfLines={1}>
              {label}
            </Text>
            <Box flexDirection="row">
              <Text typography="Body2" color="text-subdued">
                {value || 'N/A'}
              </Text>
            </Box>
          </Box>
          <AllNetworksAccountItemSelectDropdown
            accountIndex={accountIndex}
            walletId={walletId}
          />
        </Box>
      )}
    </Pressable>
  );
};

AllNetworksListItem.defaultProps = defaultProps;

export default AllNetworksListItem;
