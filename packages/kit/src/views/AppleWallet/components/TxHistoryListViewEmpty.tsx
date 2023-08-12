import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';
import Empty from './Empty';

import { useTxHistoryContext } from '../../TxHistory/TxHistoryContext';

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
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        isLoading={Boolean(txDetailContext?.context.isLoading || isLoading)}
      />
    </Box>
  );
}
