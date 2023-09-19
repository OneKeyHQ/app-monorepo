import { useCallback, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Center,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { archiveTransaction } from '../../../store/reducers/swapTransactions';
import { useSummaryTx } from '../hooks/useSwapUtils';
import { useWalletsSwapTransactions } from '../hooks/useTransactions';

import type { TransactionDetails } from '../typings';

type PendingTxsProps = {
  txs: TransactionDetails[];
};

const PendingTxs: FC<PendingTxsProps> = ({ txs }) => {
  const intl = useIntl();
  return txs?.length ? (
    <Box>
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__str_transactions_in_progress',
          },
          {
            'content__str_transactions_in_progress': txs?.length,
          },
        )}
        dismiss={false}
        alertType="info"
      />
    </Box>
  ) : null;
};

type FailedTxsProps = {
  txs: TransactionDetails[];
};

const FailedTxs: FC<FailedTxsProps> = ({ txs }) => {
  const intl = useIntl();
  const summaryTx = useSummaryTx();
  const onDismiss = useCallback(() => {
    txs.forEach((tx) => {
      backgroundApiProxy.dispatch(
        archiveTransaction({
          accountId: tx.accountId,
          networkId: tx.networkId,
          txs: [tx.hash],
        }),
      );
    });
  }, [txs]);
  if (txs.length === 0) {
    return null;
  }
  if (txs.length === 1) {
    return (
      <Box>
        <Alert
          title={summaryTx(txs[0])}
          alertType="error"
          onDismiss={onDismiss}
        />
      </Box>
    );
  }
  return (
    <Box>
      <Alert
        title={intl.formatMessage(
          {
            id: 'content__str_transactions_failed',
          },
          {
            '0': txs.length,
          },
        )}
        alertType="error"
        onDismiss={onDismiss}
      />
    </Box>
  );
};

const SwapTransactions = () => {
  const isSmall = useIsVerticalLayout();
  const allTransactions = useWalletsSwapTransactions();
  const pendings = useMemo(
    () => allTransactions.filter((tx) => tx.status === 'pending'),
    [allTransactions],
  );
  const failedTxs = useMemo(
    () => allTransactions.filter((tx) => tx.status === 'failed' && !tx.archive),
    [allTransactions],
  );
  if (pendings.length === 0 && failedTxs.length === 0) {
    return null;
  }
  return (
    <Center>
      <VStack
        px={isSmall ? '4' : undefined}
        mb={isSmall ? undefined : '4'}
        width="full"
        space={4}
      >
        {pendings.length ? <PendingTxs txs={pendings} /> : null}
        {failedTxs.length ? <FailedTxs txs={failedTxs} /> : null}
      </VStack>
    </Center>
  );
};

export default SwapTransactions;
