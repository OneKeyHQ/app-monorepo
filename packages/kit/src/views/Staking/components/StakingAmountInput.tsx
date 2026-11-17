import { useCallback, useEffect, useId, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { InputAccessoryView, TextInput } from 'react-native';

import {
  AnimatePresence,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/views/Swap/components/PercentageStageOnKeyboard';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { BlurEvent, StyleProp, TextStyle } from 'react-native';

// Note: testIDs are passed through inputProps from parent components

export const stakingInputAccessoryViewID =
  'staking-amount-input-accessory-view';

export const StakingPercentageInputStage = [25, 50, 75, 100];

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
  forceSubduedBackground,
  usePercentageKeyboardAccessory,
  onAmountFocusChange,
  onSelectPercentageStage,
  value,
  onBlur,
  ...props
}: IAmountInputFormItemProps & {
  title: string;
  forceSubduedBackground?: boolean;
  usePercentageKeyboardAccessory?: boolean;
  onAmountFocusChange?: (inputId: string, focused: boolean) => void;
  onSelectPercentageStage: (percent: number) => void;
}) {
  const inputId = useId();
  const onAmountFocusChangeRef = useRef(onAmountFocusChange);
  const inputFocusedRef = useRef(false);
  const disabledRef = useRef(disabled);
  onAmountFocusChangeRef.current = onAmountFocusChange;
  disabledRef.current = disabled;
  useEffect(() => {
    if (!platformEnv.isNativeAndroid) return undefined;
    if (disabled) onAmountFocusChangeRef.current?.(inputId, false);
    else if (inputFocusedRef.current) {
      onAmountFocusChangeRef.current?.(inputId, true);
    }
    return () => onAmountFocusChangeRef.current?.(inputId, false);
  }, [disabled, inputId]);
  const usePercentageAccessory =
    platformEnv.isNativeIOSPhone && usePercentageKeyboardAccessory;
  const accessoryViewID = usePercentageAccessory
    ? `${stakingInputAccessoryViewID}-${inputId}`
    : stakingInputAccessoryViewID;
  const inputRef = useRef<IInputRef>(null);
  const shouldAutoFocusOnMount = useRef(inputProps?.autoFocus);
  const didAutoFocus = useRef(false);
  useEffect(() => {
    if (
      !usePercentageAccessory ||
      !shouldAutoFocusOnMount.current ||
      !inputProps?.autoFocus ||
      inputProps?.loading ||
      didAutoFocus.current
    ) {
      return;
    }
    // Let the native accessory attach before the input becomes first responder.
    const focusedInput = TextInput.State.currentlyFocusedInput();
    const frame = requestAnimationFrame(() => {
      if (
        inputRef.current &&
        !didAutoFocus.current &&
        TextInput.State.currentlyFocusedInput() === focusedInput
      ) {
        didAutoFocus.current = true;
        inputRef.current.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [inputProps?.autoFocus, inputProps?.loading, usePercentageAccessory]);
  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);
  const onFromInputFocus = useCallback(() => {
    didAutoFocus.current = true;
    inputFocusedRef.current = true;
    if (platformEnv.isNativeAndroid && !disabledRef.current) {
      onAmountFocusChangeRef.current?.(inputId, true);
    }
    setPercentageInputStageShow(true);
  }, [inputId]);

  const onFromInputBlur = useCallback(
    (e: BlurEvent) => {
      inputFocusedRef.current = false;
      if (platformEnv.isNativeAndroid) {
        onAmountFocusChangeRef.current?.(inputId, false);
      }
      setTimeout(() => {
        setPercentageInputStageShow(false);
      }, 200);
      onBlur?.(e as any);
    },
    [inputId, onBlur],
  );

  return (
    <YStack
      borderRadius="$3"
      backgroundColor={
        disabled && !forceSubduedBackground ? '$bgDisabled' : '$bgSubdued'
      }
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
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
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
          ...(usePercentageAccessory
            ? { ref: inputRef, autoFocus: false }
            : {}),
          style:
            !platformEnv.isNative && disabled
              ? ({
                  caretColor: 'transparent',
                } as unknown as StyleProp<TextStyle>)
              : undefined,
          inputAccessoryViewID: accessoryViewID,
          autoCorrect: false,
          spellCheck: false,
          autoComplete: 'off',
          editable: !disabled || inputProps?.disabled,
          onFocus: onFromInputFocus,
          onBlur: onFromInputBlur,
        }}
        value={value}
        {...props}
        onChange={(val: string) => {
          if (disabled) return;
          props.onChange?.(val);
        }}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={accessoryViewID}>
          {usePercentageAccessory ? (
            <PercentageStageOnKeyboard
              onSelectPercentageStage={
                disabled ? undefined : onSelectPercentageStage
              }
            />
          ) : (
            <SizableText h="$0" />
          )}
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
}
