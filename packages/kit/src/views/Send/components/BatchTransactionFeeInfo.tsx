import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  BottomSheetModal,
  Box,
  Container,
  HStack,
  Icon,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import type {
  IEncodedTx,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatCurrencyNativeOfAccount } from '../../../components/Format';
import { setFeePresetIndex } from '../../../store/reducers/data';
import { showOverlay } from '../../../utils/overlayUtils';
import { SendEditFeeStandardFormLite } from '../modals/SendEditFee/SendEditFeeStandardFormLite';
import { SendModalRoutes } from '../types';
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
  feeInfoError?: Error | null;
}

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.BatchSendConfirm
>;

function PressableWrapper({
  children,
  canPress,
  onPress,
}: {
  children: ReactNode;
  canPress: boolean;
  onPress: () => void;
}) {
  if (canPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    );
  }
  return <>{children}</>;
}

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
    feeInfoError,
  } = props;

  const [hasTooltipOpen, setHasTooltipOpen] = useState(false);

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

  const errorHint = useMemo(() => {
    if (!feeInfoError) {
      return null;
    }

    let message: string | null = null;
    if (feeInfoError instanceof OneKeyError) {
      if (feeInfoError.key !== 'onekey_error') {
        message = intl.formatMessage({
          // @ts-expect-error
          id: feeInfoError.key,
        });
      } else {
        message = feeInfoError.message;
      }
    } else {
      message = feeInfoError.message;
    }
    if (message && message.length > 350) {
      message = `${message.slice(0, 350)}...`;
    }

    return (
      !!message &&
      !feeInfoLoading && (
        <Tooltip
          maxW="360px"
          isOpen={hasTooltipOpen}
          hasArrow
          label={message}
          bg="surface-neutral-default"
          _text={{ color: 'text-default', fontSize: '14px' }}
          px="16px"
          py="8px"
          placement="top"
          borderRadius="12px"
        >
          <Box>
            <Icon
              name="ExclamationTriangleOutline"
              size={20}
              color="icon-warning"
            />
          </Box>
        </Tooltip>
      )
    );
  }, [feeInfoError, hasTooltipOpen, intl, feeInfoLoading]);

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
        navigation.replace(SendModalRoutes.SendEditFee, {
          networkId,
          accountId,
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
          forBatchSend: !isSingleTransformMode,
        });
      } else {
        navigation.navigate({
          name: SendModalRoutes.SendEditFee,
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
      <PressableWrapper
        canPress={!!errorHint}
        onPress={() => setHasTooltipOpen(!hasTooltipOpen)}
      >
        <Container.Box borderWidth={1} borderColor="border-subdued">
          <Container.Item
            onPress={disabled ? null : handleNativeToEdit}
            wrap={
              <HStack p={4} alignItems="center" pr={2}>
                <VStack flex={1} space={1}>
                  <Text typography="Body2Strong" color="text-subdued">
                    {intl.formatMessage({ id: 'form__gas_fee_settings' })}
                  </Text>
                  <HStack alignItems="center">
                    <FeeSpeedLabel
                      prices={feeInfoPayload?.info?.prices}
                      index={feePresetIndex}
                      space={2}
                      alignItems="center"
                    />
                    <Text typography="Body1Strong">
                      <FormatCurrencyNativeOfAccount
                        networkId={networkId}
                        accountId={accountId}
                        value={totalFeeInNative}
                        render={(ele) => <>(~ {ele})</>}
                      />
                    </Text>
                  </HStack>
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
                    {errorHint}
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
      </PressableWrapper>
    );
  }

  return (
    <Container.Box borderWidth={1} borderColor="border-subdued">
      <Container.Item
        onPress={disabled ? null : handleNativeToEdit}
        wrap={
          <HStack p={4} alignItems="center" pr={2}>
            <VStack flex={1} space={1}>
              <Text typography="Body2Strong" color="text-subdued">
                {intl.formatMessage({ id: 'form__gas_fee_settings' })}
              </Text>
              <FeeSpeedLabel
                index={feePresetIndex}
                prices={feeInfoPayload?.info?.prices}
                alignItems="center"
                space={2}
              />
            </VStack>
            {!disabled && (
              <Box>
                <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
              </Box>
            )}
          </HStack>
        }
      />
      <Container.Item
        hidePadding
        wrap={
          <PressableWrapper
            canPress={!!errorHint}
            onPress={() => setHasTooltipOpen(!hasTooltipOpen)}
          >
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
                  {errorHint}
                  {feeInfoLoading ? <Spinner size="sm" /> : null}
                  <Box flex={1} />
                </Box>
              </VStack>
            </Box>
          </PressableWrapper>
        }
      />
    </Container.Box>
  );
}

export { BatchTransactionFeeInfo };
