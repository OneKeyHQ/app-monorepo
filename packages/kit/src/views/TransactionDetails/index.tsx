import React, { FC, useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Address,
  Box,
  Button,
  ContentItem,
  ContentItemBox,
  Icon,
  Pressable,
  ScrollView,
  Toast,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';

import { copyToClipboard } from '../../utils/ClipboardUtils';
import { formatDate } from '../../utils/DateUtils';
import {
  Transaction,
  TransactionState,
  getTransactionStatusStr,
} from '../Components/transactionRecord';

export type TransactionDetailsProps = {
  txId: string;
};

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

/**
 * 交易详情
 */
const TransactionDetails: FC<TransactionDetailsProps> = ({ txId }) => {
  const intl = useIntl();
  const toast = useToast();
  const toastIdRef = useRef<string>();

  const txInfo = getTxInfo(txId);

  const showToast = useCallback(
    (msg: string) => {
      toastIdRef.current = toast.show({
        render: () => <Toast title={msg} status="success" dismiss />,
      }) as string;
    },
    [toast],
  );

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

  const copyAddressToClipboard = () => {
    copyToClipboard(txInfo.txId);
    showToast(intl.formatMessage({ id: 'msg__copied' }));
  };

  return (
    <ScrollView>
      <Box flexDirection="column" alignItems="center">
        <Icon name={getTransactionStatusIcon(txInfo.state)} size={56} />
        <Typography.Heading
          mt={2}
          color={getTransactionStatusColor(txInfo.state)}
        >
          {getTransactionStatusStr(intl, txInfo.state)}
        </Typography.Heading>
        <ContentItemBox mt={6}>
          <ContentItem title={intl.formatMessage({ id: 'content__hash' })}>
            <Box flexDirection="row">
              <Address text={txInfo.txId} short />
              <Pressable ml={3} onPress={copyAddressToClipboard}>
                <Icon name="ClipboardCopySolid" />
              </Pressable>
            </Box>
          </ContentItem>
          <ContentItem
            title={intl.formatMessage({ id: 'content__from' })}
            value="Account1"
            describe="0x4d16878c27c3847f18bd6d51d67f5b83b52ffe75"
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__to' })}
            value="0xd3f1530766492bf1be9a2ccda487c556d21f1ab8"
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__amount' })}
            value={txInfo.amount.toString()}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__fee' })}
            value={txInfo.amount.toString()}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__total' })}
            value={txInfo.amount.toString()}
            describe={txInfo.amount.toString()}
          />
        </ContentItemBox>

        <Typography.Subheading mt={6} w="100%" color="text-subdued">
          {intl.formatMessage({ id: 'content__more_details' })}
        </Typography.Subheading>
        <ContentItemBox mt={2}>
          <ContentItem
            title={intl.formatMessage({ id: 'content__gas_limit' })}
            value={txInfo.amount.toString()}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__gas_used' })}
            value={txInfo.amount.toString()}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__gas_price' })}
            value={txInfo.amount.toString()}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__nonce' })}
            value={txInfo.amount.toString()}
          />
        </ContentItemBox>

        <Typography.Subheading mt={6} w="100%" color="text-subdued">
          {intl.formatMessage({ id: 'content__activity_logs' })}
        </Typography.Subheading>
        <ContentItemBox mt={2}>
          <ContentItem
            title={intl.formatMessage({ id: 'content__created' })}
            value={formatDate(txInfo.date)}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__submitted' })}
            value={formatDate(txInfo.date)}
          />
          <ContentItem
            title={intl.formatMessage({ id: 'content__confirmed' })}
            value={formatDate(txInfo.date)}
          />
        </ContentItemBox>

        <Button
          w="100%"
          mt={6}
          mb={6}
          rightIcon={<Icon name="ArrowSmRightOutline" />}
        >
          {intl.formatMessage({ id: 'action__view_in_explorer' })}
        </Button>
      </Box>
    </ScrollView>
  );
};

export default TransactionDetails;
