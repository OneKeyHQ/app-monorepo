import React, { FC, useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { IntlShape, useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  Container,
  Icon,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import {
  TransactionDetailModalRoutes,
  TransactionDetailRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/TransactionDetail';

import { useToast } from '../../hooks/useToast';
import { copyToClipboard } from '../../utils/ClipboardUtils';
import { formatDate } from '../../utils/DateUtils';
import {
  Transaction,
  TransactionState,
  TransactionType,
  getTransactionStatusStr,
} from '../Components/transactionRecord';

export type TransactionDetailsProps = {
  txId: string;
};

type TransactionDetailRouteProp = RouteProp<
  TransactionDetailRoutesParams,
  TransactionDetailModalRoutes.TransactionDetailModal
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getTxInfo = (_txId: string): Transaction => ({
  type: 'Send',
  state: 'success',
  chainId: 1,
  txId: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
  amount: 10000,
  to: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
  date: new Date(1637472397 * 1000),
  confirmed: 123,
});

const getTransactionTypeStr = (
  intl: IntlShape,
  transaction: Transaction,
): string => {
  const stringKeys: Record<TransactionType, string> = {
    'Send': 'action__send',
    'Receive': 'action__receive',
    'Approve': 'action__send',
  };
  return intl.formatMessage({
    id: stringKeys[transaction.type ?? 'Send'],
  });
};

/**
 * 交易详情
 */
const TransactionDetails: FC<TransactionDetailsProps> = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<TransactionDetailRouteProp>();
  const { txId } = route.params;

  const txInfo = getTxInfo(txId);

  const getTransactionStatusIcon = (
    state: TransactionState = 'pending',
  ): ICON_NAMES => {
    const stringKeys: Record<TransactionState, ICON_NAMES> = {
      'pending': 'TxStatusWarningCircleIllus',
      'success': 'TxStatusSuccessCircleIllus',
      'failed': 'TxStatusFailureCircleIllus',
      'dropped': 'TxStatusFailureCircleIllus',
    };
    return stringKeys[state];
  };

  const getTransactionStatusColor = (
    state: TransactionState = 'pending',
  ): string => {
    const stringKeys: Record<TransactionState, string> = {
      'pending': 'text-warning',
      'success': 'text-success',
      'failed': 'text-critical',
      'dropped': 'text-critical',
    };
    return stringKeys[state];
  };

  const copyAddressToClipboard = useCallback(() => {
    copyToClipboard(txInfo.txId);
    toast.info(intl.formatMessage({ id: 'msg__copied' }));
  }, [toast, txInfo.txId]);

  return (
    <Modal
      header={getTransactionTypeStr(intl, txInfo)}
      headerDescription={txInfo.to}
      footer={null}
      height="560px"
      scrollViewProps={{
        pt: 4,
        children: (
          <Box flexDirection="column" alignItems="center" mb={6}>
            <Icon name={getTransactionStatusIcon(txInfo.state)} size={56} />
            <Typography.Heading
              mt={2}
              color={getTransactionStatusColor(txInfo.state)}
            >
              {getTransactionStatusStr(intl, txInfo.state)}
            </Typography.Heading>
            <Container.Box mt={6}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__hash' })}
              >
                <Box
                  flexDirection="row"
                  justifyContent="flex-end"
                  w="100%"
                  flexWrap="wrap"
                >
                  <Address
                    typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                    text={txInfo.txId}
                    short
                  />
                  <Pressable ml={3} onPress={copyAddressToClipboard}>
                    <Icon size={20} name="DuplicateSolid" />
                  </Pressable>
                </Box>
              </Container.Item>
              <Container.Item
                title={intl.formatMessage({ id: 'content__from' })}
                value="Account1"
                describe="0x4d16878c27c3847f18bd6d51d67f5b83b52ffe75"
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__to' })}
                value="0xd3f1530766492bf1be9a2ccda487c556d21f1ab8"
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__amount' })}
                value={txInfo.amount.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__fee' })}
                value={txInfo.amount.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__total' })}
                value={txInfo.amount.toString()}
                describe={txInfo.amount.toString()}
              />
            </Container.Box>

            <Typography.Subheading mt={6} w="100%" color="text-subdued">
              {intl.formatMessage({ id: 'content__more_details' })}
            </Typography.Subheading>
            <Container.Box mt={2}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_limit' })}
                value={txInfo.amount.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_used' })}
                value={txInfo.amount.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__gas_price' })}
                value={txInfo.amount.toString()}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__nonce' })}
                value={txInfo.amount.toString()}
              />
            </Container.Box>

            <Typography.Subheading mt={6} w="100%" color="text-subdued">
              {intl.formatMessage({ id: 'content__activity_logs' })}
            </Typography.Subheading>
            <Container.Box mt={2}>
              <Container.Item
                title={intl.formatMessage({ id: 'content__created' })}
                value={formatDate(txInfo.date)}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__submitted' })}
                value={formatDate(txInfo.date)}
              />
              <Container.Item
                title={intl.formatMessage({ id: 'content__confirmed' })}
                value={formatDate(txInfo.date)}
              />
            </Container.Box>

            <Button
              w="100%"
              mt={6}
              mb={6}
              size="lg"
              rightIcon={<Icon name="ArrowNarrowRightSolid" />}
            >
              {intl.formatMessage({ id: 'action__view_in_explorer' })}
            </Button>
          </Box>
        ),
      }}
    />
  );
};

export default TransactionDetails;
