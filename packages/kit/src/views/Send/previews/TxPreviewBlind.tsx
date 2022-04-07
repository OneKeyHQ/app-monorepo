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
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { FeeInfoInputForConfirm } from '../FeeInfoInput';

import { ITxPreviewModalProps, TxPreviewModal } from './TxPreviewModal';

function TxPreviewBlind(props: ITxPreviewModalProps) {
  const { feeInfoPayload, feeInfoLoading, feeInfoEditable, encodedTx, source } =
    props;
  const intl = useIntl();
  const cardBgColor = useThemeValue('surface-default');
  const encodedTxEvm = encodedTx as IEncodedTxEvm;

  return (
    <TxPreviewModal {...props}>
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
              {source?.origin}
            </Text>
          </Row>
        </Column>

        <Box>
          <Typography.Subheading mt="24px" color="text-subdued">
            {intl.formatMessage({ id: 'transaction__transaction_details' })}
          </Typography.Subheading>
          <Column bg={cardBgColor} borderRadius="12px" mt="2">
            <FeeInfoInputForConfirm
              disabled={!feeInfoEditable}
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
      </Column>
    </TxPreviewModal>
  );
}

export { TxPreviewBlind };
