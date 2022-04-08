import React from 'react';

import BigNumber from 'bignumber.js';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Spinner,
  Text,
  Token,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import { TxTitleDetailView } from '../TxTitleDetailView';
import { TransferSendParamsPayload } from '../types';

import { ITxPreviewModalProps, TxPreviewModal } from './TxPreviewModal';

function TxPreviewTransfer(props: ITxPreviewModalProps) {
  const {
    payload,
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
  } = props;
  const intl = useIntl();
  const transferPayload = payload as TransferSendParamsPayload;
  const cardBgColor = useThemeValue('surface-default');
  const isTransferNativeToken = !transferPayload?.token?.idOnNetwork;
  const totalTransfer = isTransferNativeToken
    ? new BigNumber(transferPayload?.value)
        .plus(feeInfoPayload?.current?.totalNative ?? '')
        .toFixed()
    : false;

  return (
    <TxPreviewModal {...props}>
      <Column flex="1">
        <Center>
          <Token src={transferPayload?.token?.logoURI} size="56px" />
          <Typography.Heading mt="8px">
            {`${transferPayload?.token?.symbol}(${transferPayload?.token?.name})`}
          </Typography.Heading>
        </Center>
        <Column bg={cardBgColor} borderRadius="12px" mt="24px">
          {/* From */}
          <Row justifyContent="space-between" space="16px" padding="16px">
            <Text
              color="text-subdued"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {intl.formatMessage({ id: 'content__from' })}
            </Text>
            <Column alignItems="flex-end" w="auto" flex={1}>
              <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                {transferPayload?.account?.name}
              </Text>
              <Typography.Body2
                textAlign="right"
                color="text-subdued"
                numberOfLines={3}
              >
                {transferPayload?.account?.address}
              </Typography.Body2>
            </Column>
          </Row>
          <Divider />
          {/* To */}
          <Row justifyContent="space-between" space="16px" padding="16px">
            <Text
              color="text-subdued"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {intl.formatMessage({ id: 'content__to' })}
            </Text>
            <Text
              textAlign="right"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex={1}
              noOfLines={3}
            >
              {transferPayload?.to}
            </Text>
          </Row>
        </Column>
        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'transaction__transaction_details' })}
          </Typography.Subheading>
        </Box>

        <Column bg={cardBgColor} borderRadius="12px" mt="2">
          <TxTitleDetailView
            title={intl.formatMessage({ id: 'content__amount' })}
            detail={`${transferPayload?.value} ${transferPayload?.token?.symbol}`}
          />
          <Divider />
          <FeeInfoInputForConfirm
            disabled={!feeInfoEditable}
            encodedTx={encodedTx}
            feeInfoPayload={feeInfoPayload}
            loading={feeInfoLoading}
          />
          <Divider />
          {totalTransfer && (
            <TxTitleDetailView
              title={`${intl.formatMessage({
                id: 'content__total',
              })}(${intl.formatMessage({
                id: 'content__amount',
              })} + ${intl.formatMessage({ id: 'content__fee' })})`}
              detail={
                feeInfoLoading ? (
                  <Spinner />
                ) : (
                  `${totalTransfer} ${feeInfoPayload?.info?.nativeSymbol || ''}`
                )
              }
            />
          )}
        </Column>
      </Column>
    </TxPreviewModal>
  );
}

export { TxPreviewTransfer };
