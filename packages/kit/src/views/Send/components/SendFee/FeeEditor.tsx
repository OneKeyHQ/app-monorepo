import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN, isNil, isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Form,
  Input,
  NumberSizeableText,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  calculateSolTotalFee,
  calculateTotalFeeNative,
  getFeePriceNumber,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEstimateFeeParams,
  IFeeInfoUnit,
  IFeeSelectorItem,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import { EFeeType } from '@onekeyhq/shared/types/fee';

type IFeeInfoItem = {
  label: string;
  nativeValue?: string;
  nativeSymbol?: string;
  fiatValue?: string;
  customValue?: string;
  customSymbol?: string;
};

type IProps = {
  networkId: string;
  feeSelectorItems: IFeeSelectorItem[];
  sendSelectedFee: {
    feeType: EFeeType;
    presetIndex: number;
  };
  originalCustomFee: IFeeInfoUnit | undefined;
  selectedFee: ISendSelectedFeeInfo | undefined;
  unsignedTxs: IUnsignedTxPro[];
  estimateFeeParams?: IEstimateFeeParams;
  onApplyFeeInfo: ({
    feeType,
    presetIndex,
    customFeeInfo,
  }: {
    feeType: EFeeType;
    presetIndex: number;
    customFeeInfo: IFeeInfoUnit;
  }) => void;
};

const DEFAULT_GAS_LIMIT_MIN = 21000;
const DEFAULT_GAS_LIMIT_MAX = 15000000;

const getPresetIndex = (
  sendSelectedFee: IProps['sendSelectedFee'],
  feeSelectorItems: IProps['feeSelectorItems'],
) => {
  if (sendSelectedFee.feeType === EFeeType.Custom)
    return feeSelectorItems.length - 1;

  const feeSelectorItem = feeSelectorItems[sendSelectedFee.presetIndex];

  if (feeSelectorItem) {
    if (feeSelectorItem.type === EFeeType.Custom) {
      return feeSelectorItems.length - 1;
    }
    return sendSelectedFee.presetIndex;
  }

  return 0;
};

function FeeInfoItem({ feeInfo }: { feeInfo: IFeeInfoItem }) {
  const [settings] = useSettingsPersistAtom();
  const {
    label,
    fiatValue,
    nativeValue,
    nativeSymbol,
    customValue,
    customSymbol,
  } = feeInfo;

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <XStack alignItems="center" space="$1">
        {!isNil(fiatValue) ? (
          <NumberSizeableText
            formatter="value"
            formatterOptions={{
              currency: settings.currencyInfo.symbol,
            }}
            size="$bodyMd"
            color="$textSubdued"
          >
            {fiatValue}
          </NumberSizeableText>
        ) : null}
        {!isNil(nativeValue) ? (
          <NumberSizeableText
            formatter="balance"
            formatterOptions={{
              tokenSymbol: nativeSymbol,
            }}
            size="$bodyMdMedium"
          >
            {nativeValue}
          </NumberSizeableText>
        ) : null}
        {!isNil(customValue) ? (
          <NumberSizeableText
            formatter="balance"
            formatterOptions={{ tokenSymbol: customSymbol }}
            size="$bodyMdMedium"
          >
            {customValue}
          </NumberSizeableText>
        ) : null}
      </XStack>
    </XStack>
  );
}

function FeeEditor(props: IProps) {
  const {
    networkId,
    feeSelectorItems,
    sendSelectedFee,
    originalCustomFee,
    selectedFee,
    unsignedTxs,
    onApplyFeeInfo,
    estimateFeeParams,
  } = props;
  const intl = useIntl();
  const dialog = useDialogInstance();
  const isVerticalLayout = useMedia().md;

  const [currentFeeIndex, setCurrentFeeIndex] = useState(
    getPresetIndex(sendSelectedFee, feeSelectorItems),
  );

  const [currentFeeType, setCurrentFeeType] = useState<EFeeType>(
    sendSelectedFee.feeType,
  );
  const customFee = (originalCustomFee ?? selectedFee?.feeInfo) as IFeeInfoUnit;

  const { feeSymbol, feeDecimals, nativeSymbol, nativeTokenPrice } =
    customFee?.common ?? {};

  const [vaultSettings, network] =
    usePromiseResult(
      () =>
        Promise.all([
          backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
          backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        ]),
      [networkId],
    ).result ?? [];

  const form = useForm({
    defaultValues: {
      gasLimit: new BigNumber(
        customFee.gas?.gasLimit ?? customFee.gasEIP1559?.gasLimit ?? '0',
      ).toFixed(),
      // gas legacy
      gasPrice: new BigNumber(customFee.gas?.gasPrice ?? '0').toFixed(),
      // gas eip1559
      priorityFee: new BigNumber(
        customFee.gasEIP1559?.maxPriorityFeePerGas ?? '0',
      ).toFixed(),
      maxBaseFee: new BigNumber(customFee.gasEIP1559?.maxFeePerGas ?? '0')
        .minus(customFee.gasEIP1559?.maxPriorityFeePerGas ?? '0')
        .toFixed(),
      // fee utxo
      feeRate: new BigNumber(customFee.feeUTXO?.feeRate ?? '0').toFixed(),
      // fee sol
      computeUnitPrice: new BigNumber(
        customFee.feeSol?.computeUnitPrice ?? '0',
      ).toFixed(),
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

      feeSol: customFee.feeSol && {
        computeUnitPrice: watchAllFields.computeUnitPrice,
      },
    }),
    [
      customFee.common,
      customFee.feeSol,
      customFee.feeUTXO,
      customFee.gas,
      customFee.gasEIP1559,
      watchAllFields.computeUnitPrice,
      watchAllFields.feeRate,
      watchAllFields.gasLimit,
      watchAllFields.gasPrice,
      watchAllFields.maxBaseFee,
      watchAllFields.priorityFee,
    ],
  );

  const recommendPriorityFee = useMemo(() => {
    if (customFee.gasEIP1559) {
      const priorityFee = new BigNumber(
        customFee.gasEIP1559.maxPriorityFeePerGas ?? '0',
      );

      const maxFeeInfo = feeSelectorItems[0];
      const minFeeInfo = feeSelectorItems[feeSelectorItems.length - 1];
      const min = minFeeInfo.feeInfo.gasEIP1559?.maxPriorityFeePerGas ?? '0';
      const max = new BigNumber(
        maxFeeInfo.feeInfo.gasEIP1559?.maxPriorityFeePerGas ?? '0',
      )
        .times(100)
        .toFixed();

      return {
        min,
        max,
        priorityFee: priorityFee.toFixed(),
        description: `${intl.formatMessage({
          id: ETranslations.provider_recommend,
        })}: ${min} - ${max} ${feeSymbol}`,
      };
    }

    return {
      max: '',
      min: '',
      description: '',
    };
  }, [customFee.gasEIP1559, feeSelectorItems, feeSymbol, intl]);

  const recommendGasLimit = useMemo(() => {
    const feeInfo = feeSelectorItems[0].feeInfo;
    const gasLimit = new BigNumber(
      feeInfo.gasEIP1559?.gasLimit ?? feeInfo.gas?.gasLimit ?? '0',
    );
    const gasLimitForDisplay = new BigNumber(
      feeInfo.gasEIP1559?.gasLimitForDisplay ??
        feeInfo.gas?.gasLimitForDisplay ??
        '0',
    );

    return {
      gasLimit: gasLimit.toFixed(),
      description: `Estimate gas limit is ${gasLimit.toFixed()}, recommend ${
        gasLimitForDisplay.isEqualTo(gasLimit) ? '1.0x' : '1.2x'
      }`,
    };
  }, [feeSelectorItems]);

  const isSaveFeeDisabled = useMemo(() => {
    if (currentFeeType === EFeeType.Standard) return false;

    return !form.formState.isValid;
  }, [currentFeeType, form.formState.isValid]);

  const handleValidateMaxBaseFee = useCallback(
    (value: string) => {
      if (
        new BigNumber(value ?? 0).isLessThan(
          customFee.gasEIP1559?.baseFeePerGas ?? '0',
        )
      )
        return false;
    },
    [customFee.gasEIP1559?.baseFeePerGas],
  );

  const handleValidatePriorityFee = useCallback((value: string) => {
    const priorityFee = new BigNumber(value || 0);
    if (priorityFee.isNaN() || priorityFee.isLessThanOrEqualTo(0)) {
      return false;
    }
    return true;
  }, []);

  const handleValidateGasLimit = useCallback((value: string) => {
    const gasLimit = new BigNumber(value || 0);
    if (
      gasLimit.isNaN() ||
      gasLimit.isLessThan(DEFAULT_GAS_LIMIT_MIN) ||
      gasLimit.isGreaterThan(DEFAULT_GAS_LIMIT_MAX)
    ) {
      return `Gas limit must between ${DEFAULT_GAS_LIMIT_MIN} and ${DEFAULT_GAS_LIMIT_MAX}`;
    }
    return true;
  }, []);

  const handleValidateGasPrice = useCallback((value: string) => {
    const gasPrice = new BigNumber(value || 0);
    if (gasPrice.isNaN() || gasPrice.isLessThanOrEqualTo(0)) {
      return false;
    }
    return true;
  }, []);

  const handleValidateFeeRate = useCallback((value: string) => {
    const feeRate = new BigNumber(value || 0);
    if (feeRate.isNaN() || feeRate.isLessThanOrEqualTo(0)) {
      return false;
    }
    return true;
  }, []);

  const handleValidateComputeUnitPrice = useCallback((value: string) => {
    const feeRate = new BigNumber(value || 0);
    if (feeRate.isNaN() || feeRate.isLessThanOrEqualTo(0)) {
      return false;
    }
    return true;
  }, []);

  const handleApplyFeeInfo = useCallback(async () => {
    onApplyFeeInfo({
      feeType: currentFeeType,
      presetIndex: currentFeeIndex,
      customFeeInfo,
    });
    await dialog?.close();
  }, [currentFeeIndex, currentFeeType, customFeeInfo, dialog, onApplyFeeInfo]);

  const renderFeeTypeSelector = useCallback(() => {
    if (!vaultSettings?.editFeeEnabled) return null;

    let feeTitle = '';

    if (customFee.feeUTXO) {
      feeTitle = 'Fee Rate (sat/vB)';
    } else {
      feeTitle = intl.formatMessage(
        { id: ETranslations.content__gas_price },
        { 'network': feeSymbol },
      );
    }

    return (
      <>
        <SizableText mb={6} size="$bodyMdMedium">
          {feeTitle}
        </SizableText>
        <SegmentControl
          fullWidth
          value={currentFeeIndex}
          onChange={(v) => {
            const feeType = feeSelectorItems[Number(v)].type;
            setCurrentFeeIndex(Number(v));
            setCurrentFeeType(feeType);
          }}
          options={feeSelectorItems.map((item, index) => ({
            ...item,
            label: (
              <YStack>
                <SizableText size="$bodyMdMedium" textAlign="center">
                  {item.icon}
                </SizableText>
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
                  {item.type === EFeeType.Custom
                    ? intl.formatMessage({ id: ETranslations.content__custom })
                    : getFeePriceNumber({
                        feeInfo: item.feeInfo,
                      })}
                </NumberSizeableText>
              </YStack>
            ),
          }))}
        />
      </>
    );
  }, [
    currentFeeIndex,
    customFee.feeUTXO,
    feeSelectorItems,
    feeSymbol,
    intl,
    vaultSettings?.editFeeEnabled,
  ]);

  const handleFormValueOnChange = useCallback(
    ({
      name,
      value,
      decimals,
      intRequired,
    }: {
      name: string;
      value: string;
      decimals?: number;
      intRequired?: boolean;
    }) => {
      const filedName = name as keyof typeof watchAllFields;
      const valueBN = new BigNumber(value ?? 0);
      if (valueBN.isNaN()) {
        const formattedValue = parseFloat(value);
        form.setValue(
          filedName,
          isNaN(formattedValue) ? '' : String(formattedValue),
        );
        return;
      }
      if (isNumber(decimals)) {
        const dp = valueBN.decimalPlaces();
        if (dp && dp > decimals) {
          form.setValue(filedName, valueBN.toFixed(decimals));
          return;
        }
      }

      if (intRequired) {
        form.setValue(filedName, valueBN.toFixed(0));
      } else if (!value.includes('.')) {
        form.setValue(filedName, valueBN.toFixed());
      }
    },
    [form],
  );

  const renderFeeEditorForm = useCallback(() => {
    if (!vaultSettings?.editFeeEnabled) return null;
    if (currentFeeType !== EFeeType.Custom || !customFee) return null;

    if (customFee.gasEIP1559) {
      return (
        <Form form={form}>
          <YStack space="$5">
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.transaction_max_base_fee,
              })}
              name="maxBaseFee"
              description={`Current: ${customFee.gasEIP1559.baseFeePerGas} ${feeSymbol}`}
              rules={{
                required: true,
                min: 0,
                validate: handleValidateMaxBaseFee,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                    decimals: feeDecimals,
                  }),
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
                id: ETranslations.form__priority_fee,
              })}`}
              name="priorityFee"
              description={recommendPriorityFee.description}
              rules={{
                required: true,
                validate: handleValidatePriorityFee,
                min: 0,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                    decimals: feeDecimals,
                  }),
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
                id: ETranslations.content__gas_limit,
              })}
              name="gasLimit"
              description={recommendGasLimit.description}
              rules={{
                required: true,
                validate: handleValidateGasLimit,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                    intRequired: true,
                  }),
              }}
            >
              <Input
                flex={1}
                addOns={[
                  {
                    iconName: 'UndoOutline',
                    onPress: () => {
                      form.setValue('gasLimit', recommendGasLimit.gasLimit);
                      void form.trigger('gasLimit');
                    },
                  },
                ]}
              />
            </Form.Field>
          </YStack>
        </Form>
      );
    }

    if (customFee.gas) {
      return (
        <Form form={form}>
          <YStack space="$5">
            <Form.Field
              label={intl.formatMessage(
                {
                  id: ETranslations.content__gas_price,
                },
                {
                  'network': feeSymbol,
                },
              )}
              name="gasPrice"
              rules={{
                required: true,
                min: 0,
                validate: handleValidateGasPrice,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                    decimals: feeDecimals,
                  }),
              }}
            >
              <Input flex={1} />
            </Form.Field>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.content__gas_limit,
              })}
              name="gasLimit"
              description={recommendGasLimit.description}
              rules={{
                required: true,
                validate: handleValidateGasLimit,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                    intRequired: true,
                  }),
              }}
            >
              <Input
                flex={1}
                addOns={[
                  {
                    iconName: 'UndoOutline',
                    onPress: () => {
                      form.setValue('gasLimit', recommendGasLimit.gasLimit);
                      void form.trigger('gasLimit');
                    },
                  },
                ]}
              />
            </Form.Field>
          </YStack>
        </Form>
      );
    }

    if (customFee.feeUTXO) {
      return (
        <Form form={form}>
          <YStack space="$5">
            <Form.Field
              label={intl.formatMessage({
                id: 'form__fee_rate',
              })}
              name="feeRate"
              rules={{
                required: true,
                validate: handleValidateFeeRate,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                  }),
              }}
            >
              <Input flex={1} />
            </Form.Field>
          </YStack>
        </Form>
      );
    }

    if (customFee.feeSol) {
      return (
        <Form form={form}>
          <YStack space="$5">
            <Form.Field
              label="Prioritization Fee"
              name="computeUnitPrice"
              rules={{
                required: true,
                validate: handleValidateComputeUnitPrice,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                    intRequired: true,
                  }),
              }}
            >
              <Input flex={1} />
            </Form.Field>
          </YStack>
        </Form>
      );
    }
  }, [
    currentFeeType,
    customFee,
    feeDecimals,
    feeSymbol,
    form,
    handleFormValueOnChange,
    handleValidateComputeUnitPrice,
    handleValidateFeeRate,
    handleValidateGasLimit,
    handleValidateGasPrice,
    handleValidateMaxBaseFee,
    handleValidatePriorityFee,
    intl,
    recommendGasLimit.description,
    recommendGasLimit.gasLimit,
    recommendPriorityFee.description,
    vaultSettings?.editFeeEnabled,
  ]);

  const renderFeeOverview = useCallback(() => {
    let feeInfoItems: IFeeInfoItem[] = [];

    const fee =
      currentFeeType === EFeeType.Custom
        ? customFee
        : feeSelectorItems[currentFeeIndex].feeInfo;

    if (fee.gasEIP1559) {
      let limit = new BigNumber(0);
      let priorityFee = new BigNumber(0);
      let maxFee = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        limit = new BigNumber(watchAllFields.gasLimit || 0);
        priorityFee = new BigNumber(watchAllFields.priorityFee || 0);
        maxFee = new BigNumber(watchAllFields.maxBaseFee || 0).plus(
          watchAllFields.priorityFee || 0,
        );
      } else {
        limit = new BigNumber(fee.gasEIP1559.gasLimitForDisplay);
        priorityFee = new BigNumber(fee.gasEIP1559.maxPriorityFeePerGas);
        maxFee = new BigNumber(fee.gasEIP1559.maxFeePerGas);
      }
      const expectedFeeInNative = calculateTotalFeeNative({
        amount: priorityFee
          .plus(fee.gasEIP1559.baseFeePerGas || 0)
          .times(limit || 0),
        feeInfo: fee,
      });
      const maxFeeInNative = calculateTotalFeeNative({
        amount: maxFee.times(limit || 0),
        feeInfo: fee,
      });

      feeInfoItems = [
        vaultSettings?.withL1BaseFee &&
        new BigNumber(fee.common.baseFee ?? 0).gt(0)
          ? {
              label: 'L1 Base Fee',
              customValue: fee.common.baseFee,
              customSymbol: feeSymbol,
            }
          : null,
        {
          label: 'Expected Fee',
          nativeValue: expectedFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(expectedFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
        {
          label: 'Max Fee',
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ].filter(Boolean) as IFeeInfoItem[];
    } else if (fee.gas) {
      let limit = new BigNumber(0);
      let gasPrice = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        limit = new BigNumber(watchAllFields.gasLimit || 0);
        gasPrice = new BigNumber(watchAllFields.gasPrice || 0);
      } else {
        limit = new BigNumber(fee.gas.gasLimitForDisplay || 0);
        gasPrice = new BigNumber(fee.gas.gasPrice || 0);
      }

      const maxFeeInNative = calculateTotalFeeNative({
        amount: gasPrice.times(limit),
        feeInfo: fee,
      });

      feeInfoItems = [
        vaultSettings?.withL1BaseFee &&
        new BigNumber(fee.common.baseFee ?? 0).gt(0)
          ? {
              label: 'L1 Base Fee',
              customValue: fee.common.baseFee,
              customSymbol: feeSymbol,
            }
          : null,
        {
          label: 'Max Fee',
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ].filter(Boolean) as IFeeInfoItem[];
    } else if (fee.feeUTXO) {
      let feeRate = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        feeRate = new BigNumber(watchAllFields.feeRate || 0);
      } else {
        feeRate = new BigNumber(fee.feeUTXO.feeRate || 0);
      }

      const feeInNative = calculateTotalFeeNative({
        amount: feeRate.times(unsignedTxs[0]?.txSize || 0),
        feeInfo: fee,
      });

      feeInfoItems = [
        {
          label: 'VSize',
          customValue: unsignedTxs[0]?.txSize?.toFixed() ?? '0',
          customSymbol: 'vB',
        },
        {
          label: 'Fee',
          nativeValue: feeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(feeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    } else if (fee.feeTron) {
      const maxFeeInNative = calculateTotalFeeNative({
        amount: '0',
        feeInfo: fee,
      });
      feeInfoItems = [
        {
          label: 'TRX Consumed',
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    } else if (fee.feeSol && estimateFeeParams?.estimateFeeParamsSol) {
      let computeUnitPrice = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        computeUnitPrice = new BigNumber(watchAllFields.computeUnitPrice || 0);
      } else {
        computeUnitPrice = new BigNumber(fee.feeSol?.computeUnitPrice || 0);
      }

      const { computeUnitLimit, baseFee, computeUnitPriceDecimals } =
        estimateFeeParams.estimateFeeParamsSol;
      const max = calculateSolTotalFee({
        computeUnitPrice,
        computeUnitLimit,
        baseFee,
        computeUnitPriceDecimals,
        feeInfo: fee,
      });

      const maxFeeInNative = calculateTotalFeeNative({
        amount: max,
        feeInfo: fee,
        withoutBaseFee: true,
      });

      feeInfoItems = [
        {
          label: 'Fee',
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    }

    return (
      <Stack space="$4" p="$5" pt="0">
        <YStack>
          {feeInfoItems.map((feeInfo, index) => (
            <FeeInfoItem feeInfo={feeInfo} key={index} />
          ))}
        </YStack>
        {vaultSettings?.editFeeEnabled ? (
          <Button
            disabled={isSaveFeeDisabled}
            variant="primary"
            size="medium"
            onPress={handleApplyFeeInfo}
          >
            {intl.formatMessage({ id: ETranslations.action_save })}
          </Button>
        ) : null}
      </Stack>
    );
  }, [
    currentFeeIndex,
    currentFeeType,
    customFee,
    estimateFeeParams?.estimateFeeParamsSol,
    feeSelectorItems,
    feeSymbol,
    handleApplyFeeInfo,
    intl,
    isSaveFeeDisabled,
    nativeSymbol,
    nativeTokenPrice,
    unsignedTxs,
    vaultSettings?.editFeeEnabled,
    vaultSettings?.withL1BaseFee,
    watchAllFields.computeUnitPrice,
    watchAllFields.feeRate,
    watchAllFields.gasLimit,
    watchAllFields.gasPrice,
    watchAllFields.maxBaseFee,
    watchAllFields.priorityFee,
  ]);

  const renderFeeDetails = useCallback(() => {
    if (!vaultSettings?.checkFeeDetailEnabled) return null;
    const feeInfoItems: IFeeInfoItem[] = [];

    const fee =
      currentFeeType === EFeeType.Custom
        ? customFee
        : feeSelectorItems[currentFeeIndex].feeInfo;
    if (fee.feeTron) {
      if (fee.feeTron.requiredBandwidth) {
        feeInfoItems.push({
          label: 'Bandwidth Consumed',
          customValue: String(fee.feeTron.requiredBandwidth),
          customSymbol: 'Bandwidth',
        });
      }

      if (fee.feeTron.requiredEnergy) {
        feeInfoItems.push({
          label: 'Energy Consumed',
          customValue: String(fee.feeTron.requiredEnergy),
          customSymbol: 'Energy',
        });
      }
    }

    return (
      <YStack space="$4">
        {feeInfoItems.map((feeInfo, index) => (
          <FeeInfoItem feeInfo={feeInfo} key={index} />
        ))}
      </YStack>
    );
  }, [
    currentFeeIndex,
    currentFeeType,
    customFee,
    feeSelectorItems,
    vaultSettings?.checkFeeDetailEnabled,
  ]);

  return (
    <YStack space="$4">
      <YStack space="$4" px="$5" paddingTop={isVerticalLayout ? 0 : '$4'}>
        {renderFeeTypeSelector()}
        {renderFeeDetails()}
        {renderFeeEditorForm()}
      </YStack>
      <Divider />
      {renderFeeOverview()}
    </YStack>
  );
}

export { FeeEditor };
