import React from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty, IconButton } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import IconHistory from '../../../assets/3d_transaction_history.png';
import { useActiveWalletAccount } from '../../hooks';
import useOpenBlockBrowser from '../../hooks/useOpenBlockBrowser';

export function TxHistoryListViewEmpty({
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
    <Box py={4} flexDirection="column" alignItems="center">
      <Empty
        imageUrl={IconHistory}
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({
          id: 'transaction__history_empty_desc',
        })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={refresh}
        isLoading={isLoading}
      />
      {!!platformEnv.isDev && hasAvailable && (
        <IconButton
          onPress={() => {
            openAddressDetails(account?.address);
          }}
          p={2}
          size="sm"
          name="ExternalLinkSolid"
          type="plain"
          circle
        />
      )}
    </Box>
  );
}
