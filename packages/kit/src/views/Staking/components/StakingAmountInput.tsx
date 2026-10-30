import type { ReactNode, RefObject } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { InputAccessoryView } from 'react-native';

import {
  AnimatePresence,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { buildKeyboardPressProps } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopPressable';
import SwapPercentageStageBadge from '@onekeyhq/kit/src/views/Swap/components/SwapPercentageStageBadge';
import { getSwapBalanceActionProps } from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceActionUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { BlurEvent, StyleProp, TextStyle } from 'react-native';

// Note: testIDs are passed through inputProps from parent components

export const stakingInputAccessoryViewID =
  'staking-amount-input-accessory-view';

// No 100%: the Max beside the balance is the whole balance
export const StakingPercentageInputStage = [25, 50, 75];

// Said in place of a zero balance by the deposit form around the box: the
// wallet holds nothing on the network to pay with (demo 10-30)
export const EarnBalanceNoteContext = createContext<string | undefined>(
  undefined,
);

// A form that opens complete takes the focus as a modal is still opening,
// and the opening can drop it a moment later. This long it is taken back
const AUTO_FOCUS_HOLD_MS = 800;
// A press this soon after the box lost focus took it from the box
const REFOCUS_AFTER_PRESS_MS = 400;

function useHoldAutoFocus(
  boxRef: RefObject<IElement | null>,
  autoFocus: boolean,
) {
  useEffect(() => {
    if (!autoFocus || !platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    const box = boxRef.current as unknown as HTMLElement | null;
    const input = box?.querySelector?.('input');
    if (!input) {
      return undefined;
    }
    let frame = 0;
    const handleBlur = (event: FocusEvent) => {
      // Moved by the user (or a script) to another element: theirs
      if (event.relatedTarget) {
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = globalThis.document?.activeElement;
        if (!active || active === globalThis.document.body) {
          input.focus({ preventScroll: true });
        }
      });
    };
    input.addEventListener('blur', handleBlur);
    const timer = setTimeout(
      () => input.removeEventListener('blur', handleBlur),
      AUTO_FOCUS_HOLD_MS,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      input.removeEventListener('blur', handleBlur);
    };
  }, [autoFocus, boxRef]);
}

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
  onSelectPercentageStage,
  value,
  onBlur,
  bottomContent,
  boxTestID,
  onRefreshBalance,
  stagesLabel,
  activeStage,
  hideStages,
  ...props
}: IAmountInputFormItemProps & {
  title: string;
  forceSubduedBackground?: boolean;
  onSelectPercentageStage: (percent: number) => void;
  // Inside the box under the balance line: Pay with's token list
  bottomContent?: ReactNode;
  boxTestID?: string;
  // With it, a balance read as zero gets Swap's refresh in place of Max, as
  // on the Swap page: Pay with can pick a token the wallet doesn't hold yet
  onRefreshBalance?: () => Promise<unknown> | void;
  // Before the chips, what they are a share of when it isn't the balance
  // (the Loans router's loan: "LTV", of the collateral's value)
  stagesLabel?: string;
  // The chip the amount follows, shown pressed
  activeStage?: number;
  // No chips: the amount is set some other way (the Loans router's LTV bar)
  hideStages?: boolean;
}) {
  const boxRef = useRef<IElement>(null);
  useHoldAutoFocus(boxRef, Boolean(inputProps?.autoFocus) && !disabled);

  // A chip or Max clicked while typing keeps the cursor in the box, for the
  // next keystroke: the click took the focus a moment ago. One reached with
  // Tab and pressed with a key keeps the focus where the keyboard put it
  const blurredAtRef = useRef(Number.NEGATIVE_INFINITY);
  const pointerDownAtRef = useRef(Number.NEGATIVE_INFINITY);
  useEffect(() => {
    if (!platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    const box = boxRef.current as unknown as HTMLElement | null;
    if (!box?.addEventListener) {
      return undefined;
    }
    const handlePointerDown = () => {
      pointerDownAtRef.current = performance.now();
    };
    box.addEventListener('pointerdown', handlePointerDown, true);
    return () =>
      box.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);
  const keepTypingFocus = useCallback(() => {
    const now = performance.now();
    if (
      !platformEnv.isRuntimeBrowser ||
      now - blurredAtRef.current > REFOCUS_AFTER_PRESS_MS ||
      now - pointerDownAtRef.current > REFOCUS_AFTER_PRESS_MS
    ) {
      return;
    }
    const box = boxRef.current as unknown as HTMLElement | null;
    box?.querySelector?.('input')?.focus({ preventScroll: true });
  }, []);
  const handleSelectStage = useCallback(
    (stage: number) => {
      onSelectPercentageStage(stage);
      keepTypingFocus();
    },
    [keepTypingFocus, onSelectPercentageStage],
  );
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const refreshBalance = useCallback(async () => {
    setIsRefreshingBalance(true);
    try {
      await onRefreshBalance?.();
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [onRefreshBalance]);
  const balanceValue = props.balanceProps?.value;
  const isLoadedZero =
    !props.balanceProps?.loading &&
    Boolean(balanceValue) &&
    new BigNumber(balanceValue ?? '').isZero();
  const isBalanceLoadedZero = Boolean(onRefreshBalance) && isLoadedZero;
  const balanceOnPress = props.balanceProps?.onPress;
  const balanceNote = useContext(EarnBalanceNoteContext);
  const balanceProps = useMemo(() => {
    if (!props.balanceProps) {
      return undefined;
    }
    if (isBalanceLoadedZero) {
      return {
        ...props.balanceProps,
        valueText: balanceNote,
        ...getSwapBalanceActionProps({
          isLoadedZero: true,
          refreshing: isRefreshingBalance,
          onRefresh: () => {
            void refreshBalance();
          },
        }),
        isKeyboardPressable: true,
      };
    }
    // Nothing to fill from a zero balance: Max takes its disabled look
    return {
      ...props.balanceProps,
      onPress:
        balanceOnPress && !isLoadedZero
          ? () => {
              balanceOnPress();
              keepTypingFocus();
            }
          : undefined,
      isKeyboardPressable: true,
    };
  }, [
    balanceNote,
    balanceOnPress,
    isBalanceLoadedZero,
    isLoadedZero,
    isRefreshingBalance,
    keepTypingFocus,
    props.balanceProps,
    refreshBalance,
  ]);

  const onFromInputBlur = useCallback(
    (e: BlurEvent) => {
      blurredAtRef.current = performance.now();
      onBlur?.(e as any);
    },
    [onBlur],
  );

  return (
    <YStack
      ref={boxRef}
      testID={boxTestID}
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
        {/* The chips are part of the box, there whether or not it has the
            focus; as it mounts (another protocol's form) they show as they
            are */}
        <AnimatePresence initial={false}>
          {!platformEnv.isNative && !disabled && !hideStages ? (
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
              ai={stagesLabel ? 'center' : undefined}
              gap="$0.5"
              // The last chip's text ends where Max and the token below end;
              // its fill keeps the chip's own padding past that edge
              mr="$-1.5"
            >
              {stagesLabel ? (
                <SizableText size="$bodyMd" color="$textSubdued" mr="$1">
                  {stagesLabel}
                </SizableText>
              ) : null}
              {StakingPercentageInputStage.map((stage) => (
                <SwapPercentageStageBadge
                  key={`swap-percentage-input-stage-${stage}`}
                  stage={stage}
                  isActive={stage === activeStage}
                  onSelectStage={handleSelectStage}
                  {...buildKeyboardPressProps(() => handleSelectStage(stage))}
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
          onBlur: onFromInputBlur,
        }}
        value={value}
        {...props}
        balanceProps={balanceProps}
        onChange={(val: string) => {
          if (disabled) return;
          props.onChange?.(val);
        }}
      />
      {bottomContent}
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={stakingInputAccessoryViewID}>
          <SizableText h="$0" />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
}
