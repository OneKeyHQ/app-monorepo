import React, { FC, useCallback, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  Icon,
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
  approveInfo?: { title: string; url: string };
};

export type TransactionRecordProps = {
  transaction: Transaction;
};

export const getTransactionStatusStr = (
  intl: IntlShape,
  state: TransactionState = 'pending',
): string => {
  const stringKeys: Record<TransactionState, string> = {
    'pending': '等待',
    'success': '成功',
    'failed': '失败',
    'dropped': '被替代',
  };
  //   return intl.formatMessage({
  //     id: stringKeys[state],
  //   });

  return stringKeys[state];
};

const getTransactionTypeStr = (
  intl: IntlShape,
  transaction: Transaction,
): string => {
  const stringKeys: Record<TransactionType, string> = {
    'Send': '发送',
    'Receive': '接收',
    'Approve': transaction?.approveInfo?.title ?? '授权',
  };
  //   return intl.formatMessage({
  //     id: stringKeys[state],
  //   });

  return stringKeys[transaction.type ?? 'Send'];
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
    'Send': 'TxTypeSendCircleIllus',
    'Receive': 'TxTypeReceiveCircleIllus',
    'Approve': 'TxTypeApproveCircleIllus',
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
      <Box flex={1}>
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
      <Box alignItems="flex-end">
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
          <Typography.Body2 color="text-subdued">
            {transaction?.approveInfo?.url}
          </Typography.Body2>
        ) : (
          <Address color="text-subdued" text={transaction.to} />
        )}
        {displayAmount() && amountInfo()}
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
        <Icon size={32} name={getTransactionTypeIcon(transaction.type)} />
      </Box>

      <Box flexDirection="column" flex={1} ml={3}>
        {ItemInfo}
        {transaction.state === 'pending' && (
          <Box flexDirection="row" mt={4} alignItems="center">
            <Typography.Caption color="text-subdued" flex={1}>
              {transaction.confirmed > 0
                ? `${transaction.confirmed.toString()} confirmed`
                : 'Not confirmed'}
            </Typography.Caption>
            <Button
              ml={2}
              onPress={() => {
                console.log('Click: Cancel');
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              ml={2}
              onPress={() => {
                console.log('Click: Speed Up');
              }}
            >
              Speed Up
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TransactionRecord;
