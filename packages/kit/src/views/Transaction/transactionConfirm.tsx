import React from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Modal,
  Token,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

const MockData = {
  token: {
    name: 'ETH',
    chain: 'Ethereum',
    url: '',
  },
  fromAddress: '0x4d16878c270x4d16878c270x4',
  toAddress: '0x4d16878c270x4d16878c270x40x4d16878c270x4d16878c270x4',
  detail: {
    amount: '1.0532145',
    token: 'ETH',
    fee: '20000',
    total: '21,000 (100%)',
  },
};

const renderTitleDetailView = (title: string, detail: string) => (
  <Row justifyContent="space-between" space="16px" padding="16px">
    <Typography.Body1 color="text-subdued">{title}</Typography.Body1>
    <Typography.Body1 textAlign="right" flex={1} numberOfLines={1}>
      {detail}
    </Typography.Body1>
  </Row>
);

const TransactionConfirm = ({ ...rest }) => {
  const cardBgColor = useThemeValue('surface-default');
  const { visible } = rest;
  const { trigger } = rest;
  const intl = useIntl();

  return (
    <Modal
      visible={visible}
      primaryActionTranslationId="Confirm"
      secondaryActionTranslationId="Reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      trigger={trigger}
    >
      <Column flex="1">
        <Center>
          <Token chain={MockData.token.chain} size="56px" />
          <Typography.Heading mt="8px">
            {`${MockData.token.name}(${MockData.token.chain})`}
          </Typography.Heading>
        </Center>
        <Column bg={cardBgColor} borderRadius="12px" mt="24px">
          {/* From */}
          <Row justifyContent="space-between" space="16px" padding="16px">
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage({ id: 'content__from' })}
            </Typography.Body1>
            <Column alignItems="flex-end" w="auto" flex={1}>
              <Typography.Body1>ETH #1</Typography.Body1>
              <Typography.Body2 textAlign="right" color="text-subdued">
                {MockData.fromAddress}
              </Typography.Body2>
            </Column>
          </Row>
          <Divider />
          {/* To */}
          <Row justifyContent="space-between" space="16px" padding="16px">
            <Typography.Body1 color="text-subdued">
              {intl.formatMessage({ id: 'content__to' })}
            </Typography.Body1>
            <Typography.Body1 textAlign="right" flex={1}>
              {MockData.toAddress}
            </Typography.Body1>
          </Row>
        </Column>
        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'transaction__transaction_details' })}
          </Typography.Subheading>
        </Box>

        <Column bg={cardBgColor} borderRadius="12px" mt="24px">
          {renderTitleDetailView(
            intl.formatMessage({ id: 'content__amount' }),
            MockData.detail.amount,
          )}
          <Divider />
          {renderTitleDetailView(
            `${intl.formatMessage({ id: 'content__fee' })}(${intl.formatMessage(
              { id: 'content__estimated' },
            )})`,
            MockData.detail.fee,
          )}
          <Divider />
          {renderTitleDetailView(
            `${intl.formatMessage({
              id: 'content__total',
            })}(${intl.formatMessage({
              id: 'content__amount',
            })} + ${intl.formatMessage({ id: 'content__fee' })})`,
            MockData.detail.total,
          )}
        </Column>
      </Column>
    </Modal>
  );
};

export default TransactionConfirm;
