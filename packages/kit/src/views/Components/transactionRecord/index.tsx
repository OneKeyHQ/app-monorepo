import React, { FC, useCallback, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  Icon,
  Spacer,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';

import { formatDate } from '../../../utils/DateUtils';

export type TransactionType = 'Send' | 'Receive' | 'Approve';
export type TransactionState = 'pending' | 'dropped' | 'failed' | 'success';

export type Transaction = {
  type?: TransactionType;
  state?: TransactionState;
  chainId: number;
  txId: string;
  amount: number;
  to: string;
  date: Date;
  confirmed: number;
  approveInfo?: { token: string; url: string };
};

export type TransactionRecordProps = {
  transaction: Transaction;
};

export const getTransactionStatusStr = (
  intl: IntlShape,
  state: TransactionState = 'pending',
): string => {
  const stringKeys: Record<TransactionState, string> = {
    'pending': 'transaction__pending',
    'success': 'transaction__success',
    'failed': 'transaction__failed',
    'dropped': 'transaction__dropped',
  };
  return intl.formatMessage({
    id: stringKeys[state],
  });
};

const getTransactionTypeStr = (
  intl: IntlShape,
  transaction: Transaction,
): string => {
  if (transaction.type === 'Approve' && transaction?.approveInfo?.token) {
    return intl.formatMessage(
      { id: 'transaction__approve_token_spend_limit' },
      { token: transaction.approveInfo.token },
    );
  }

  const stringKeys: Record<TransactionType, string> = {
    'Send': 'action__send',
    'Receive': 'action__receive',
    'Approve': 'action__send',
  };
  return intl.formatMessage({
    id: stringKeys[transaction.type ?? 'Send'],
  });
};

const getTransactionStatusColor = (
  state: TransactionState = 'pending',
): string => {
  const stringKeys: Record<TransactionState, string> = {
    'pending': 'text-warning',
    'success': 'text-subdued',
    'failed': 'text-critical',
    'dropped': 'text-critical',
  };
  return stringKeys[state];
};

const getTransactionTypeIcon = (
  state: TransactionType = 'Send',
): ICON_NAMES => {
  const stringKeys: Record<TransactionType, ICON_NAMES> = {
    'Send': 'ArrowUpSolid',
    'Receive': 'ArrowDownSolid',
    'Approve': 'BadgeCheckSolid',
  };
  return stringKeys[state];
};

const TransactionRecord: FC<TransactionRecordProps> = ({ transaction }) => {
  const { size } = useUserDevice();
  const intl = useIntl();

  const displayAmount = useCallback(() => {
    if (transaction.type === 'Receive' || transaction.type === 'Send') {
      return true;
    }
    return false;
  }, [transaction.type]);

  const basicInfo = useCallback(
    () => (
      <Box minW="156px" flex={1}>
        <Typography.Body1 fontWeight="bold">
          {getTransactionTypeStr(intl, transaction)}
        </Typography.Body1>
        <Typography.Body2 color={getTransactionStatusColor(transaction.state)}>
          {transaction.state === 'success'
            ? formatDate(transaction.date)
            : getTransactionStatusStr(intl, transaction.state)}
        </Typography.Body2>
      </Box>
    ),
    [intl, transaction],
  );

  const amountInfo = useCallback(
    () => (
      <Box alignItems="flex-end" minW="156px">
        <Typography.Body1 fontWeight="bold">
          {transaction.type === 'Send' ?? '-'}
          {transaction.amount}
        </Typography.Body1>
        <Typography.Body2 color="text-subdued">
          {transaction.type === 'Send' ?? '-'}99.89 USD
        </Typography.Body2>
      </Box>
    ),
    [transaction.amount, transaction.type],
  );

  const ItemInfo = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <Box flexDirection="row" flex={1}>
          <Box flex={1}>
            {basicInfo()}
            {transaction.type === 'Approve' ? (
              <Typography.Body2 color="text-subdued">
                {transaction?.approveInfo?.url}
              </Typography.Body2>
            ) : (
              <Address color="text-subdued" text={transaction.to} short />
            )}
          </Box>
          {displayAmount() && amountInfo()}
        </Box>
      );
    }
    return (
      <Box
        flexDirection="row"
        flex={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Box minW="128px">{basicInfo()}</Box>
        {transaction.type === 'Approve' ? (
          <Typography.Body2 flex={1} textAlign="center" color="text-subdued">
            {transaction?.approveInfo?.url}
          </Typography.Body2>
        ) : (
          <Address color="text-subdued" text={transaction.to} />
        )}
        {displayAmount() ? amountInfo() : <Spacer />}
      </Box>
    );
  }, [
    amountInfo,
    basicInfo,
    displayAmount,
    size,
    transaction?.approveInfo?.url,
    transaction.to,
    transaction.type,
  ]);

  return (
    <Box p={4} flexDirection="row">
      <Box mt={1.5}>
        <Box
          borderRadius="full"
          h="32px"
          w="32px"
          bg="surface-neutral-default"
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={18} name={getTransactionTypeIcon(transaction.type)} />
        </Box>
      </Box>

      <Box flexDirection="column" flex={1} ml={3}>
        {ItemInfo}
        {transaction.state === 'pending' && (
          <Box flexDirection="row" mt={4} alignItems="center">
            <Typography.Caption color="text-subdued" flex={1}>
              {transaction.confirmed > 6 ??
                intl.formatMessage({ id: 'transaction__not_confirmed' })}
            </Typography.Caption>
            <Button
              ml={2}
              onPress={() => {
                console.log('Click: Cancel');
              }}
            >
              {intl.formatMessage({ id: 'action__cancel' })}
            </Button>
            <Button
              type="primary"
              ml={2}
              onPress={() => {
                console.log('Click: Speed Up');
              }}
            >
              {intl.formatMessage({ id: 'action__speed_up' })}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TransactionRecord;
