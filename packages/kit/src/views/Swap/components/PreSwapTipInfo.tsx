import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IQuoteTip, ISwapToken } from '@onekeyhq/shared/types/swap/types';

const COUNTDOWN_SECONDS = 5;

interface IPreSwapTipInfoProps {
  quoteShowTip: IQuoteTip;
  onConfirm: () => void;
  onCancel?: () => void;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromAmount: string;
  toAmount: string;
}

const PreSwapTipInfo = ({
  quoteShowTip,
  onConfirm,
  onCancel,
  fromToken,
  toToken,
  fromAmount,
  toAmount,
}: IPreSwapTipInfoProps) => {
  const intl = useIntl();
  const [checked, setChecked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const buildEventParams = useCallback(
    (isChecked: boolean) => ({
      checked: quoteShowTip.showCheckbox ? isChecked : undefined,
      fromTokenSymbol: fromToken?.symbol ?? '',
      fromTokenAmount: fromAmount,
      fromTokenFiatValue: fromToken?.fiatValue ?? '',
      fromChainNetworkId: fromToken?.networkId ?? '',
      toTokenSymbol: toToken?.symbol ?? '',
      toTokenAmount: toAmount,
      toTokenFiatValue: toToken?.fiatValue ?? '',
      toChainNetworkId: toToken?.networkId ?? '',
      valueDropPercent: quoteShowTip.title ?? '',
    }),
    [
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      quoteShowTip.title,
      quoteShowTip.showCheckbox,
    ],
  );

  const handleCheckboxChange = useCallback(
    (checkedValue: string | boolean) => {
      const isChecked = !!checkedValue;
      setChecked(isChecked);
      clearTimer();
      if (isChecked) {
        setCountdown(COUNTDOWN_SECONDS);
        timerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setCountdown(0);
      }
    },
    [clearTimer],
  );

  useEffect(() => {
    if (countdown === 0 && timerRef.current) {
      clearTimer();
    }
  }, [countdown, clearTimer]);

  const handleLearnMore = useCallback(() => {
    if (quoteShowTip.link) {
      openUrlExternal(quoteShowTip.link);
    }
  }, [quoteShowTip.link]);

  const handleConfirm = useCallback(() => {
    defaultLogger.swap.valueDropTip.valueDropTipContinue(
      buildEventParams(checked),
    );
    onConfirm();
  }, [buildEventParams, checked, onConfirm]);

  const handleCancel = useCallback(() => {
    defaultLogger.swap.valueDropTip.valueDropTipCancel(
      buildEventParams(checked),
    );
    onCancel?.();
  }, [buildEventParams, checked, onCancel]);

  const isCountingDown = checked && countdown > 0;
  const isContinueDisabled = quoteShowTip.showCheckbox
    ? !checked || isCountingDown
    : false;

  const continueText = isCountingDown
    ? `${intl.formatMessage({ id: ETranslations.global_continue })} (${countdown})`
    : intl.formatMessage({ id: ETranslations.global_continue });

  return (
    <YStack gap="$3">
      <YStack
        gap="$2"
        p="$3"
        borderRadius="$3"
        bg="$bgCritical"
        borderWidth={1}
        borderColor="$borderCritical"
      >
        <SizableText size="$bodyMd" fontWeight={600} color="$textCritical">
          {quoteShowTip.title}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {quoteShowTip.detail}
        </SizableText>
        {quoteShowTip.link ? (
          <XStack alignSelf="flex-start" onPress={handleLearnMore}>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              textDecorationLine="underline"
              textDecorationColor="$textSubdued"
              textDecorationStyle="dotted"
            >
              {intl.formatMessage({ id: ETranslations.global_learn_more })}
            </SizableText>
          </XStack>
        ) : null}
      </YStack>

      {quoteShowTip.showCheckbox ? (
        <Checkbox
          testID="swap-checkbox"
          value={checked}
          onChange={handleCheckboxChange}
          label={quoteShowTip.checkboxLabel}
        />
      ) : null}

      <XStack gap="$3" pt="$2">
        {quoteShowTip.showCancelButton ? (
          <Button
            flex={1}
            variant="secondary"
            size="medium"
            onPress={handleCancel}
            testID="swap-btn"
          >
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
        ) : null}
        <Button
          testID="swap-btn"
          flex={1}
          variant="destructive"
          size="medium"
          onPress={handleConfirm}
          disabled={isContinueDisabled}
        >
          {continueText}
        </Button>
      </XStack>
    </YStack>
  );
};

export { PreSwapTipInfo };
