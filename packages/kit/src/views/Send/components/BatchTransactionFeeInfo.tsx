import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Container,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from '@onekeyhq/components';
import type {
  IEncodedTx,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrencyNativeOfAccount } from '../../../components/Format';
import { setFeePresetIndex } from '../../../store/reducers/data';
import { showOverlay } from '../../../utils/overlayUtils';
import { SendEditFeeStandardFormLite } from '../modals/SendEditFee/SendEditFeeStandardFormLite';
import { SendRoutes } from '../types';
import { useFeePresetIndex } from '../utils/useFeePresetIndex';
import { useNetworkFeeInfoEditable } from '../utils/useNetworkFeeInfoEditable';

import { FeeSpeedLabel } from './FeeSpeedLabel';

import type { BatchSendConfirmParams, SendRoutesParams } from '../types';
import type { StackNavigationProp } from '@react-navigation/stack';

interface Props {
  feeInfoPayloads: IFeeInfoPayload[];
  feeInfoLoading: boolean;
  totalFeeInNative: number;
  minTotalFeeInNative: number;
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
    minTotalFeeInNative,
    accountId,
    networkId,
    encodedTxs,
    batchSendConfirmParams,
    isSingleTransformMode,
  } = props;

  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const defaultFeePresetIndex = useFeePresetIndex(networkId);
  const networkFeeInfoEditable = useNetworkFeeInfoEditable({ networkId });
  // eslint-disable-next-line react/destructuring-assignment
  const editable = networkFeeInfoEditable && props.editable;

  const encodedTx = encodedTxs[0];
  const feeInfoPayload = feeInfoPayloads[0];

  const feePresetIndex =
    (isSingleTransformMode
      ? feeInfoPayload?.selected?.preset
      : defaultFeePresetIndex) || '0';

  if (feeInfoPayload && feeInfoPayload.selected) {
    feeInfoPayload.selected.preset = feePresetIndex;
  }

  const nativeSymbol = feeInfoPayload?.info?.nativeSymbol || '';

  const disabled =
    feeInfoLoading ||
    !editable ||
    !encodedTx ||
    !feeInfoPayload ||
    batchSendConfirmParams.signOnly;

  const showEditFeeLite = useCallback(() => {
    showOverlay((close) => (
      <BottomSheetModal
        title={intl.formatMessage({ id: 'action__edit_fee' })}
        closeOverlay={close}
      >
        <SendEditFeeStandardFormLite
          feeInfoPayload={feeInfoPayload}
          value={feeInfoPayload.selected.preset}
          onChange={(value) => {
            close();
            backgroundApiProxy.dispatch(
              setFeePresetIndex({ networkId, index: value }),
            );
          }}
        />
      </BottomSheetModal>
    ));
  }, [feeInfoPayload, intl, networkId]);

  const handleNativeToEdit = useCallback(
    ({ replace = false }: { replace?: boolean } = {}) => {
      if (disabled) {
        return;
      }

      if (!isSingleTransformMode) {
        return showEditFeeLite();
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
      isSingleTransformMode,
      showEditFeeLite,
      navigation,
      networkId,
      accountId,
      encodedTx,
      feeInfoPayload?.selected,
    ],
  );

  if (isSingleTransformMode) {
    return (
      <Container.Box>
        <Container.Item
          onPress={disabled ? null : handleNativeToEdit}
          wrap={
            <HStack p={4} alignItems="center" pr={2}>
              <VStack flex={1} space={1}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__gas_fee_settings' })}
                </Text>
                <Text typography="Body1Strong">
                  <FeeSpeedLabel index={feePresetIndex} />
                  <FormatCurrencyNativeOfAccount
                    networkId={networkId}
                    accountId={accountId}
                    value={totalFeeInNative}
                    render={(ele) => <>(~ {ele})</>}
                  />
                </Text>
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
              </VStack>
              {!disabled && (
                <Box>
                  <Icon
                    name="ChevronRightMini"
                    color="icon-subdued"
                    size={20}
                  />
                </Box>
              )}
            </HStack>
          }
        />
      </Container.Box>
    );
  }

  return (
    <>
      <Container.Box>
        <Container.Item
          onPress={disabled ? null : handleNativeToEdit}
          wrap={
            <HStack p={4} alignItems="center" pr={2}>
              <VStack flex={1} space={1}>
                <Text typography="Body2Strong" color="text-subdued">
                  {intl.formatMessage({ id: 'form__gas_fee_settings' })}
                </Text>
                <Text typography="Body1Strong">
                  <FeeSpeedLabel index={feePresetIndex} />
                </Text>
              </VStack>
              {!disabled && (
                <Box>
                  <Icon
                    name="ChevronRightMini"
                    color="icon-subdued"
                    size={20}
                  />
                </Box>
              )}
            </HStack>
          }
        />
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
                      {minTotalFeeInNative === totalFeeInNative &&
                        `${totalFeeInNative} ${nativeSymbol}`}
                      {minTotalFeeInNative !== totalFeeInNative &&
                        `${minTotalFeeInNative} ~ ${totalFeeInNative} ${nativeSymbol}`}
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
      </Container.Box>
      {!isSingleTransformMode && (
        <Text typography="Caption" color="text-subdued" mt="12px">
          {intl.formatMessage({
            id: 'content__to_ensure_that_the_transaction_will_be_successfully_sent',
          })}
        </Text>
      )}
    </>
  );
}

export { BatchTransactionFeeInfo };
