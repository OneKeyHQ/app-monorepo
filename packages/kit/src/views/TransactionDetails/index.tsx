import React, { FC } from 'react';

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
  Typography,
} from '@onekeyhq/components';
import { ICON_NAMES } from '@onekeyhq/components/src/Icon';

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
          <ContentItem title="Hash">
            <Box flexDirection="row">
              <Address text={txInfo.txId} short />
              <Pressable ml={3} onPress={() => {}}>
                <Icon name="ClipboardCopySolid" />
              </Pressable>
            </Box>
          </ContentItem>
          <ContentItem
            title="From"
            value="Account1"
            describe="0x4d16878c27c3847f18bd6d51d67f5b83b52ffe75"
          />
          <ContentItem
            title="To"
            value="Account2"
            describe="0x4d16878c27c3847f18bd6d51d67f5b83b52ffe75"
          />
          <ContentItem title="Amount" value={txInfo.amount.toString()} />
          <ContentItem title="Fee" value={txInfo.amount.toString()} />
          <ContentItem
            title="Total"
            value={txInfo.amount.toString()}
            describe={txInfo.amount.toString()}
          />
        </ContentItemBox>

        <Typography.Subheading mt={6} w="100%" color="text-subdued">
          More Details
        </Typography.Subheading>
        <ContentItemBox mt={2}>
          <ContentItem title="Gas Limit" value={txInfo.amount.toString()} />
          <ContentItem title="Gas Used" value={txInfo.amount.toString()} />
          <ContentItem title="Gas Price" value={txInfo.amount.toString()} />
          <ContentItem title="Noce" value={txInfo.amount.toString()} />
        </ContentItemBox>

        <Typography.Subheading mt={6} w="100%" color="text-subdued">
          Activity Logs
        </Typography.Subheading>
        <ContentItemBox mt={2}>
          <ContentItem title="Created" value={formatDate(txInfo.date, true)} />
          <ContentItem
            title="Submitted"
            value={formatDate(txInfo.date, true)}
          />
          <ContentItem
            title="Confirmed"
            value={formatDate(txInfo.date, true)}
          />
        </ContentItemBox>

        <Button
          w="100%"
          mt={6}
          mb={6}
          rightIcon={<Icon name="ArrowSmRightOutline" />}
        >
          View in Explorer
        </Button>
      </Box>
    </ScrollView>
  );
};

export default TransactionDetails;
