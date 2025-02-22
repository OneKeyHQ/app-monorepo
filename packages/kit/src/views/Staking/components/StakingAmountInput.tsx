import { useCallback, useState } from 'react';

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

export const stakingInputAccessoryViewID =
  'staking-amount-input-accessory-view';

export function StakingAmountInput({
  title,
  inputProps,
  onSelectStage,
  ...props
}: IAmountInputFormItemProps & {
  title: string;
  onSelectStage: (percent: number) => void;
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
    <YStack borderRadius="$3" backgroundColor="$bgSubdued" borderWidth="$0">
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
              {[25, 50, 100].map((stage) => (
                <SwapPercentageStageBadge
                  key={`swap-percentage-input-stage-${stage}`}
                  stage={stage}
                  onSelectStage={onSelectStage}
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
          inputAccessoryViewID: stakingInputAccessoryViewID,
          autoCorrect: false,
          spellCheck: false,
          autoComplete: 'off',
          onFocus: onFromInputFocus,
          onBlur: onFromInputBlur,
        }}
        {...props}
      />
    </YStack>
  );
}
