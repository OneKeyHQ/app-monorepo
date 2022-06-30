import React from 'react';

import { useIntl } from 'react-intl';

import { Box, IconButton, Typography } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../hooks';
import useOpenBlockBrowser from '../../hooks/useOpenBlockBrowser';

export function TxHistoryListViewHeader({
  isLoading,
  refresh,
}: {
  isLoading?: boolean;
  refresh: () => void;
}) {
  const intl = useIntl();
  const { network, account } = useActiveWalletAccount();
  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pb={3}
    >
      <Typography.Heading>
        {intl.formatMessage({ id: 'transaction__history' })}
      </Typography.Heading>
      <Box flexDirection="row">
        <IconButton
          onPress={() => {
            refresh();
          }}
          isLoading={isLoading}
          p={2}
          size="sm"
          name="RefreshSolid"
          type="plain"
          circle
        />
        {hasAvailable ? (
          <IconButton
            onPress={() => {
              openAddressDetails(account?.address);
            }}
            ml={3}
            p={2}
            size="sm"
            name="ExternalLinkSolid"
            type="plain"
            circle
          />
        ) : null}
      </Box>
    </Box>
  );
}
