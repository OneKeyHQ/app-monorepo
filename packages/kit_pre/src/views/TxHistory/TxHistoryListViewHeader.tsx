import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';

import { showTokenValueSettings } from '../Overlay/TokenValueSettings';
import { HomeTabActionHeader } from '../Wallet/HomeTabActionHeader';

import { useTxHistoryContext } from './TxHistoryContext';

export function TxHistoryListViewHeaderBar({
  isLoading,
  refresh,
}: {
  isLoading?: boolean;
  refresh?: () => void;
  networkId: string;
}) {
  const intl = useIntl();
  return (
    <HomeTabActionHeader
      title={intl.formatMessage({ id: 'transaction__history' })}
      loading={isLoading}
      onClickRefresh={refresh}
      onClickSettings={showTokenValueSettings}
    />
  );
}

export function TxHistoryListViewHeader(props: {
  isEmpty: boolean;
  networkId: string;
  refresh?: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { refresh, networkId } = props;
  const txDetailContext = useTxHistoryContext();

  return (
    <Box key="header">
      {txDetailContext?.context?.headerView}
      <TxHistoryListViewHeaderBar
        networkId={networkId}
        refresh={txDetailContext?.context.refresh ?? refresh}
        isLoading={txDetailContext?.context.isLoading}
      />
    </Box>
  );
}
