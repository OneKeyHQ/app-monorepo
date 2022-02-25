import React, { FC, useCallback, useMemo } from 'react';

import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Center,
  HStack,
  Icon,
  Text,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import {
  TokenType,
  Transaction,
  TransactionType,
  TxStatus,
} from '@onekeyhq/engine/src/types/covalent';
import { Network } from '@onekeyhq/engine/src/types/network';

import {
  formatBalanceDisplay,
  useFormatAmount,
} from '../../../components/Format';
import useFormatDate from '../../../hooks/useFormatDate';
import NFTView from '../nftView';

import {
  getSwapReceive,
  getSwapTransfer,
  getTransferAmount,
  getTransferAmountFiat,
  getTransferNFTList,
} from './utils';

export type TransactionState = 'pending' | 'dropped' | 'failed' | 'success';

export type TransactionRecordProps = {
  transaction: Transaction;
  network?: Network | undefined;
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
    'Swap': 'transaction__exchange',
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
    'Swap': 'SwitchHorizontalSolid',
    'ContractExecution': 'ArrowUpSolid',
    // 'Approve': 'BadgeCheckSolid',
  };
  return stringKeys[state];
};

const TransactionRecord: FC<TransactionRecordProps> = ({
  transaction,
  network,
}) => {
  const { size } = useUserDevice();
  const intl = useIntl();

  const formatDate = useFormatDate();
  const { useFormatCurrencyDisplay } = useFormatAmount();

  const renderNFTImages = useCallback(
    () => (
      <HStack space={2} mt={2}>
        {getTransferNFTList(transaction).map((nft, index) => {
          if (index < 2) {
            return <NFTView src={nft} key={nft} size={24} />;
          }
          if (index === 2) {
            return (
              <Center width={24} height={24}>
                <Icon size={5} name="DotsHorizontalSolid" />
              </Center>
            );
          }
          return null;
        })}
      </HStack>
    ),
    [transaction],
  );

  // 转账、收款、合约执行 展示余额
  const displayAmount = useCallback(() => {
    if (
      transaction.type === 'Receive' ||
      transaction.type === 'Transfer' ||
      transaction.type === 'Swap' ||
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
            ? formatDate.formatDate(transaction.blockSignedAt, {
                hideTheYear: true,
                hideTheMonth: true,
              })
            : getTransactionStatusStr(intl, transaction.successful)}
        </Typography.Body2>
      </Box>
    ),
    [formatDate, intl, transaction],
  );

  const amountFiat = useFormatCurrencyDisplay([
    getTransferAmountFiat(transaction).balance,
  ]);

  const amountInfo = useCallback(() => {
    if (transaction?.type === TransactionType.Swap) {
      return (
        <Box alignItems="flex-end" minW="156px" maxW="156px" textAlign="right">
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            -{getSwapTransfer(transaction, network)}
          </Text>
          <Typography.Body2 color="text-subdued" textAlign="right">
            →{getSwapReceive(transaction, network)}
          </Typography.Body2>
        </Box>
      );
    }
    const originAmount = getTransferAmount(transaction, network);
    const amount = formatBalanceDisplay(
      originAmount.balance,
      originAmount.unit,
      {
        unit: originAmount.decimals,
        fixed: originAmount.fixed,
      },
    );

    return (
      <Box alignItems="flex-end" minW="156px" maxW="156px">
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          textAlign="right"
        >
          {transaction.type === TransactionType.Transfer && '-'}
          {`${amount.amount ?? '-'} ${amount.unit ?? ''}`}
        </Text>
        <Typography.Body2 color="text-subdued" textAlign="right">
          {transaction.type === TransactionType.Transfer &&
            transaction.tokenType !== TokenType.ERC721 &&
            '-'}
          {`${amountFiat.amount ?? '-'} ${amountFiat.unit ?? ''}`}
        </Typography.Body2>
      </Box>
    );
  }, [amountFiat, network, transaction]);

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

        {renderNFTImages()}

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
