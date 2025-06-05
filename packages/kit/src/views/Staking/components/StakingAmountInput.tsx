import { useCallback, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { InputAccessoryView } from 'react-native';

import {
  AnimatePresence,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  NativeSyntheticEvent,
  StyleProp,
  TextInputFocusEventData,
  TextStyle,
} from 'react-native';

export const stakingInputAccessoryViewID =
  'staking-amount-input-accessory-view';

export const StakingPercentageInputStage = [25, 50, 100];

export const useOnBlurAmountValue = (
  amountValue: string,
  setAmountValue: (value: string) => void,
) => {
  const amountValueRef = useRef<string | undefined>(undefined);
  amountValueRef.current = amountValue;
  return useCallback(() => {
    if (amountValueRef.current) {
      const value = BigNumber(amountValueRef.current);
      if (value.isNaN()) {
        setAmountValue('');
      } else {
        setAmountValue(value.toFixed());
      }
    }
  }, [setAmountValue]);
};

export function StakingAmountInput({
  title,
  inputProps,
  disabled,
  onSelectPercentageStage,
  value,
  onBlur,
  ...props
}: IAmountInputFormItemProps & {
  title: string;
  onSelectPercentageStage: (percent: number) => void;
}) {
  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);
  const onFromInputFocus = useCallback(() => {
    setPercentageInputStageShow(true);
  }, []);

  const onFromInputBlur = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setTimeout(() => {
        setPercentageInputStageShow(false);
      }, 200);
      onBlur?.(e as any);
    },
    [onBlur],
  );

  return (
    <YStack
      borderRadius="$3"
      backgroundColor={disabled ? '$bgDisabled' : '$bgSubdued'}
      borderWidth="$0"
    >
      <XStack justifyContent="space-between" pt="$2.5" px="$3.5">
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        <AnimatePresence>
          {!platformEnv.isNative &&
          !disabled &&
          (percentageInputStageShow || !!value) ? (
            <XStack
              animation="quick"
              enterStyle={{
                opacity: 0,
                x: 8,
              }}
              exitStyle={{
                opacity: 0,
                x: 4,
              }}
              gap="$0.5"
            >
              {StakingPercentageInputStage.map((stage) => (
                <SwapPercentageStageBadge
                  key={`swap-percentage-input-stage-${stage}`}
                  stage={stage}
                  onSelectStage={onSelectPercentageStage}
                />
              ))}
            </XStack>
          ) : null}
        </AnimatePresence>
      </XStack>
      <AmountInput
        borderRadius="$0"
        borderWidth="$0"
        inputProps={{
          ...inputProps,
          style:
            !platformEnv.isNative && disabled
              ? ({
                  caretColor: 'transparent',
                } as unknown as StyleProp<TextStyle>)
              : undefined,
          inputAccessoryViewID: stakingInputAccessoryViewID,
          autoCorrect: false,
          spellCheck: false,
          autoComplete: 'off',
          editable: !disabled || inputProps?.disabled,
          onFocus: onFromInputFocus,
          onBlur: onFromInputBlur,
        }}
        value={value}
        {...props}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={stakingInputAccessoryViewID}>
          <SizableText h="$0" />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
}
