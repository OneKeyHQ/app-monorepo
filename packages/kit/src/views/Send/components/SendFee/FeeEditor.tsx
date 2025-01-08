import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Form,
  Input,
  NumberSizeableText,
  ScrollView,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
  useForm,
} from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  calculateCkbTotalFee,
  calculateSolTotalFee,
  calculateSuiTotalFee,
  calculateTotalFeeNative,
} from '@onekeyhq/kit/src/utils/gasFee';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ALGO_TX_MIN_FEE } from '@onekeyhq/kit-bg/src/vaults/impls/algo/utils';
import { REPLACE_TX_FEE_UP_RATIO } from '@onekeyhq/shared/src/consts/walletConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
  replaceTxMode?: boolean;
  replaceTxOriginalFeeInfo?: IFeeInfoUnit;
};

const DEFAULT_GAS_LIMIT_MIN = 21_000;
const DEFAULT_GAS_LIMIT_MAX = 15_000_000;
const DEFAULT_FEER_ATE_MIN = 0;
const DEFAULT_FEE_RATE_MAX = 1_000_000; // shared cross multi-networks

// TODO: 最好提取至settings.ts
const BENFEN_MIN_GAS_PRICE = 0.000_000_1;
const BENFEN_MIN_GAS_BUDGET = 100_000;

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

function FeeInfoItem({
  feeInfo,
  ...rest
}: { feeInfo: IFeeInfoItem } & IXStackProps) {
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
    <XStack justifyContent="space-between" alignItems="center" {...rest}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <XStack alignItems="center" gap="$1">
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
      </XStack>
    </XStack>
  );
}

function FeeEditor(props: IProps) {
  const {
    networkId,
    feeSelectorItems: feeSelectorItemsProp,
    sendSelectedFee,
    originalCustomFee,
    selectedFee,
    unsignedTxs,
    onApplyFeeInfo,
    estimateFeeParams,
    replaceTxMode,
    replaceTxOriginalFeeInfo,
  } = props;
  const intl = useIntl();
  const dialog = useDialogInstance();

  const isMultiTxs = unsignedTxs.length > 1;

  const [feeSelectorItems, setFeeSelectorItems] =
    useState<IFeeSelectorItem[]>(feeSelectorItemsProp);

  const [currentFeeIndex, setCurrentFeeIndex] = useState(
    getPresetIndex(sendSelectedFee, feeSelectorItemsProp),
  );

  const [feeAlert, setFeeAlert] = useState('');
  const [priorityFeeAlert, setPriorityFeeAlert] = useState('');

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

  const originalMaxBaseFee = new BigNumber(
    customFee?.gasEIP1559?.maxFeePerGas ?? '0',
  ).minus(customFee?.gasEIP1559?.maxPriorityFeePerGas ?? '0');

  const algoMinFee = new BigNumber(
    customFee?.feeAlgo?.minFee ?? ALGO_TX_MIN_FEE,
  ).toFixed();

  const form = useForm({
    defaultValues: {
      gasLimit: new BigNumber(
        customFee?.gas?.gasLimit ?? customFee?.gasEIP1559?.gasLimit ?? '0',
      ).toFixed(),
      // gas legacy
      gasPrice: new BigNumber(customFee?.gas?.gasPrice ?? '0').toFixed(),
      // gas eip1559
      priorityFee: new BigNumber(
        customFee?.gasEIP1559?.maxPriorityFeePerGas ?? '0',
      ).toFixed(),
      maxBaseFee: originalMaxBaseFee.isGreaterThan(0)
        ? originalMaxBaseFee.toFixed()
        : customFee?.gasEIP1559?.baseFeePerGas ?? '0',
      // fee utxo
      feeRate: new BigNumber(customFee?.feeUTXO?.feeRate ?? '0').toFixed(),
      // fee sol
      computeUnitPrice: new BigNumber(
        customFee?.feeSol?.computeUnitPrice ?? '0',
      ).toFixed(),
      // fee ckb
      feeRateCkb: new BigNumber(customFee?.feeCkb?.feeRate ?? '0').toFixed(),

      // fee algo
      flatFee: BigNumber.max(
        customFee?.feeAlgo?.baseFee ?? '0',
        algoMinFee,
      ).toFixed(),

      // fee dot
      dotExtraTip: new BigNumber(
        customFee?.feeDot?.extraTipInDot ?? '0',
      ).toFixed(),

      // fee sui
      gasSuiPrice: customFee?.feeBudget?.gasPrice ?? '0',
      gasSuiBudget: customFee?.feeBudget?.budget ?? '0',
      computationCostBase: customFee?.feeBudget?.computationCostBase ?? '0',
      storageCost: customFee?.feeBudget?.storageCost ?? '0',
      storageRebate: customFee?.feeBudget?.storageRebate ?? '0',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const watchAllFields = form.watch();

  const customFeeInfo = useMemo(
    () => ({
      common: customFee?.common,
      gas: customFee?.gas && {
        gasPrice: watchAllFields.gasPrice,
        gasLimit: watchAllFields.gasLimit,
        gasLimitForDisplay: watchAllFields.gasLimit,
      },
      gasEIP1559: customFee?.gasEIP1559 && {
        baseFeePerGas: customFee?.gasEIP1559?.baseFeePerGas ?? '0',
        maxPriorityFeePerGas: watchAllFields.priorityFee,
        maxFeePerGas: new BigNumber(watchAllFields.maxBaseFee ?? '0')
          .plus(watchAllFields.priorityFee ?? '0')
          .toFixed(),
        gasLimit: watchAllFields.gasLimit,
        gasLimitForDisplay: watchAllFields.gasLimit,
      },
      feeUTXO: customFee?.feeUTXO && {
        feeRate: watchAllFields.feeRate,
      },

      feeSol: customFee?.feeSol && {
        computeUnitPrice: watchAllFields.computeUnitPrice,
      },
      feeCkb: customFee?.feeCkb && {
        feeRate: watchAllFields.feeRateCkb,
      },

      feeAlgo: customFee?.feeAlgo && {
        baseFee: watchAllFields.flatFee,
        minFee: algoMinFee,
      },

      feeDot: customFee?.feeDot && {
        extraTipInDot: watchAllFields.dotExtraTip,
      },

      feeBudget: customFee?.feeBudget && {
        gasPrice: watchAllFields.gasSuiPrice,
        budget: watchAllFields.gasSuiBudget,
        computationCostBase: watchAllFields.computationCostBase,
        storageCost: watchAllFields.storageCost,
        storageRebate: watchAllFields.storageRebate,
      },
    }),
    [
      algoMinFee,
      customFee?.common,
      customFee?.feeAlgo,
      customFee?.feeCkb,
      customFee?.feeSol,
      customFee?.feeUTXO,
      customFee?.gas,
      customFee?.gasEIP1559,
      customFee?.feeDot,
      customFee?.feeBudget,
      watchAllFields.computeUnitPrice,
      watchAllFields.feeRate,
      watchAllFields.feeRateCkb,
      watchAllFields.flatFee,
      watchAllFields.gasLimit,
      watchAllFields.gasPrice,
      watchAllFields.maxBaseFee,
      watchAllFields.priorityFee,
      watchAllFields.dotExtraTip,
      watchAllFields.gasSuiPrice,
      watchAllFields.gasSuiBudget,
      watchAllFields.computationCostBase,
      watchAllFields.storageCost,
      watchAllFields.storageRebate,
    ],
  );

  const recommendPriorityFee = useMemo(() => {
    if (customFee?.gasEIP1559) {
      const priorityFee = new BigNumber(
        customFee?.gasEIP1559.maxPriorityFeePerGas ?? '0',
      );

      const minFeeInfo = feeSelectorItems[0];
      let maxFeeInfo = feeSelectorItems[feeSelectorItems.length - 1];

      if (maxFeeInfo?.type === EFeeType.Custom) {
        maxFeeInfo = feeSelectorItems[feeSelectorItems.length - 2];
        maxFeeInfo = maxFeeInfo || minFeeInfo;
      }

      const min = minFeeInfo?.feeInfo?.gasEIP1559?.maxPriorityFeePerGas ?? '0';
      const max = new BigNumber(
        maxFeeInfo?.feeInfo?.gasEIP1559?.maxPriorityFeePerGas ?? '0',
      )
        .times(100)
        .toFixed();

      return {
        min,
        max,
        priorityFee: priorityFee.toFixed(),
        description: `${intl.formatMessage({
          id: ETranslations.global_recommend,
        })}: ${min} - ${max} ${feeSymbol}`,
      };
    }

    return {
      max: '',
      min: '',
      description: '',
    };
  }, [customFee?.gasEIP1559, feeSelectorItems, feeSymbol, intl]);

  const recommendGasLimit = useMemo(() => {
    const feeInfo = feeSelectorItems[0]?.feeInfo ?? {};
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
      // description: `Estimate gas limit is ${gasLimit.toFixed()}, recommend ${
      //   gasLimitForDisplay.isEqualTo(gasLimit) ? '1.0x' : '1.2x'
      // }`,
    };
  }, [feeSelectorItems]);

  const isSaveFeeDisabled = useMemo(() => {
    if (currentFeeType === EFeeType.Standard) return false;

    return !form.formState.isValid;
  }, [currentFeeType, form.formState.isValid]);

  const handleValidateMaxBaseFee = useCallback(
    (value: string) => {
      const maxBaseFee = new BigNumber(value || 0);

      if (replaceTxMode && replaceTxOriginalFeeInfo?.gasEIP1559) {
        const minReplaceTxBaseFeePerGas = new BigNumber(
          replaceTxOriginalFeeInfo.gasEIP1559.baseFeePerGas,
        )
          .times(REPLACE_TX_FEE_UP_RATIO)
          .toFixed();
        if (maxBaseFee.isLessThan(minReplaceTxBaseFeePerGas)) {
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: minReplaceTxBaseFeePerGas,
            },
          );
        }
      } else {
        if (maxBaseFee.isNaN() || maxBaseFee.isLessThanOrEqualTo(0)) {
          setFeeAlert('');
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: 0,
            },
          );
        }

        const recommendMaxFee = feeSelectorItems
          .filter((item) => item.type === EFeeType.Standard)
          .map((item) => item?.feeInfo?.gasEIP1559?.maxFeePerGas ?? '0')
          .filter((item) => item !== '0');

        const recommendMaxFeeMax = BigNumber.max(...recommendMaxFee);

        if (maxBaseFee.isLessThan(customFee?.gasEIP1559?.baseFeePerGas ?? 0)) {
          setFeeAlert(
            intl.formatMessage({
              id: ETranslations.max_base_fee_lower_then_base_fee_alert_message,
            }),
          );
        } else if (maxBaseFee.isGreaterThan(recommendMaxFeeMax)) {
          setFeeAlert(
            intl.formatMessage(
              {
                id: ETranslations.fee_fee_rate_too_high,
              },
              {
                something: intl.formatMessage({
                  id: ETranslations.transaction_max_base_fee,
                }),
              },
            ),
          );
        } else {
          setFeeAlert('');
        }
      }

      return true;
    },
    [
      replaceTxMode,
      replaceTxOriginalFeeInfo?.gasEIP1559,
      intl,
      feeSelectorItems,
      customFee?.gasEIP1559?.baseFeePerGas,
    ],
  );

  const handleValidatePriorityFee = useCallback(
    (value: string) => {
      const priorityFee = new BigNumber(value || 0);

      if (replaceTxMode && replaceTxOriginalFeeInfo?.gasEIP1559) {
        const minReplaceTxMaxPriorityFeePerGas = new BigNumber(
          replaceTxOriginalFeeInfo.gasEIP1559.maxPriorityFeePerGas,
        )
          .times(REPLACE_TX_FEE_UP_RATIO)
          .toFixed();
        if (priorityFee.isLessThan(minReplaceTxMaxPriorityFeePerGas)) {
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: minReplaceTxMaxPriorityFeePerGas,
            },
          );
        }
      } else {
        if (priorityFee.isNaN() || priorityFee.isLessThanOrEqualTo(0)) {
          setPriorityFeeAlert('');
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: 0,
            },
          );
        }

        if (priorityFee.isGreaterThan(recommendPriorityFee.max)) {
          setPriorityFeeAlert(
            intl.formatMessage(
              {
                id: ETranslations.form_global_error_something_higher_then_necessary,
              },
              {
                something: intl.formatMessage({
                  id: ETranslations.form__priority_fee,
                }),
              },
            ),
          );
        } else if (priorityFee.isLessThan(recommendPriorityFee.min)) {
          setPriorityFeeAlert(
            intl.formatMessage(
              {
                id: ETranslations.fee_fee_rate_too_low,
              },
              {
                'feeParam': intl.formatMessage({
                  id: ETranslations.form__priority_fee,
                }),
              },
            ),
          );
        } else {
          setPriorityFeeAlert('');
        }
      }

      return true;
    },
    [
      intl,
      recommendPriorityFee.max,
      recommendPriorityFee.min,
      replaceTxMode,
      replaceTxOriginalFeeInfo?.gasEIP1559,
    ],
  );

  const handleValidateGasLimit = useCallback(
    (value: string) => {
      const gasLimit = new BigNumber(value || 0);

      if (vaultSettings?.gasLimitValidationEnabled) {
        if (gasLimit.isNaN() || gasLimit.isLessThan(DEFAULT_GAS_LIMIT_MIN)) {
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: DEFAULT_GAS_LIMIT_MIN,
            },
          );
        }
      } else if (gasLimit.isNaN() || gasLimit.isLessThanOrEqualTo(0)) {
        return intl.formatMessage(
          { id: ETranslations.form_must_greater_then_value },
          {
            value: 0,
          },
        );
      }

      return true;
    },
    [intl, vaultSettings?.gasLimitValidationEnabled],
  );

  const handleValidateGasPrice = useCallback(
    (value: string) => {
      const gasPrice = new BigNumber(value || 0);

      if (replaceTxMode && replaceTxOriginalFeeInfo?.gas) {
        const minReplaceTxGasPrice = new BigNumber(
          replaceTxOriginalFeeInfo.gas.gasPrice,
        )
          .times(REPLACE_TX_FEE_UP_RATIO)
          .toFixed();
        if (gasPrice.isLessThan(minReplaceTxGasPrice)) {
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: minReplaceTxGasPrice,
            },
          );
        }
      } else {
        const recommendGasPrice = feeSelectorItems
          .filter((item) => item.type === EFeeType.Standard)
          .map((item) => item?.feeInfo?.gas?.gasPrice ?? '0')
          .filter((item) => item !== '0');

        const recommendGasPriceMax = BigNumber.max(...recommendGasPrice);
        const recommendGasPriceMin = BigNumber.min(...recommendGasPrice);

        if (gasPrice.isNaN() || gasPrice.isLessThanOrEqualTo(0)) {
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: 0,
            },
          );
        }

        if (gasPrice.isLessThan(recommendGasPriceMin)) {
          setFeeAlert(
            intl.formatMessage(
              {
                id: ETranslations.fee_fee_rate_too_low,
              },
              {
                'feeParam': intl.formatMessage({
                  id: ETranslations.global_gas_price,
                }),
              },
            ),
          );
        } else if (gasPrice.isGreaterThan(recommendGasPriceMax)) {
          setFeeAlert(
            intl.formatMessage(
              {
                id: ETranslations.form_global_error_something_higher_then_necessary,
              },
              {
                something: intl.formatMessage({
                  id: ETranslations.global_gas_price,
                }),
              },
            ),
          );
        } else {
          setFeeAlert('');
        }
      }

      return true;
    },
    [feeSelectorItems, intl, replaceTxMode, replaceTxOriginalFeeInfo?.gas],
  );

  const handleValidateFeeRate = useCallback(
    (value: string) => {
      const feeRate = new BigNumber(value || 0);
      if (
        feeRate.isNaN() ||
        feeRate.isLessThanOrEqualTo(DEFAULT_FEER_ATE_MIN) ||
        feeRate.isGreaterThan(DEFAULT_FEE_RATE_MAX)
      ) {
        return intl.formatMessage(
          { id: ETranslations.form_ree_rate_error_out_of_range },
          { min: DEFAULT_FEER_ATE_MIN, max: DEFAULT_FEE_RATE_MAX },
        );
      }

      const recommendFeeRate = feeSelectorItems
        .filter((item) => item.type === EFeeType.Standard)
        .map((item) => item?.feeInfo.feeUTXO?.feeRate ?? '0')
        .filter((item) => item !== '0');

      const recommendFeeRateMax = BigNumber.max(...recommendFeeRate);
      const recommendFeeRateMin = BigNumber.min(...recommendFeeRate);

      if (feeRate.isLessThan(recommendFeeRateMin)) {
        setFeeAlert(
          intl.formatMessage(
            {
              id: ETranslations.fee_fee_rate_too_low,
            },
            {
              'feeParam': intl.formatMessage({
                id: ETranslations.fee_fee_rate,
              }),
            },
          ),
        );
      } else if (
        feeRate.isGreaterThan(new BigNumber(recommendFeeRateMax).times(100))
      ) {
        setFeeAlert(
          intl.formatMessage(
            {
              id: ETranslations.fee_fee_rate_too_high,
            },
            {
              'something': intl.formatMessage({
                id: ETranslations.fee_fee_rate,
              }),
            },
          ),
        );
      } else {
        setFeeAlert('');
      }
      return true;
    },
    [feeSelectorItems, intl],
  );

  const handleValidateSuiGasBudget = useCallback(
    (value: string) => {
      const gasLimit = new BigNumber(value || 0);
      if (vaultSettings?.gasLimitValidationEnabled) {
        if (gasLimit.isNaN() || gasLimit.isLessThan(BENFEN_MIN_GAS_BUDGET)) {
          return intl.formatMessage(
            { id: ETranslations.form_must_greater_then_value },
            {
              value: BENFEN_MIN_GAS_BUDGET,
            },
          );
        }
      } else if (gasLimit.isNaN() || gasLimit.isLessThanOrEqualTo(0)) {
        return intl.formatMessage(
          { id: ETranslations.form_must_greater_then_value },
          {
            value: 0,
          },
        );
      }

      return true;
    },
    [intl, vaultSettings?.gasLimitValidationEnabled],
  );

  const handleValidateSuiGasPrice = useCallback(
    (value: string) => {
      const gasPrice = new BigNumber(value || 0);

      if (gasPrice.isNaN() || gasPrice.isLessThan(BENFEN_MIN_GAS_PRICE)) {
        return intl.formatMessage(
          { id: ETranslations.form_must_greater_then_value },
          {
            value: BENFEN_MIN_GAS_PRICE,
          },
        );
      }

      return true;
    },
    [intl],
  );

  const handleValidateComputeUnitPrice = useCallback((value: string) => {
    const feeRate = new BigNumber(value || 0);
    if (feeRate.isNaN() || feeRate.isLessThanOrEqualTo(0)) {
      return false;
    }
    return true;
  }, []);

  const handleValidateFeeRateCkb = useCallback((value: string) => {
    const feeRate = new BigNumber(value || 0);
    if (feeRate.isNaN() || feeRate.isLessThanOrEqualTo(0)) {
      return false;
    }
    return true;
  }, []);

  const handleValidateFlatFee = useCallback(
    (value: string) => {
      const flatFee = new BigNumber(value || 0);
      if (flatFee.isNaN() || flatFee.isLessThanOrEqualTo(0)) {
        return false;
      }

      if (flatFee.isLessThan(algoMinFee)) {
        return intl.formatMessage(
          { id: ETranslations.form_must_greater_then_value },
          {
            value: ALGO_TX_MIN_FEE,
          },
        );
      }

      return true;
    },
    [algoMinFee, intl],
  );

  const handleApplyFeeInfo = useCallback(async () => {
    onApplyFeeInfo({
      feeType: currentFeeType,
      presetIndex: currentFeeIndex,
      customFeeInfo,
    });
    await dialog?.close();
  }, [currentFeeIndex, currentFeeType, customFeeInfo, dialog, onApplyFeeInfo]);

  const renderFeeTypeSelector = useCallback(() => {
    if (replaceTxMode) return null;
    if (!vaultSettings?.editFeeEnabled) return null;

    let feeTitle = '';

    if (customFee?.feeUTXO) {
      feeTitle = `${intl.formatMessage({
        id: ETranslations.fee_fee_rate,
      })} (sat/vB)`;
    } else {
      feeTitle = intl.formatMessage(
        { id: ETranslations.content__gas_price },
        { 'network': feeSymbol },
      );
    }

    return (
      <>
        {/* <SizableText mb={6} size="$bodyMdMedium">
          {feeTitle}
        </SizableText> */}
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
                {/* <SizableText size="$bodyMdMedium" textAlign="center">
                  {item.icon}
                </SizableText> */}
                <SizableText
                  color={
                    currentFeeIndex === index
                      ? '$textInteractive'
                      : '$textSubdued'
                  }
                  size="$bodyMdMedium"
                  textAlign="center"
                >
                  {item.label}
                </SizableText>
                {/* <NumberSizeableText
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
                </NumberSizeableText> */}
              </YStack>
            ),
          }))}
        />
      </>
    );
  }, [
    currentFeeIndex,
    customFee?.feeUTXO,
    feeSelectorItems,
    feeSymbol,
    intl,
    replaceTxMode,
    vaultSettings?.editFeeEnabled,
  ]);

  const handleFormValueOnChange = useCallback(
    ({
      name,
      value,
      intRequired,
    }: {
      name: string;
      value: string | undefined;
      intRequired?: boolean;
    }) => {
      const filedName = name as keyof typeof watchAllFields;
      const valueBN = new BigNumber(value ?? 0);
      if (valueBN.isNaN()) {
        const formattedValue = parseFloat(value ?? '');
        form.setValue(
          filedName,
          isNaN(formattedValue) ? '' : String(formattedValue),
        );
        return;
      }

      if (intRequired) {
        form.setValue(filedName, valueBN.toFixed(0));
      } else if (!value?.includes('.')) {
        form.setValue(filedName, valueBN.toFixed());
      }
    },
    [form],
  );

  const handleValidateDotExtraTip = useCallback(
    (value: string) => {
      const extraTip = new BigNumber(value || 0);
      if (extraTip.isNaN() || extraTip.isLessThanOrEqualTo(0)) {
        return false;
      }

      const minExtraTip = new BigNumber(1).shiftedBy(
        -customFee.common.feeDecimals,
      );
      if (extraTip.isNaN() || extraTip.isLessThan(minExtraTip)) {
        return intl.formatMessage(
          {
            id: ETranslations.send_error_minimum_amount,
          },
          {
            amount: minExtraTip.toFixed(),
            token: customFee.common.feeSymbol,
          },
        );
      }
      return true;
    },
    [customFee.common.feeDecimals, customFee.common.feeSymbol, intl],
  );

  const renderFeeEditorForm = useCallback(() => {
    if (!vaultSettings?.editFeeEnabled) return null;
    if (currentFeeType !== EFeeType.Custom || !customFee) return null;

    if (customFee?.feeAlgo) {
      return (
        <Form form={form}>
          <YStack>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.fee_fee,
              })}
              name="flatFee"
              rules={{
                required: true,
                validate: handleValidateFlatFee,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
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
          </YStack>
        </Form>
      );
    }

    if (customFee?.feeDot) {
      return (
        <Form form={form}>
          <YStack gap="$5">
            <Form.Field
              label={intl.formatMessage(
                {
                  id: ETranslations.form__priority_fee,
                },
                {
                  'network': feeSymbol,
                },
              )}
              name="dotExtraTip"
              rules={{
                required: true,
                min: 0,
                validate: handleValidateDotExtraTip,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
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
          </YStack>
        </Form>
      );
    }

    if (customFee?.gasEIP1559) {
      return (
        <Form form={form}>
          <YStack gap="$5">
            <YStack>
              <Form.Field
                label={intl.formatMessage({
                  id: ETranslations.transaction_max_base_fee,
                })}
                name="maxBaseFee"
                description={
                  replaceTxMode
                    ? null
                    : `${intl.formatMessage({
                        id: ETranslations.form_max_base_fee_description,
                      })}: ${customFee?.gasEIP1559.baseFeePerGas} ${feeSymbol}`
                }
                rules={{
                  required: true,
                  min: 0,
                  validate: handleValidateMaxBaseFee,
                  onChange: (e: { target: { name: string; value: string } }) =>
                    handleFormValueOnChange({
                      name: e.target.name,
                      value: e.target.value,
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
              {feeAlert ? (
                <SizableText color="$textCaution" size="$bodyMd" mt="$1.5">
                  {feeAlert}
                </SizableText>
              ) : null}
            </YStack>

            <YStack>
              <Form.Field
                label={`${intl.formatMessage({
                  id: ETranslations.form__priority_fee,
                })}`}
                name="priorityFee"
                description={
                  replaceTxMode ? null : recommendPriorityFee.description
                }
                rules={{
                  required: true,
                  validate: handleValidatePriorityFee,
                  min: 0,
                  onChange: (e: { target: { name: string; value: string } }) =>
                    handleFormValueOnChange({
                      name: e.target.name,
                      value: e.target.value,
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
              {priorityFeeAlert ? (
                <SizableText color="$textCaution" size="$bodyMd" mt="$1.5">
                  {priorityFeeAlert}
                </SizableText>
              ) : null}
            </YStack>

            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.content__gas_limit,
              })}
              name="gasLimit"
              // description={recommendGasLimit.description}
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

    if (customFee?.feeBudget) {
      return (
        <Form form={form}>
          <YStack gap="$5">
            <Form.Field
              label={intl.formatMessage(
                {
                  id: ETranslations.content__gas_price,
                },
                {
                  'network': feeSymbol,
                },
              )}
              name="gasSuiPrice"
              rules={{
                required: true,
                min: 0,
                validate: handleValidateSuiGasPrice,
                onChange: (e: { target: { name: string; value: string } }) =>
                  handleFormValueOnChange({
                    name: e.target.name,
                    value: e.target.value,
                  }),
              }}
            >
              <Input flex={1} />
            </Form.Field>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.content__gas_limit,
              })}
              name="gasSuiBudget"
              rules={{
                required: true,
                validate: handleValidateSuiGasBudget,
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
                      form.setValue(
                        'gasSuiBudget',
                        feeSelectorItems[0]?.feeInfo?.feeBudget?.budget ?? '0',
                      );
                      void form.trigger('gasSuiBudget');
                    },
                  },
                ]}
              />
            </Form.Field>
          </YStack>
        </Form>
      );
    }

    if (customFee?.gas) {
      return (
        <Form form={form}>
          <YStack gap="$5">
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
              // description={recommendGasLimit.description}
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

    if (customFee?.feeUTXO) {
      return (
        <Form form={form}>
          <YStack>
            <Form.Field
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
              <Input
                addOns={[
                  {
                    label: 'sat/vB',
                  },
                ]}
              />
            </Form.Field>
          </YStack>
        </Form>
      );
    }

    if (customFee?.feeSol) {
      return (
        <Form form={form}>
          <YStack>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.form__priority_fee,
              })}
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
              <Input
                flex={1}
                addOns={[
                  {
                    label: 'micro-lamports',
                  },
                ]}
              />
            </Form.Field>
          </YStack>
        </Form>
      );
    }

    if (customFee?.feeCkb) {
      return (
        <Form form={form}>
          <YStack>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.fee_fee_rate,
              })}
              name="feeRateCkb"
              rules={{
                required: true,
                validate: handleValidateFeeRateCkb,
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
                    label: 'shannons/kB',
                  },
                ]}
              />
            </Form.Field>
          </YStack>
        </Form>
      );
    }
  }, [
    currentFeeType,
    customFee,
    feeAlert,
    feeSymbol,
    form,
    feeSelectorItems,
    handleFormValueOnChange,
    handleValidateComputeUnitPrice,
    handleValidateDotExtraTip,
    handleValidateFeeRate,
    handleValidateFeeRateCkb,
    handleValidateFlatFee,
    handleValidateGasLimit,
    handleValidateGasPrice,
    handleValidateMaxBaseFee,
    handleValidatePriorityFee,
    handleValidateSuiGasBudget,
    handleValidateSuiGasPrice,
    intl,
    priorityFeeAlert,
    recommendGasLimit.gasLimit,
    recommendPriorityFee.description,
    replaceTxMode,
    vaultSettings?.editFeeEnabled,
  ]);

  const renderFeeOverview = useCallback(() => {
    let feeInfoItems: IFeeInfoItem[] = [];

    const fee =
      (currentFeeType === EFeeType.Custom
        ? customFee
        : feeSelectorItems[currentFeeIndex]?.feeInfo) ?? {};

    if (fee.feeAlgo) {
      let feeAlgo = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        feeAlgo = new BigNumber(watchAllFields.flatFee || 0);
      } else {
        feeAlgo = new BigNumber(fee.feeAlgo.baseFee || 0);
      }

      const feeInNative = calculateTotalFeeNative({
        amount: feeAlgo,
        feeInfo: fee,
        withoutBaseFee: true,
      });

      feeInfoItems = [
        {
          label: intl.formatMessage({ id: ETranslations.fee_fee }),
          nativeValue: feeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(feeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    } else if (fee.feeDot) {
      let extraTip = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        extraTip = new BigNumber(watchAllFields.dotExtraTip || '0');
      } else {
        extraTip = new BigNumber(fee.feeDot.extraTipInDot || '0');
      }

      const max = new BigNumber(fee.gas?.gasLimit || '0')
        .multipliedBy(fee.gas?.gasPrice || '0')
        .plus(extraTip)
        .toFixed();

      const maxFeeInNative = calculateTotalFeeNative({
        amount: max,
        feeInfo: fee,
        withoutBaseFee: true,
      });

      feeInfoItems = [
        {
          label: intl.formatMessage({ id: ETranslations.fee_fee }),
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    } else if (fee.gasEIP1559) {
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
        limit = new BigNumber(
          fee.gasEIP1559.gasLimitForDisplay || fee.gasEIP1559.gasLimit,
        );
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
              label: intl.formatMessage({ id: ETranslations.fee_l1_base_fee }),
              customValue: fee.common.baseFee,
              customSymbol: feeSymbol,
            }
          : null,
        {
          label: intl.formatMessage({ id: ETranslations.fee_expected_fee }),
          nativeValue: expectedFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(expectedFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
        {
          label: intl.formatMessage({ id: ETranslations.fee_max_fee }),
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ].filter(Boolean) as IFeeInfoItem[];
    } else if (fee.feeBudget) {
      let gasPrice = new BigNumber(0);

      if (currentFeeType === EFeeType.Custom) {
        gasPrice = new BigNumber(watchAllFields.gasSuiPrice || 0);
      } else {
        gasPrice = new BigNumber(fee.feeBudget.gasPrice);
      }
      const currFeeInfo = {
        ...fee,
        feeBudget: {
          ...fee.feeBudget,
          gasPrice: watchAllFields.gasSuiPrice,
        },
      };

      const gasUsed = calculateSuiTotalFee({
        feeInfo: currFeeInfo,
      });

      const maxFeeInNative = calculateTotalFeeNative({
        amount: new BigNumber(watchAllFields.gasSuiBudget).shiftedBy(
          -feeDecimals,
        ),
        feeInfo: currFeeInfo,
      });

      const expectedFeeInNative = calculateTotalFeeNative({
        amount: gasUsed.shiftedBy(-feeDecimals),
        feeInfo: currFeeInfo,
      });

      feeInfoItems = [
        vaultSettings?.withL1BaseFee &&
        new BigNumber(fee.common.baseFee ?? 0).gt(0)
          ? {
              label: intl.formatMessage({ id: ETranslations.fee_l1_base_fee }),
              customValue: fee.common.baseFee,
              customSymbol: feeSymbol,
            }
          : null,
        {
          label: intl.formatMessage({ id: ETranslations.global_gas_price }),
          customValue: gasPrice.toFixed(),
          customSymbol: feeSymbol,
        },
        {
          label: intl.formatMessage({ id: ETranslations.fee_expected_fee }),
          nativeValue: expectedFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(expectedFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
        {
          label: intl.formatMessage({ id: ETranslations.fee_max_fee }),
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
        limit = new BigNumber(fee.gas.gasLimitForDisplay || fee.gas.gasLimit);
        gasPrice = new BigNumber(fee.gas.gasPrice);
      }

      const maxFeeInNative = calculateTotalFeeNative({
        amount: gasPrice.times(limit),
        feeInfo: fee,
      });

      feeInfoItems = [
        vaultSettings?.withL1BaseFee &&
        new BigNumber(fee.common.baseFee ?? 0).gt(0)
          ? {
              label: intl.formatMessage({ id: ETranslations.fee_l1_base_fee }),
              customValue: fee.common.baseFee,
              customSymbol: feeSymbol,
            }
          : null,
        {
          label: intl.formatMessage({ id: ETranslations.global_gas_price }),
          customValue: gasPrice.toFixed(),
          customSymbol: feeSymbol,
        },
        {
          label: intl.formatMessage({ id: ETranslations.fee_max_fee }),
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
          label: intl.formatMessage({ id: ETranslations.fee_fee_rate }),
          customValue: feeRate.toFixed() ?? '0',
          customSymbol: 'sat/vB',
        },
        {
          label: intl.formatMessage({ id: ETranslations.fee_fee }),
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
          label: intl.formatMessage({ id: ETranslations.trx_consumed }),
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
          label: intl.formatMessage({ id: ETranslations.fee_fee }),
          nativeValue: maxFeeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(maxFeeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    } else if (fee.feeCkb) {
      let feeRate = new BigNumber(0);
      if (currentFeeType === EFeeType.Custom) {
        feeRate = new BigNumber(watchAllFields.feeRateCkb || 0);
      } else {
        feeRate = new BigNumber(fee.feeCkb.feeRate || 0);
      }

      const max = calculateCkbTotalFee({
        feeRate,
        txSize: unsignedTxs[0]?.txSize || 0,
        feeInfo: fee,
      });

      const feeInNative = calculateTotalFeeNative({
        amount: max,
        feeInfo: fee,
        withoutBaseFee: true,
      });

      feeInfoItems = [
        {
          label: intl.formatMessage({ id: ETranslations.fee_fee_rate }),
          customValue: feeRate.toFixed() ?? '0',
          customSymbol: 'shannons/kB',
        },
        {
          label: intl.formatMessage({ id: ETranslations.fee_fee }),
          nativeValue: feeInNative,
          nativeSymbol,
          fiatValue: new BigNumber(feeInNative)
            .times(nativeTokenPrice || 0)
            .toFixed(),
        },
      ];
    }

    return (
      <>
        {feeInfoItems.map((feeInfo, index) => (
          <FeeInfoItem
            feeInfo={feeInfo}
            key={index}
            {...(index !== 0 && {
              pt: '$2',
            })}
          />
        ))}
      </>
    );
  }, [
    currentFeeIndex,
    currentFeeType,
    customFee,
    estimateFeeParams?.estimateFeeParamsSol,
    feeSelectorItems,
    feeSymbol,
    feeDecimals,
    intl,
    nativeSymbol,
    nativeTokenPrice,
    unsignedTxs,
    vaultSettings?.withL1BaseFee,
    watchAllFields.computeUnitPrice,
    watchAllFields.dotExtraTip,
    watchAllFields.feeRate,
    watchAllFields.feeRateCkb,
    watchAllFields.flatFee,
    watchAllFields.gasLimit,
    watchAllFields.gasPrice,
    watchAllFields.maxBaseFee,
    watchAllFields.priorityFee,
    watchAllFields.gasSuiBudget,
    watchAllFields.gasSuiPrice,
  ]);

  const renderFeeDetails = useCallback(() => {
    const feeInfoItems: IFeeInfoItem[] = [];

    const fee =
      currentFeeType === EFeeType.Custom
        ? customFee
        : feeSelectorItems[currentFeeIndex]?.feeInfo;
    if (fee?.feeTron) {
      if (fee.feeTron.requiredBandwidth) {
        feeInfoItems.push({
          label: intl.formatMessage({ id: ETranslations.bandwidth_consumed }),
          customValue: String(fee.feeTron.requiredBandwidth),
          customSymbol: intl.formatMessage({
            id: ETranslations.bandwidth_energy_bandwidth,
          }),
        });
      }

      if (fee.feeTron.requiredEnergy) {
        feeInfoItems.push({
          label: intl.formatMessage({ id: ETranslations.energy_consumed }),
          customValue: String(fee.feeTron.requiredEnergy),
          customSymbol: intl.formatMessage({
            id: ETranslations.bandwidth_energy_energy,
          }),
        });
      }
    } else if (isMultiTxs && fee?.gasEIP1559) {
      feeInfoItems.push({
        label: intl.formatMessage({ id: ETranslations.fee_max_fee }),
        customValue: fee.gasEIP1559.maxFeePerGas,
        customSymbol: fee.common.feeSymbol,
      });
      feeInfoItems.push({
        label: intl.formatMessage({ id: ETranslations.form__priority_fee }),
        customValue: fee.gasEIP1559.maxPriorityFeePerGas,
        customSymbol: fee.common.feeSymbol,
      });
    } else if (isMultiTxs && fee?.gas) {
      feeInfoItems.push({
        label: intl.formatMessage({ id: ETranslations.global_gas_price }),
        customValue: fee.gas.gasPrice,
        customSymbol: fee.common.feeSymbol,
      });
    }

    return (
      <>
        {feeInfoItems.map((feeInfo, index) => (
          <FeeInfoItem
            {...(index !== 0 && {
              pt: '$2',
            })}
            feeInfo={feeInfo}
            key={index}
          />
        ))}
      </>
    );
  }, [
    currentFeeIndex,
    currentFeeType,
    customFee,
    feeSelectorItems,
    intl,
    isMultiTxs,
  ]);

  useEffect(() => {
    const callback = (
      event: IAppEventBusPayload[EAppEventBusNames.TxFeeInfoChanged],
    ) => {
      setFeeSelectorItems(event.feeSelectorItems);
    };
    appEventBus.on(EAppEventBusNames.TxFeeInfoChanged, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.TxFeeInfoChanged, callback);
    };
  }, []);

  return (
    <>
      <ScrollView mx="$-5" px="$5" pb="$5" maxHeight="$80">
        <Stack gap="$5">
          {renderFeeTypeSelector()}
          {renderFeeEditorForm()}
        </Stack>
      </ScrollView>
      <Stack
        pt="$4"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderSubdued"
      >
        {renderFeeDetails()}
        {isMultiTxs ? null : renderFeeOverview()}
        {vaultSettings?.editFeeEnabled ? (
          <Button
            mt="$4"
            disabled={isSaveFeeDisabled}
            variant="primary"
            size="large"
            $gtMd={
              {
                size: 'medium',
              } as any
            }
            onPress={handleApplyFeeInfo}
          >
            {intl.formatMessage({ id: ETranslations.action_save })}
          </Button>
        ) : null}
      </Stack>
    </>
  );
}

export { FeeEditor };
