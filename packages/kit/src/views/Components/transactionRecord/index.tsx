import React, { FC, useCallback, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Icon,
  Text,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import {
  Transaction,
  TransactionType,
  TxStatus,
} from '@onekeyhq/engine/src/types/covalent';

import { formatDate } from '../../../utils/DateUtils';

import { getTransferAmount, getTransferAmountFiat } from './utils';

export type TransactionState = 'pending' | 'dropped' | 'failed' | 'success';

export type TransactionRecordProps = {
  transaction: Transaction;
};

export const getTransactionStatusStr = (
  intl: IntlShape,
  state: TxStatus = TxStatus.Pending,
): string => {
  const stringKeys: Record<TxStatus, string> = {
    'Pending': 'transaction__pending',
    'Confirmed': 'transaction__success',
    'Failed': 'transaction__failed',
    // 'dropped': 'transaction__dropped',
  };
  return intl.formatMessage({
    id: stringKeys[state],
  });
};

const getTransactionStatusColor = (
  state: TxStatus = TxStatus.Pending,
): string => {
  const stringKeys: Record<TxStatus, string> = {
    'Pending': 'text-warning',
    'Confirmed': 'text-subdued',
    'Failed': 'text-critical',
    // 'dropped': 'text-critical',
  };
  return stringKeys[state];
};

const getTransactionTypeStr = (
  intl: IntlShape,
  transaction: Transaction,
): string => {
  // if (transaction.type === 'Approve' && transaction?.approveInfo?.token) {
  //   return intl.formatMessage(
  //     { id: 'transaction__approve_token_spend_limit' },
  //     { token: transaction.approveInfo.token },
  //   );
  // }

  const stringKeys: Record<TransactionType, string> = {
    'Transfer': 'action__send',
    'Receive': 'action__receive',
    'ContractExecution': 'transaction__multicall',
    // 'Approve': 'action__send',
  };
  return intl.formatMessage({
    id: stringKeys[transaction.type ?? 'Transfer'],
  });
};

const getTransactionTypeIcon = (
  state: TransactionType = TransactionType.Transfer,
): ICON_NAMES => {
  const stringKeys: Record<TransactionType, ICON_NAMES> = {
    'Transfer': 'ArrowUpSolid',
    'Receive': 'ArrowDownSolid',
    'ContractExecution': 'ArrowUpSolid',
    // 'Approve': 'BadgeCheckSolid',
  };
  return stringKeys[state];
};

const TransactionRecord: FC<TransactionRecordProps> = ({ transaction }) => {
  const { size } = useUserDevice();
  const intl = useIntl();

  // 转账、收款、合约执行 展示余额
  const displayAmount = useCallback(() => {
    if (
      transaction.type === 'Receive' ||
      transaction.type === 'Transfer' ||
      transaction.type === 'ContractExecution'
    ) {
      return true;
    }
    return false;
  }, [transaction.type]);

  const basicInfo = useCallback(
    () => (
      <Box minW="156px" flex={1}>
        <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          {getTransactionTypeStr(intl, transaction)}
        </Text>
        <Typography.Body2
          color={getTransactionStatusColor(transaction.successful)}
        >
          {transaction.successful === TxStatus.Confirmed
            ? formatDate(new Date(transaction.blockSignedAt))
            : getTransactionStatusStr(intl, transaction.successful)}
        </Typography.Body2>
      </Box>
    ),
    [intl, transaction],
  );

  const amountInfo = useCallback(
    () => (
      <Box alignItems="flex-end" minW="156px">
        <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          {transaction.type === TransactionType.Transfer && '-'}
          {getTransferAmount(transaction)}
        </Text>
        <Typography.Body2 color="text-subdued">
          {transaction.type === TransactionType.Transfer && '-'}
          {getTransferAmountFiat(transaction)}
        </Typography.Body2>
      </Box>
    ),
    [transaction],
  );

  const ItemInfo = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return (
        <Box flexDirection="row" flex={1}>
          <Box flex={1}>
            {basicInfo()}
            {/* {transaction.type === 'Approve' ? (
              <Typography.Body2 color="text-subdued">
                {transaction?.approveInfo?.url}
              </Typography.Body2>
            ) : (
              <Address color="text-subdued" text={transaction.to} short />
            )} */}
            <Address color="text-subdued" text={transaction.toAddress} short />
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
        {/* {transaction.type === 'Approve' ? (
          <Typography.Body2 textAlign="left" color="text-subdued">
            {transaction?.approveInfo?.url}
          </Typography.Body2>
        ) : (
          <Box>
            <Address color="text-subdued" text={transaction.toAddress} />
          </Box>
        )} */}
        <Box>
          <Address color="text-subdued" text={transaction.toAddress} />
        </Box>
        {displayAmount() ? amountInfo() : <Box minW="156px" />}
      </Box>
    );
  }, [amountInfo, basicInfo, displayAmount, size, transaction.toAddress]);

  return (
    <Box flexDirection="row">
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
        {/* <Box>
          <Image w="96px" h="96px" />
        </Box> */}

        {/* {transaction.state === 'pending' && (
          <Box flexDirection="row" mt={4} alignItems="center">
            <Typography.Caption color="text-subdued" flex={1}>
              {transaction.confirmed < 6 &&
                intl.formatMessage({ id: 'transaction__not_confirmed' })}
            </Typography.Caption>
            <Button
              size="xs"
              ml={2}
              onPress={() => {
                console.log('Click: Cancel');
              }}
            >
              {intl.formatMessage({ id: 'action__cancel' })}
            </Button>
            <Button
              type="primary"
              size="xs"
              ml={2}
              onPress={() => {
                console.log('Click: Speed Up');
              }}
            >
              {intl.formatMessage({ id: 'action__speed_up' })}
            </Button>
          </Box>
        )} */}
      </Box>
    </Box>
  );
};

export default TransactionRecord;
