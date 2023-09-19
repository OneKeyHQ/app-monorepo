import { useIntl } from 'react-intl';

import { Box, Empty } from '@onekeyhq/components';

import { useTxHistoryContext } from './TxHistoryContext';

export function TxHistoryListViewEmpty({
  isLoading,
  refresh,
}: {
  isLoading?: boolean;
  refresh?: () => void;
}) {
  const intl = useIntl();
  const txDetailContext = useTxHistoryContext();
  return (
    <Box py={4} flexDirection="column" alignItems="center">
      <Empty
        emoji="🕐"
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        subTitle={intl.formatMessage({
          id: 'transaction__history_empty_desc',
        })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={txDetailContext?.context.refresh ?? refresh}
        isLoading={Boolean(txDetailContext?.context.isLoading || isLoading)}
      />
    </Box>
  );
}
