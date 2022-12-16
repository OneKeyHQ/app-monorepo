import { useIntl } from 'react-intl';

import { Box, IconButton, Typography } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../hooks';
import useOpenBlockBrowser from '../../hooks/useOpenBlockBrowser';

import { useTxHistoryContext } from './TxHistoryContext';

export function TxHistoryListViewHeaderBar({
  isLoading,
  refresh,
}: {
  isLoading?: boolean;
  refresh?: () => void;
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
            refresh?.();
          }}
          isLoading={Boolean(isLoading)}
          p={2}
          size="sm"
          name="ArrowPathMini"
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
            name="ArrowTopRightOnSquareMini"
            type="plain"
            circle
          />
        ) : null}
      </Box>
    </Box>
  );
}

export function TxHistoryListViewHeader(props: {
  isEmpty: boolean;
  refresh?: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isEmpty, refresh } = props;
  const txDetailContext = useTxHistoryContext();

  return (
    <Box key="header">
      {txDetailContext?.context?.headerView}
      <TxHistoryListViewHeaderBar
        refresh={txDetailContext?.context.refresh ?? refresh}
        isLoading={txDetailContext?.context.isLoading}
      />
    </Box>
  );
}
