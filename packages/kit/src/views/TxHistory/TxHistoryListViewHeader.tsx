import { useIntl } from 'react-intl';

import { Box, IconButton, Typography } from '@onekeyhq/components';

import { useNetwork } from '../../hooks';
import { showTokenValueSettings } from '../Overlay/TokenValueSettings';

import { useTxHistoryContext } from './TxHistoryContext';

export function TxHistoryListViewHeaderBar({
  isLoading,
  refresh,
  networkId,
}: {
  isLoading?: boolean;
  refresh?: () => void;
  networkId: string;
}) {
  const intl = useIntl();
  const { network } = useNetwork({ networkId });
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
        {network?.settings?.supportFilterScam && (
          <IconButton
            onPress={showTokenValueSettings}
            ml={3}
            p={2}
            size="sm"
            name="Cog8ToothMini"
            type="plain"
            circle
          />
        )}
      </Box>
    </Box>
  );
}

export function TxHistoryListViewHeader(props: {
  isEmpty: boolean;
  networkId: string;
  refresh?: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isEmpty, refresh, networkId } = props;
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
