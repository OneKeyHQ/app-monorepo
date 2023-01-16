import { useIntl } from 'react-intl';

import { Box, IconButton, Typography } from '@onekeyhq/components';

import { showAccountValueSettings } from '../Overlay/AccountHistorySettings';

import { useTxHistoryContext } from './TxHistoryContext';

export function TxHistoryListViewHeaderBar({
  isLoading,
  refresh,
}: {
  isLoading?: boolean;
  refresh?: () => void;
}) {
  const intl = useIntl();
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
        <IconButton
          onPress={showAccountValueSettings}
          ml={3}
          p={2}
          size="sm"
          name="Cog6ToothOutline"
          type="plain"
          circle
        />
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
