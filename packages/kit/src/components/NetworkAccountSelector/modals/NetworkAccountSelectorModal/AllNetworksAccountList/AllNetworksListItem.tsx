/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import * as React from 'react';

import { Box, Pressable, Text } from '@onekeyhq/components';

import { useAppSelector } from '../../../../../hooks';
import { useAllNetworkAccountValue } from '../../../../../hooks/useAllNetwoks';
import { useAccountSelectorChangeAccountOnPress } from '../../../hooks/useAccountSelectorChangeAccountOnPress';

import { AllNetworksAccountItemSelectDropdown } from './AllNetworkItemSelectDropdown';

type ListItemProps = {
  label?: string;
  isActive?: boolean;
  accountId: string;
  walletId: string;
  networkId: string;
};

const defaultProps = {} as const;

const AllNetworksListItem: FC<ListItemProps> = ({
  label,
  isActive,
  accountId,
  walletId,
  networkId,
}) => {
  const accountSelectorMode = useAppSelector(
    (s) => s.accountSelector.accountSelectorMode,
  );

  const { onPressChangeAccount } = useAccountSelectorChangeAccountOnPress();

  const value = useAllNetworkAccountValue({
    accountId,
  });
  return (
    <Pressable
      onPress={() => {
        onPressChangeAccount({
          accountId,
          networkId,
          walletId,
          accountSelectorMode,
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
            accountId={accountId}
            walletId={walletId}
          />
        </Box>
      )}
    </Pressable>
  );
};

AllNetworksListItem.defaultProps = defaultProps;

export default AllNetworksListItem;
