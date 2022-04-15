import React from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Text,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { DecodeTxButtonTest } from '../DecodeTxButtonTest';
import { FeeInfoInputForConfirm } from '../FeeInfoInput';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function TxConfirmBlind(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sourceInfo,
  } = props;
  const intl = useIntl();
  const cardBgColor = useThemeValue('surface-default');
  const encodedTxEvm = encodedTx as IEncodedTxEvm;

  return (
    <SendConfirmModal {...props}>
      <Column flex="1">
        <Column bg={cardBgColor} borderRadius="12px" mt="24px">
          {/* From */}
          <Row justifyContent="space-between" space="16px" padding="16px">
            <Text
              color="text-subdued"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {intl.formatMessage({ id: 'content__from' })}
            </Text>
            <Text
              textAlign="right"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex={1}
              noOfLines={3}
            >
              {encodedTxEvm.from}
            </Text>
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
              {encodedTxEvm.to || '-'}
            </Text>
          </Row>
          <Divider />
          <Row justifyContent="space-between" space="16px" padding="16px">
            <Text
              color="text-subdued"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {intl.formatMessage({ id: 'content__interact_with' })}
            </Text>
            <Text
              textAlign="right"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              flex={1}
              noOfLines={3}
            >
              {sourceInfo?.origin}
            </Text>
          </Row>
        </Column>

        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'transaction__transaction_details' })}
          </Typography.Subheading>
          <Column bg={cardBgColor} borderRadius="12px" mt="2">
            <FeeInfoInputForConfirm
              editable={feeInfoEditable}
              encodedTx={encodedTx}
              feeInfoPayload={feeInfoPayload}
              loading={feeInfoLoading}
            />
          </Column>
        </Box>

        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'content__more_details' })}
          </Typography.Subheading>
          <Column bg={cardBgColor} borderRadius="12px" mt="2">
            <Row justifyContent="space-between" space="16px" padding="16px">
              <Text
                color="text-subdued"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              >
                {intl.formatMessage({ id: 'form__contract_data' })}
              </Text>
              <Text
                textAlign="right"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                flex={1}
                noOfLines={3}
              >
                {encodedTxEvm.data || '-'}
              </Text>
            </Row>
          </Column>
        </Box>
        <DecodeTxButtonTest encodedTx={encodedTxEvm} />
      </Column>
    </SendConfirmModal>
  );
}

export { TxConfirmBlind };
