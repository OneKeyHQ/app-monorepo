import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Form,
  Input,
  NumberSizeableText,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import {
  useCustomFeeAtom,
  useSendSelectedFeeAtom,
  useSendSelectedFeeInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { getFeePriceNumber } from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

  const [settings] = useSettingsPersistAtom();
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

  const { feeDecimals, feeSymbol, nativeSymbol, nativeTokenPrice } =
    customFee.common;

  const form = useForm({
    defaultValues: {
      gasLimit:
        customFee.gas?.gasLimit ?? customFee.gasEIP1559?.gasLimit ?? '0',
      // gas legacy
      gasPrice: customFee.gas?.gasPrice ?? '0',
      // gas eip1559
      priorityFee: customFee.gasEIP1559?.maxPriorityFeePerGas ?? '0',
      maxBaseFee: new BigNumber(customFee.gasEIP1559?.maxFeePerGas ?? '0')
        .minus(customFee.gasEIP1559?.maxPriorityFeePerGas ?? '0')
        .toFixed(),
      // fee utxo
      feeRate: customFee.feeUTXO?.feeRate ?? '0',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
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
        maxFeePerGas: new BigNumber(watchAllFields.maxBaseFee ?? '0')
          .plus(watchAllFields.priorityFee ?? '0')
          .toFixed(),
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
      watchAllFields.maxBaseFee,
      watchAllFields.priorityFee,
    ],
  );

  const handleValidateMaxBaseFee = useCallback(
    (value: string) => {
      if (
        new BigNumber(value ?? 0).isLessThan(
          customFee.gasEIP1559?.baseFeePerGas ?? '0',
        )
      )
        return 'Max base fee is low for current network conditions';
    },
    [customFee.gasEIP1559?.baseFeePerGas],
  );

  const handleApplyFeeInfo = useCallback(() => {}, []);

  const renderFeeTypeSelector = useCallback(
    () => (
      <SegmentControl
        fullWidth
        value={currentFeeIndex}
        onChange={(v) => {
          setCurrentFeeIndex(Number(v));
          setCurrentFeeType(feeSelectorItems[Number(v)].type);
        }}
        options={feeSelectorItems.map((item, index) => ({
          ...item,
          label: (
            <YStack>
              <SizableText
                color={currentFeeIndex === index ? '$text' : '$textSubdued'}
                size="$bodyMdMedium"
                textAlign="center"
              >
                {item.label}
              </SizableText>
              <NumberSizeableText
                color={currentFeeIndex === index ? '$text' : '$textSubdued'}
                size="$bodySm"
                textAlign="center"
                formatter="value"
              >
                {getFeePriceNumber({ feeInfo: item.feeInfo })}
              </NumberSizeableText>
            </YStack>
          ),
        }))}
      />
    ),
    [currentFeeIndex, feeSelectorItems],
  );

  const renderFeeEditorForm = useCallback(() => {
    if (currentFeeType !== EFeeType.Custom) return null;

    if (customFee.gasEIP1559) {
      return (
        <YStack space="$5">
          <Form.Field
            label="Max Base Fee"
            name="maxBaseFee"
            description={`Current: ${customFee.gasEIP1559.baseFeePerGas}${feeSymbol}`}
            rules={{
              required: true,
              validate: handleValidateMaxBaseFee,
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
  }, [currentFeeType, customFee, feeSymbol, handleValidateMaxBaseFee, intl]);

  const renderFeeOverview = useCallback(() => {
    let feeInfoItems: {
      label: string;
      nativeValue: string;
      fiatValue: string;
    }[] = [];

    const fee = (
      sendSelectedFee.feeType === EFeeType.Custom
        ? customFee
        : selectedFee?.feeInfo
    ) as IFeeInfoUnit;

    if (fee.gasEIP1559) {
      const limit =
        sendSelectedFee.feeType === EFeeType.Custom
          ? watchAllFields.gasLimit
          : fee.gasEIP1559.gasLimitForDisplay;
      const expectedFeeInNative = new BigNumber(watchAllFields.priorityFee || 0)
        .times(limit || 0)
        .shiftedBy(-feeDecimals);
      const maxFeeInNative = new BigNumber(watchAllFields.maxBaseFee || 0)
        .plus(watchAllFields.priorityFee || 0)
        .times(limit || 0)
        .shiftedBy(-feeDecimals);

      feeInfoItems = [
        {
          label: 'Expected Fee',
          nativeValue: expectedFeeInNative.toFixed(),
          fiatValue: expectedFeeInNative.times(nativeTokenPrice ?? 0).toFixed(),
        },
        {
          label: 'Max Fee',
          nativeValue: maxFeeInNative.toFixed(),
          fiatValue: maxFeeInNative.times(nativeTokenPrice ?? 0).toFixed(),
        },
      ];
    }

    return (
      <Stack space="$4" p="$5" pt="0">
        <YStack>
          {feeInfoItems.map((feeInfo, index) => (
            <XStack
              key={index}
              justifyContent="space-between"
              alignItems="center"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {feeInfo.label}
              </SizableText>
              <XStack alignItems="center" space="$1">
                <NumberSizeableText
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  {feeInfo.fiatValue}
                </NumberSizeableText>
                <NumberSizeableText
                  formatter="balance"
                  formatterOptions={{ tokenSymbol: nativeSymbol }}
                  size="$bodyMdMedium"
                >
                  {feeInfo.nativeValue}
                </NumberSizeableText>
              </XStack>
            </XStack>
          ))}
        </YStack>
        <Button variant="primary" size="medium" onPress={handleApplyFeeInfo}>
          {intl.formatMessage({ id: 'action__save' })}
        </Button>
      </Stack>
    );
  }, [
    customFee,
    feeDecimals,
    handleApplyFeeInfo,
    intl,
    nativeSymbol,
    nativeTokenPrice,
    selectedFee?.feeInfo,
    sendSelectedFee.feeType,
    settings.currencyInfo.symbol,
    watchAllFields.gasLimit,
    watchAllFields.maxBaseFee,
    watchAllFields.priorityFee,
  ]);

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
