import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Form,
  Input,
  Page,
  ScrollView,
  Stack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IGasEIP1559 } from '@onekeyhq/shared/types/fee';

import { FeeOverviewContainer } from './FeeOverviewContainer';
import { FeePredictionContainer } from './FeePredictionContainer';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendCustomFeeContainer() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendCustomFee>>();

  const { networkId, customFee, onApply } = route.params;

  const { feeDecimals, feeSymbol, nativeSymbol } = customFee.common;

  const form = useForm({
    defaultValues: {
      gasLimit:
        customFee.gas?.gasLimit ?? customFee.gasEIP1559?.gasLimit ?? '0',
      // gas legacy
      gasPrice: customFee.gas?.gasPrice ?? '0',
      // gas eip1559
      priorityFee: customFee.gasEIP1559?.maxPriorityFeePerGas ?? '0',
      maxFee: customFee.gasEIP1559?.maxFeePerGas ?? '0',
      // fee utxo
      feeRate: customFee.feeUTXO?.feeRate ?? '0',
    },
  });

  const watchAllFields = form.watch();

  const customFeeInfo = useMemo(
    () => ({
      common: customFee.common,
      gas: customFee.gas && {
        gasPrice: watchAllFields.gasPrice,
        gasLimit: watchAllFields.gasLimit,
        gasLimitForDisplay: watchAllFields.gasLimit,
      },
      gasEIP1559: customFee.gasEIP1559 && {
        baseFeePerGas: customFee.gasEIP1559?.baseFeePerGas ?? '0',
        maxPriorityFeePerGas: watchAllFields.priorityFee,
        maxFeePerGas: watchAllFields.maxFee,
        gasLimit: watchAllFields.gasLimit,
        gasLimitForDisplay: watchAllFields.gasLimit,
      },
      feeUTXO: customFee.feeUTXO && {
        feeRate: watchAllFields.feeRate,
      },
    }),
    [
      customFee.common,
      customFee.feeUTXO,
      customFee.gas,
      customFee.gasEIP1559,
      watchAllFields.feeRate,
      watchAllFields.gasLimit,
      watchAllFields.gasPrice,
      watchAllFields.maxFee,
      watchAllFields.priorityFee,
    ],
  );

  const shouldRenderFeePrediction = useMemo(
    () =>
      [getNetworkIdsMap().eth, getNetworkIdsMap().polygon].includes(networkId),
    [networkId],
  );

  const isApplyButtonDisabled = useMemo(() => {
    if (!form.formState.isValid) return true;
    return false;
  }, [form.formState.isValid]);

  const handleSelectFeePrediction = useCallback(
    (prediction: IGasEIP1559) => {
      form.setValue('priorityFee', prediction.maxPriorityFeePerGas);
      form.setValue('maxFee', prediction.maxFeePerGas);
    },
    [form],
  );

  const handleApplyCustomFee = useCallback(() => {
    onApply(customFeeInfo);
    navigation.pop();
  }, [customFeeInfo, navigation, onApply]);

  const renderCustomFeeForm = useCallback(() => {
    if (customFee.gas) {
      return (
        <YStack space="$5">
          <Form.Field
            label={`${intl.formatMessage({
              id: 'content__gas_price',
            })}(${feeSymbol})`}
            name="gasPrice"
            rules={{
              required: true,
            }}
          >
            <Input flex={1} />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: 'content__gas_limit',
            })}
            name="gasLimit"
            rules={{
              required: true,
            }}
          >
            <Input flex={1} />
          </Form.Field>
        </YStack>
      );
    }

    if (customFee.gasEIP1559) {
      const maxPriorityFeeInNative = new BigNumber(
        watchAllFields.priorityFee || 0,
      )
        .times(watchAllFields.gasLimit || 0)
        .shiftedBy(-feeDecimals)
        .toFixed(8);
      const maxFeeInNative = new BigNumber(watchAllFields.maxFee || 0)
        .times(watchAllFields.gasLimit || 0)
        .shiftedBy(-feeDecimals)
        .toFixed(8);
      return (
        <YStack space="$5">
          <Form.Field
            label={`${intl.formatMessage({
              id: 'form__priority_fee',
            })}(${feeSymbol})`}
            name="priorityFee"
            rules={{
              required: true,
            }}
          >
            <Input
              flex={1}
              addOns={[
                {
                  label: `${maxPriorityFeeInNative} ${nativeSymbol}`,
                },
              ]}
            />
          </Form.Field>
          <Form.Field
            label={`${intl.formatMessage({
              id: 'form__max_fee',
            })}(${feeSymbol})`}
            name="maxFee"
            rules={{
              required: true,
            }}
          >
            <Input
              flex={1}
              addOns={[
                {
                  label: `${maxFeeInNative} ${nativeSymbol}`,
                },
              ]}
            />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: 'content__gas_limit',
            })}
            name="gasLimit"
            rules={{
              required: true,
            }}
          >
            <Input flex={1} />
          </Form.Field>
        </YStack>
      );
    }

    if (customFee.feeUTXO) {
      return (
        <YStack space="$5">
          <Form.Field
            label={intl.formatMessage({
              id: 'form__fee_rate',
            })}
            name="feeRate"
            rules={{
              required: true,
            }}
          >
            <Input flex={1} />
          </Form.Field>
        </YStack>
      );
    }
  }, [
    customFee.feeUTXO,
    customFee.gas,
    customFee.gasEIP1559,
    feeDecimals,
    feeSymbol,
    intl,
    nativeSymbol,
    watchAllFields.gasLimit,
    watchAllFields.maxFee,
    watchAllFields.priorityFee,
  ]);
  return (
    <Page>
      <Page.Header title="Custom Fee" />
      <Page.Body>
        <ScrollView>
          <FeeOverviewContainer feeInfo={customFeeInfo} />
          <Divider />
          <Stack padding="$5">
            <Form form={form}>{renderCustomFeeForm()}</Form>
          </Stack>
          {shouldRenderFeePrediction ? (
            <>
              <Divider />
              <FeePredictionContainer
                networkId={networkId}
                onSelected={handleSelectFeePrediction}
              />
            </>
          ) : null}
        </ScrollView>
      </Page.Body>
      <Page.Footer>
        <YStack padding="$5" space="$2">
          <Button
            size="large"
            variant="primary"
            disabled={isApplyButtonDisabled}
            onPress={handleApplyCustomFee}
          >
            {intl.formatMessage({ id: 'action__apply' })}
          </Button>
        </YStack>
      </Page.Footer>
    </Page>
  );
}

export { SendCustomFeeContainer };
