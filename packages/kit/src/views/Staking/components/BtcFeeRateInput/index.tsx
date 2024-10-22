import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Icon,
  Input,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';

import { CalculationListItem } from '../CalculationList';

type IFeeRateType = 'slow' | 'normal' | 'fast' | 'custom';

type IFeeRateOption = { feeType: IFeeRateType; value: string };

type IEstimateFeeRequiredUTXO = Required<Pick<IFeeUTXO, 'feeRate'>>;

const DEFAULT_FEE_RATE_MIN = 1;
const DEFAULT_FEE_RATE_MAX = 1_000_000;

const BtcFeeRateInputDialogContent = ({
  estimateFeeUTXO,
  feeRate,
  onSaveFeeRate,
}: {
  estimateFeeUTXO: IEstimateFeeRequiredUTXO[];
  feeRate: IFeeRateOption;
  onSaveFeeRate?: (option: IFeeRateOption) => void;
}) => {
  const intl = useIntl();
  const dialog = useDialogInstance();

  const [feeType, setFeeType] = useState<IFeeRateType>(feeRate.feeType);
  const [customFeeRate, setCustomFeeRate] = useState(feeRate.value ?? '1');

  const feeOptions = useMemo<
    {
      label: string;
      type: IFeeRateType;
    }[]
  >(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.transaction_slow }),
        type: 'slow',
      },
      {
        label: intl.formatMessage({ id: ETranslations.transaction_normal }),
        type: 'normal',
      },
      {
        label: intl.formatMessage({ id: ETranslations.transaction_fast }),
        type: 'fast',
      },
      {
        label: intl.formatMessage({ id: ETranslations.transaction_custom }),
        type: 'custom',
      },
    ],
    [intl],
  );

  const currentFeeRate = useMemo<IFeeRateOption>(() => {
    const presetFeeType: IFeeRateType[] = ['slow', 'normal', 'fast'];
    if (presetFeeType.includes(feeType)) {
      const feeOptionIndex = feeOptions.findIndex((o) => o.type === feeType);
      const feeRateValue = estimateFeeUTXO[feeOptionIndex].feeRate;
      return { feeType, value: feeRateValue };
    }
    return { feeType: 'custom', value: customFeeRate };
  }, [feeType, estimateFeeUTXO, feeOptions, customFeeRate]);

  const customFeeRateErr = useMemo(() => {
    const feeRateBN = new BigNumber(customFeeRate);
    if (
      feeRateBN.isNaN() ||
      feeRateBN.isLessThan(DEFAULT_FEE_RATE_MIN) ||
      feeRateBN.isGreaterThan(DEFAULT_FEE_RATE_MAX)
    ) {
      return intl.formatMessage(
        { id: ETranslations.form_ree_rate_error_out_of_range },
        { min: DEFAULT_FEE_RATE_MIN, max: DEFAULT_FEE_RATE_MAX },
      );
    }
  }, [intl, customFeeRate]);

  const onSave = useCallback(() => {
    void dialog.close();
    onSaveFeeRate?.(currentFeeRate);
  }, [dialog, onSaveFeeRate, currentFeeRate]);

  const isDisabled = Boolean(feeType === 'custom' && customFeeRateErr);

  return (
    <Stack>
      <SegmentControl
        fullWidth
        value={feeType}
        onChange={(v) => {
          setFeeType(v as IFeeRateType);
        }}
        options={feeOptions.map((o) => ({
          value: o.type,
          label: (
            <SizableText
              color={feeType === o.type ? '$textInteractive' : '$textSubdued'}
              size="$bodyMdMedium"
              textAlign="center"
            >
              {o.label}
            </SizableText>
          ),
        }))}
      />
      <Divider my="$5" />
      {feeType === 'custom' ? (
        <YStack>
          <Input
            addOns={[
              {
                label: 'sat/vB',
              },
            ]}
            value={customFeeRate}
            onChangeText={(text: string) => {
              const bn = BigNumber(text);
              if (text === '' || !bn.isNaN()) {
                setCustomFeeRate(text);
              }
            }}
          />
          {customFeeRateErr ? (
            <SizableText
              pt="$1.5"
              animation="quick"
              enterStyle={{
                opacity: 0,
                y: -6,
              }}
              exitStyle={{
                opacity: 0,
                y: -6,
              }}
            >
              <SizableText color="$textCritical" size="$bodyMd">
                {customFeeRateErr}
              </SizableText>
            </SizableText>
          ) : null}
        </YStack>
      ) : (
        <XStack jc="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.fee_fee_rate })}
          </SizableText>
          <SizableText size="$bodyMdMedium">
            {currentFeeRate.value} sat/vB
          </SizableText>
        </XStack>
      )}
      <Stack pt="$5">
        <Button
          size="large"
          variant="primary"
          onPress={onSave}
          disabled={isDisabled}
        >
          {intl.formatMessage({ id: ETranslations.action_save })}
        </Button>
      </Stack>
    </Stack>
  );
};

export const BtcFeeRateInput = ({
  estimateFeeUTXO,
  onFeeRateChange,
}: {
  estimateFeeUTXO?: IEstimateFeeRequiredUTXO[];
  onFeeRateChange?: (feeRate: string) => void;
}) => {
  const intl = useIntl();
  const [, normal] = estimateFeeUTXO ?? [];
  const [feeRate, setFeeRate] = useState<IFeeRateOption>({
    feeType: 'normal',
    value: normal?.feeRate ?? '1',
  });

  const feeTypeLabels = useMemo<Record<IFeeRateType, string>>(
    () => ({
      'slow': intl.formatMessage({ id: ETranslations.transaction_slow }),
      'normal': intl.formatMessage({ id: ETranslations.transaction_normal }),
      'fast': intl.formatMessage({ id: ETranslations.transaction_fast }),
      'custom': intl.formatMessage({ id: ETranslations.transaction_custom }),
    }),
    [intl],
  );

  useEffect(() => {
    onFeeRateChange?.(feeRate.value);
  }, [feeRate, onFeeRateChange]);

  const onPress = useCallback(() => {
    if (!estimateFeeUTXO) {
      return;
    }
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.fee_fee_rate }),
      renderContent: (
        <BtcFeeRateInputDialogContent
          estimateFeeUTXO={estimateFeeUTXO}
          onSaveFeeRate={setFeeRate}
          feeRate={feeRate}
        />
      ),
      showFooter: false,
    });
  }, [intl, estimateFeeUTXO, feeRate]);

  return estimateFeeUTXO ? (
    <CalculationListItem onPress={onPress}>
      <CalculationListItem.Label>
        {intl.formatMessage({
          id: ETranslations.fee_fee_rate,
        })}
      </CalculationListItem.Label>
      <XStack alignItems="center" cursor="pointer" mr={-6}>
        <XStack gap="$1">
          <SizableText size="$bodyLgMedium">
            {feeTypeLabels[feeRate.feeType] ?? feeRate.feeType}
          </SizableText>
          <SizableText size="$bodyLgMedium">
            ({feeRate.value}sat/vB)
          </SizableText>
        </XStack>
        <Icon name="ChevronRightSmallOutline" size={24} />
      </XStack>
    </CalculationListItem>
  ) : null;
};
