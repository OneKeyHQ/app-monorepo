import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  Form,
  Input,
  SegmentControl,
  SizableText,
  Stack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import {
  useCustomFeeAtom,
  useSendSelectedFeeAtom,
  useSendSelectedFeeInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import type {
  IFeeInfoUnit,
  IFeeSelectorItem,
} from '@onekeyhq/shared/types/fee';
import { EFeeType } from '@onekeyhq/shared/types/fee';

type IProps = {
  networkId: string;
  feeSelectorItems: IFeeSelectorItem[];
};

function FeeEditor(props: IProps) {
  const { networkId, feeSelectorItems } = props;
  const intl = useIntl();

  const [sendSelectedFee] = useSendSelectedFeeAtom();
  const [originalCustomFee] = useCustomFeeAtom();
  const [selectedFee] = useSendSelectedFeeInfoAtom();
  const [currentFeeIndex, setCurrentFeeIndex] = useState(
    sendSelectedFee.feeType === EFeeType.Custom
      ? feeSelectorItems.length - 1
      : sendSelectedFee.presetIndex,
  );
  const [currentFeeType, setCurrentFeeType] = useState<EFeeType>(
    sendSelectedFee.feeType,
  );
  const customFee = (originalCustomFee ?? selectedFee?.feeInfo) as IFeeInfoUnit;

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

  const renderFeeTypeSelector = useCallback(
    () => (
      <SegmentControl
        fullWidth
        value={currentFeeIndex}
        onChange={(v) => {
          setCurrentFeeIndex(Number(v));
          setCurrentFeeType(feeSelectorItems[Number(v)].type);
        }}
        options={feeSelectorItems}
      />
    ),
    [currentFeeIndex, feeSelectorItems],
  );

  const renderFeeEditorForm = useCallback(() => {
    if (currentFeeType !== EFeeType.Custom) return null;
    console.log('customFee', customFee);

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
            })}`}
            name="priorityFee"
            rules={{
              required: true,
            }}
          >
            <Input
              flex={1}
              addOns={[
                {
                  label: feeSymbol,
                },
              ]}
            />
          </Form.Field>
          <Form.Field
            label={`${intl.formatMessage({
              id: 'form__max_fee',
            })}`}
            name="maxFee"
            rules={{
              required: true,
            }}
          >
            <Input
              flex={1}
              addOns={[
                {
                  label: feeSymbol,
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
    currentFeeType,
    customFee,
    feeDecimals,
    feeSymbol,
    intl,
    watchAllFields.gasLimit,
    watchAllFields.maxFee,
    watchAllFields.priorityFee,
  ]);

  const renderFeeOverview = useCallback(() => {}, []);

  return (
    <Stack space="$4">
      <Stack space="$5" p="$5">
        {renderFeeTypeSelector()}
        <Form form={form}>{renderFeeEditorForm()}</Form>
      </Stack>
      <Divider />
      {renderFeeOverview()}
    </Stack>
  );
}

export { FeeEditor };
