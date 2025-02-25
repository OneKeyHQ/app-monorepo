import { useCallback, useState } from 'react';

import { InputAccessoryView, Keyboard } from 'react-native';

import {
  AnimatePresence,
  Button,
  SizableText,
  XStack,
  YStack,
  useIsKeyboardShown,
} from '@onekeyhq/components';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { StyleProp, TextStyle } from 'react-native';

export const stakingInputAccessoryViewID =
  'staking-amount-input-accessory-view';

export const StakingPercentageInputStage = [25, 50, 100];
export const StakingPercentageInputStageForNative = [25, 50, 75, 100];

export function StakingAmountInput({
  title,
  inputProps,
  disabled,
  onSelectPercentageStage,
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

  const onFromInputBlur = useCallback(() => {
    setTimeout(() => {
      setPercentageInputStageShow(false);
    }, 200);
  }, []);
  return (
    <YStack
      borderRadius="$3"
      backgroundColor={disabled ? '$bgDisabled' : '$bgSubdued'}
      borderWidth="$0"
    >
      <XStack justifyContent="space-between" pt="$2.5" px="$3.5">
        <SizableText>{title}</SizableText>
        <AnimatePresence>
          {!platformEnv.isNative && percentageInputStageShow ? (
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

export function PercentageStageOnKeyboard({
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
}) {
  const isShow = useIsKeyboardShown();
  return isShow ? (
    <XStack
      alignItems="center"
      gap="$1"
      justifyContent="space-around"
      bg="$bgSubdued"
      h="$10"
    >
      <>
        {StakingPercentageInputStageForNative.map((stage) => (
          <SwapPercentageStageBadge
            badgeSize="lg"
            key={`swap-percentage-input-stage-${stage}`}
            stage={stage}
            borderRadius={0}
            onSelectStage={onSelectPercentageStage}
            flex={1}
            justifyContent="center"
            alignItems="center"
            h="$10"
          />
        ))}
        <Button
          icon="CheckLargeOutline"
          flex={1}
          h="$10"
          size="small"
          justifyContent="center"
          borderRadius={0}
          alignItems="center"
          variant="tertiary"
          onPress={() => {
            Keyboard.dismiss();
          }}
        />
      </>
    </XStack>
  ) : null;
}
