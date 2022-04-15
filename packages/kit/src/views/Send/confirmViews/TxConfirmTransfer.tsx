import React, { useMemo } from 'react';

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
import {
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
} from '@onekeyhq/engine/src/types/vault';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { DecodeTxButtonTest } from '../DecodeTxButtonTest';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';
import { TxTitleDetailView } from '../TxTitleDetailView';
import { TransferSendParamsPayload } from '../types';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function TxConfirmTransfer(props: ITxConfirmViewProps) {
  const {
    payload,
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
  } = props;
  const intl = useIntl();
  const { accountId, networkId } = useActiveWalletAccount();
  const transferPayload = payload as TransferSendParamsPayload;
  const cardBgColor = useThemeValue('surface-default');
  const isTransferNativeToken = !transferPayload?.token?.idOnNetwork;

  const transferAmount = useMemo(() => {
    if (transferPayload.isMax) {
      if (isTransferNativeToken) {
        return new BigNumber(transferPayload.token.balance ?? 0)
          .minus(feeInfoPayload?.current?.totalNative ?? 0)
          .toFixed();
      }
      return transferPayload.token.balance ?? '0';
    }
    return transferPayload.value ?? '0';
  }, [
    feeInfoPayload,
    isTransferNativeToken,
    transferPayload.isMax,
    transferPayload.token.balance,
    transferPayload.value,
  ]);

  const totalCost = useMemo(() => {
    const fee = feeInfoPayload?.current?.totalNative ?? '0';
    return isTransferNativeToken
      ? new BigNumber(fee).plus(transferAmount ?? '0').toFixed()
      : fee;
  }, [feeInfoPayload, isTransferNativeToken, transferAmount]);

  return (
    <SendConfirmModal
      {...props}
      confirmDisabled={new BigNumber(transferAmount).lt(0)}
      updateEncodedTxBeforeConfirm={async (tx) => {
        if (transferPayload.isMax) {
          const updatePayload: IEncodedTxUpdatePayloadTransfer = {
            amount: transferAmount,
          };
          const newTx = await backgroundApiProxy.engine.updateEncodedTx({
            networkId,
            accountId,
            encodedTx: tx,
            payload: updatePayload,
            options: {
              type: IEncodedTxUpdateType.transfer,
            },
          });
          return Promise.resolve(newTx);
        }
        return Promise.resolve(tx);
      }}
    >
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
            detail={`${transferAmount} ${transferPayload?.token?.symbol}`}
          />
          <Divider />
          <FeeInfoInputForConfirm
            editable={feeInfoEditable}
            encodedTx={encodedTx}
            feeInfoPayload={feeInfoPayload}
            loading={feeInfoLoading}
          />
          <Divider />
          {isTransferNativeToken && (
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
                  `${totalCost} ${feeInfoPayload?.info?.nativeSymbol || ''}`
                )
              }
            />
          )}
        </Column>
        <DecodeTxButtonTest encodedTx={encodedTx} />
      </Column>
    </SendConfirmModal>
  );
}

export { TxConfirmTransfer };
