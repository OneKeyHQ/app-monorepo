import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
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
  useMedia,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  calculateTotalFeeNative,
  getFeePriceNumber,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
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
  setIsEditFeeActive: React.Dispatch<React.SetStateAction<boolean>>;
  sendSelectedFee: {
    feeType: EFeeType;
    presetIndex: number;
  };
  originalCustomFee: IFeeInfoUnit | undefined;
  selectedFee: ISendSelectedFeeInfo | undefined;
  unsignedTxs: IUnsignedTxPro[];
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
    setIsEditFeeActive,
    sendSelectedFee,
    originalCustomFee,
    selectedFee,
    unsignedTxs,
    onApplyFeeInfo,
  } = props;
  const intl = useIntl();
  const isVerticalLayout = useMedia().md;

  const [currentFeeIndex, setCurrentFeeIndex] = useState(
    getPresetIndex(sendSelectedFee, feeSelectorItems),
  );
  const [customTouched, setCustomTouched] = useState(false);
  const [currentFeeType, setCurrentFeeType] = useState<EFeeType>(
    sendSelectedFee.feeType,
  );
  const customFee = (originalCustomFee ?? selectedFee?.feeInfo) as IFeeInfoUnit;

  const { feeSymbol, nativeSymbol, nativeTokenPrice } = customFee.common;

  const vaultSettings = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  ).result;

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

  const gasLimitDescription = useMemo(() => {
    const feeInfo = feeSelectorItems[0].feeInfo;
    const gasLimit = new BigNumber(
      feeInfo.gasEIP1559?.gasLimit ?? feeInfo.gas?.gasLimit ?? '0',
    );
    const gasLimitForDisplay = new BigNumber(
      feeInfo.gasEIP1559?.gasLimitForDisplay ?? feeInfo.gas?.gasLimit ?? '0',
    );

    return `Estimate gas limit is ${gasLimitForDisplay.toFixed()}, recommend ${
      gasLimitForDisplay.isEqualTo(gasLimit) ? '1.0x' : '1.2x'
    }`;
  }, [feeSelectorItems]);

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

  const handleValidatePriorityFee = useCallback((value: string) => {
    const priorityFee = new BigNumber(value || 0);
    if (priorityFee.isNaN() || priorityFee.isLessThan(0)) {
      return 'Priority fee must be greater than 0';
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
    if (gasPrice.isNaN() || gasPrice.isLessThan(0)) {
      return 'Gas price must be greater than 0';
    }
    return true;
  }, []);

  const handleValidateFeeRate = useCallback((value: string) => {
    const feeRate = new BigNumber(value || 0);
    if (feeRate.isNaN() || feeRate.isLessThan(0)) {
      return 'Fee rate must be greater than 0';
    }
    return true;
  }, []);

  const handleApplyFeeInfo = useCallback(() => {
    onApplyFeeInfo({
      feeType: currentFeeType,
      presetIndex: currentFeeIndex,
      customFeeInfo,
    });
    setIsEditFeeActive(false);
  }, [
    currentFeeIndex,
    currentFeeType,
    customFeeInfo,
    onApplyFeeInfo,
    setIsEditFeeActive,
  ]);

  const renderFeeTypeSelector = useCallback(() => {
    if (!vaultSettings?.editFeeEnabled) return null;

    let feeTitle = '';

    if (customFee.feeUTXO) {
      feeTitle = 'Fee Rate (sat/vB)';
    } else {
      feeTitle = `Gas Price (${feeSymbol})`;
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
            if (feeType === EFeeType.Custom) {
              setCustomTouched(true);
            }
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
                  {getFeePriceNumber({ feeInfo: item.feeInfo }) ||
                    (customTouched
                      ? getFeePriceNumber({ feeInfo: customFeeInfo })
                      : '-')}
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
    customFeeInfo,
    customTouched,
    feeSelectorItems,
    feeSymbol,
    vaultSettings?.editFeeEnabled,
  ]);

  const renderFeeEditorForm = useCallback(() => {
    if (!vaultSettings?.editFeeEnabled) return null;
    if (currentFeeType !== EFeeType.Custom) return null;

    if (customFee.gasEIP1559) {
      const originalLimit = customFee.gasEIP1559.gasLimit;
      return (
        <Form form={form}>
          <YStack space="$5">
            <Form.Field
              label="Max Base Fee"
              name="maxBaseFee"
              description={`Current: ${customFee.gasEIP1559.baseFeePerGas} ${feeSymbol}`}
              rules={{
                required: true,
                min: 0,
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
                validate: handleValidatePriorityFee,
                min: 0,
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
              description={gasLimitDescription}
              rules={{
                required: true,
                validate: handleValidateGasLimit,
              }}
            >
              <Input
                flex={1}
                addOns={[
                  {
                    iconName: 'UndoOutline',
                    onPress: () => {
                      form.setValue('gasLimit', originalLimit);
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
      const originalLimit = customFee.gas.gasLimit;
      return (
        <Form form={form}>
          <YStack space="$5">
            <Form.Field
              label={`${intl.formatMessage({
                id: 'content__gas_price',
              })}(${feeSymbol})`}
              name="gasPrice"
              rules={{
                required: true,
                min: 0,
                validate: handleValidateGasPrice,
              }}
            >
              <Input flex={1} />
            </Form.Field>
            <Form.Field
              label={intl.formatMessage({
                id: 'content__gas_limit',
              })}
              name="gasLimit"
              description={gasLimitDescription}
              rules={{
                required: true,
                validate: handleValidateGasLimit,
              }}
            >
              <Input
                flex={1}
                addOns={[
                  {
                    iconName: 'UndoOutline',
                    onPress: () => {
                      form.setValue('gasLimit', originalLimit);
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
    customFee.feeUTXO,
    customFee.gas,
    customFee.gasEIP1559,
    feeSymbol,
    form,
    gasLimitDescription,
    handleValidateFeeRate,
    handleValidateGasLimit,
    handleValidateGasPrice,
    handleValidateMaxBaseFee,
    handleValidatePriorityFee,
    intl,
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
      ];
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
        {
          label: 'Max Fee',
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
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
    }

    return (
      <Stack space="$4" p="$5" pt="0">
        <YStack>
          {feeInfoItems.map((feeInfo, index) => (
            <FeeInfoItem feeInfo={feeInfo} key={index} />
          ))}
        </YStack>
        {vaultSettings?.editFeeEnabled ? (
          <Button variant="primary" size="medium" onPress={handleApplyFeeInfo}>
            {intl.formatMessage({ id: 'action__save' })}
          </Button>
        ) : null}
      </Stack>
    );
  }, [
    currentFeeIndex,
    currentFeeType,
    customFee,
    feeSelectorItems,
    handleApplyFeeInfo,
    intl,
    nativeSymbol,
    nativeTokenPrice,
    unsignedTxs,
    vaultSettings?.editFeeEnabled,
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
