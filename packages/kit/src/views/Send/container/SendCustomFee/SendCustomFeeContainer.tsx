import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { YStack } from 'tamagui';

import { Form, Input, Page, useForm } from '@onekeyhq/components';

import { FeeOverviewContainer } from './FeeOverviewContainer';

import type { EModalSendRoutes, IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendCustomFeeContainer() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.SendCustomFee>>();

  const { networkId, customFee } = route.params;

  const { feeDecimals, feeSymbol, nativeSymbol } = customFee.common;

  const form = useForm({
    defaultValues: {
      gasLimit: customFee.common.limit,
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
      common: {
        ...customFee.common,
        limit: watchAllFields.gasLimit,
        limitForDisplay: watchAllFields.gasLimit,
      },
      gas: {
        gasPrice: watchAllFields.gasPrice,
      },
      gasEIP1559: {
        baseFeePerGas: customFee.gasEIP1559?.baseFeePerGas ?? '0',
        maxPriorityFeePerGas: watchAllFields.priorityFee,
        maxFeePerGas: watchAllFields.maxFee,
      },
      feeUTXO: {
        feeRate: watchAllFields.feeRate,
      },
    }),
    [
      customFee.common,
      customFee.gasEIP1559?.baseFeePerGas,
      watchAllFields.feeRate,
      watchAllFields.gasLimit,
      watchAllFields.gasPrice,
      watchAllFields.maxFee,
      watchAllFields.priorityFee,
    ],
  );

  const renderCustomFeeForm = useCallback(() => {
    if (customFee.gas) {
      return (
        <YStack space="$5">
          <Form.Field
            label={`${intl.formatMessage({
              id: 'content__gas_price',
            })}(${feeSymbol})`}
            name="gasPrice"
          >
            <Input flex={1} />
          </Form.Field>
          <Form.Field
            label={intl.formatMessage({
              id: 'content__gas_limit',
            })}
            name="gasLimit"
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
        <FeeOverviewContainer feeInfo={customFeeInfo} />
        <Form form={form}>{renderCustomFeeForm()}</Form>
      </Page.Body>
    </Page>
  );
}

export { SendCustomFeeContainer };
