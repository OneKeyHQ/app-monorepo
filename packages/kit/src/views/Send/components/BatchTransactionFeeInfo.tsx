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
          forBatchSend: true,
        });
      } else {
        navigation.navigate({
          name: SendRoutes.SendEditFee,
          params: {
            networkId,
            accountId,
            encodedTx,
            feeInfoSelected: feeInfoPayload?.selected,
            forBatchSend: true,
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
    ],
  );

  return (
    <Container.Box>
      <Container.Item
        onPress={handleNativeToEdit}
        wrap={
          <HStack p={4} alignItems="center" pr={2}>
            <VStack flex={1}>
              <Text typography="Body2Strong" color="text-subdued">
                Gas Fee Settings
              </Text>
              <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />
              </Text>
            </VStack>
            <Box>
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          </HStack>
        }
      />
      <Container.Item
        hidePadding
        wrap={
          <Box flexDirection="column" w="100%" p={4}>
            <Text typography="Body2Strong" color="text-subdued">
              Estimate Total Gas Fee
            </Text>
            <Box
              w="100%"
              flexDirection="row"
              alignItems="center"
              justifyContent="flex-start"
            >
              {feeInfoPayload ? (
                <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
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
          </Box>
        }
      />
    </Container.Box>
  );
}

export { BatchTransactionFeeInfo };
