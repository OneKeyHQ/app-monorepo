import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

import { useTxHistoryContext } from '../../TxHistory/TxHistoryContext';

import Empty from './Empty';

export function TxHistoryListViewEmpty({
  isLoading,
  refresh,
}: {
  isLoading?: boolean;
  refresh?: () => void;
}) {
  const intl = useIntl();
  const txDetailContext = useTxHistoryContext();

  const title = isLoading
    ? 'Loading...'
    : intl.formatMessage({ id: 'transaction__history_empty_title' });
  return (
    <Box py={4} flexDirection="column" alignItems="center">
      <Empty
        title={title}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        isLoading={Boolean(txDetailContext?.context.isLoading || isLoading)}
      />
    </Box>
  );
}
