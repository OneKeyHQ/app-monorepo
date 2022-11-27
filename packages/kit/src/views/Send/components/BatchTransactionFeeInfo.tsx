import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from '@onekeyhq/components';
import { IEncodedTx, IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';

import { FormatCurrencyNativeOfAccount } from '../../../components/Format';
import { BatchSendConfirmParams, SendRoutes, SendRoutesParams } from '../types';

import { FeeSpeedLabel } from './FeeSpeedLabel';

import type { StackNavigationProp } from '@react-navigation/stack';

interface Props {
  feeInfoPayloads: IFeeInfoPayload[];
  feeInfoLoading: boolean;
  totalFeeInNative: number;
  networkId: string;
  accountId: string;
  editable: boolean;
  encodedTxs: IEncodedTx[];
  batchSendConfirmParams: BatchSendConfirmParams;
  isSingleTransformMode?: boolean;
}

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.BatchSendConfirm
>;

function BatchTransactionFeeInfo(props: Props) {
  const {
    feeInfoPayloads,
    feeInfoLoading,
    totalFeeInNative,
    accountId,
    networkId,
    editable,
    encodedTxs,
    batchSendConfirmParams,
    isSingleTransformMode,
  } = props;

  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();

  const encodedTx = encodedTxs[0];
  const feeInfoPayload = feeInfoPayloads[0];

  const disabled =
    feeInfoLoading ||
    !editable ||
    !encodedTx ||
    !feeInfoPayload ||
    batchSendConfirmParams.signOnly;

  const handleNativeToEdit = useCallback(
    ({ replace = false }: { replace?: boolean } = {}) => {
      if (disabled) {
        return;
      }
      if (replace) {
        navigation.replace(SendRoutes.SendEditFee, {
          networkId,
          accountId,
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
          forBatchSend: !isSingleTransformMode,
        });
      } else {
        navigation.navigate({
          name: SendRoutes.SendEditFee,
          params: {
            networkId,
            accountId,
            encodedTx,
            feeInfoSelected: feeInfoPayload?.selected,
            forBatchSend: !isSingleTransformMode,
          },
        });
      }
    },
    [
      disabled,
      navigation,
      networkId,
      accountId,
      encodedTx,
      feeInfoPayload?.selected,
      isSingleTransformMode,
    ],
  );

  return (
    <Container.Box>
      <Container.Item
        hasDivider={!isSingleTransformMode}
        onPress={disabled ? null : handleNativeToEdit}
        wrap={
          <HStack p={4} alignItems="center" pr={2}>
            <VStack flex={1} space={1}>
              <Text typography="Body2Strong" color="text-subdued">
                {intl.formatMessage({ id: 'form__gas_fee_settings' })}
              </Text>
              <Text typography="Body1Strong">
                <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />
                {isSingleTransformMode && (
                  <FormatCurrencyNativeOfAccount
                    networkId={networkId}
                    accountId={accountId}
                    value={totalFeeInNative}
                    render={(ele) => <>(~ {ele})</>}
                  />
                )}
              </Text>
              {isSingleTransformMode && (
                <Box
                  w="100%"
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {feeInfoPayload ? (
                    <Text typography="Body2" color="text-subdued">
                      {`${totalFeeInNative} ${
                        feeInfoPayload?.info?.nativeSymbol || ''
                      }`}
                    </Text>
                  ) : (
                    <Text color="text-subdued" flex={1}>
                      {intl.formatMessage({ id: 'content__calculate_fee' })}
                    </Text>
                  )}
                  <Box w={2} />
                  {feeInfoLoading ? <Spinner size="sm" /> : null}
                  <Box flex={1} />
                </Box>
              )}
            </VStack>
            {!disabled && (
              <Box>
                <Icon name="ChevronRightSolid" size={20} />
              </Box>
            )}
          </HStack>
        }
      />
      {!isSingleTransformMode && (
        <Container.Item
          hidePadding
          wrap={
            <Box flexDirection="column" w="100%" p={4}>
              <VStack space={1}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__estimate_total_gas_fee' })}
                </Text>
                <Box
                  w="100%"
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {feeInfoPayload ? (
                    <Text typography="Body1Strong">
                      {`${totalFeeInNative} ${
                        feeInfoPayload?.info?.nativeSymbol || ''
                      }`}
                    </Text>
                  ) : (
                    <Text color="text-subdued" flex={1}>
                      {intl.formatMessage({ id: 'content__calculate_fee' })}
                    </Text>
                  )}
                  <Box w={2} />
                  {feeInfoLoading ? <Spinner size="sm" /> : null}
                  <Box flex={1} />
                </Box>
              </VStack>
            </Box>
          }
        />
      )}
    </Container.Box>
  );
}

export { BatchTransactionFeeInfo };
