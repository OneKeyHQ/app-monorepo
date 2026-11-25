import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { Platform, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Icon, SizableText, Stack, XStack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export type IStepIndicatorStatus = 'upcoming' | 'current' | 'done';
export type IStepIndicatorTone = 'default' | 'inverse';

/** A visual mark; provide an accessible status label alongside it when needed. */
export type IStepIndicatorMarkProps = {
  /** Zero-based step index; displayed starting from one. */
  index: number;
  status: IStepIndicatorStatus;
  tone?: IStepIndicatorTone;
  /** Override the current mark's text color to match a colored surface. */
  currentMarkTextColor?: ISizableTextProps['color'];
  testID?: string;
};

function getMarkTextColor(status: IStepIndicatorStatus, inverse: boolean) {
  if (status === 'current') return inverse ? '$blackA12' : '$textInverse';
  return inverse ? '$whiteA10' : '$textSubdued';
}

function StepIndicatorMarkFace({
  index,
  status,
  tone = 'default',
  currentMarkTextColor,
}: IStepIndicatorMarkProps) {
  const inverse = tone === 'inverse';
  let background:
    | '$bgPrimary'
    | '$bgSuccessStrong'
    | '$whiteA12'
    | '$whiteA4'
    | 'transparent' = 'transparent';
  if (status === 'current') background = inverse ? '$whiteA12' : '$bgPrimary';
  else if (status === 'done')
    background = inverse ? '$whiteA4' : '$bgSuccessStrong';

  return (
    <Stack
      width={20}
      height={20}
      borderRadius="$full"
      borderWidth={status === 'upcoming' ? 1.5 : 0}
      borderColor={inverse ? '$whiteA6' : '$borderSubdued'}
      bg={background}
      alignItems="center"
      justifyContent="center"
    >
      {status === 'done' ? (
        <Icon
          name="CheckLargeOutline"
          size="$3.5"
          color={inverse ? '$whiteA12' : '$iconOnColor'}
        />
      ) : (
        <SizableText
          size="$bodySmMedium"
          color={
            status === 'current' && currentMarkTextColor
              ? currentMarkTextColor
              : getMarkTextColor(status, inverse)
          }
        >
          {index + 1}
        </SizableText>
      )}
    </Stack>
  );
}

// Keep the faces mounted so interrupted transitions can reverse without a blank frame.
const ANIMATE_OPACITY = ['opacity'];
const MARK_STATUSES: IStepIndicatorStatus[] = ['upcoming', 'current', 'done'];

export function StepIndicatorMark(props: IStepIndicatorMarkProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Stack width={20} height={20} testID={props.testID}>
      {reduceMotion ? (
        <StepIndicatorMarkFace {...props} />
      ) : (
        MARK_STATUSES.map((status) => {
          const active = status === props.status;
          return (
            <Stack
              key={status}
              position="absolute"
              top={0}
              left={0}
              opacity={active ? 1 : 0}
              transition="quick"
              animateOnly={ANIMATE_OPACITY}
              pointerEvents="none"
              aria-hidden={!active}
              accessibilityElementsHidden={!active}
              importantForAccessibility={
                active ? 'auto' : 'no-hide-descendants'
              }
            >
              <StepIndicatorMarkFace {...props} status={status} />
            </Stack>
          );
        })
      )}
    </Stack>
  );
}

export type IStepIndicatorItem = {
  /** Stable identifier unique within this indicator. */
  id: string;
  label: string;
  status: IStepIndicatorStatus;
  disabled?: boolean;
  /** Include a localized status if it must be announced for this step. */
  accessibilityLabel?: string;
};

export type IStepIndicatorProps = {
  steps: IStepIndicatorItem[];
  onStepPress?: (id: string) => void;
  tone?: IStepIndicatorTone;
  currentMarkTextColor?: ISizableTextProps['color'];
  testID?: string;
};

// The web animation driver emits CSS property names directly.
const ANIMATE_BACKGROUND =
  Platform.OS === 'web' ? ['background-color'] : ['backgroundColor'];
const STEP_STYLE = { flexShrink: 1, minWidth: 0 };

function StepIndicatorSegment({
  step,
  index,
  tone,
  currentMarkTextColor,
  onStepPress,
  testID,
}: {
  step: IStepIndicatorItem;
  index: number;
  tone: IStepIndicatorTone;
  currentMarkTextColor?: ISizableTextProps['color'];
  onStepPress?: (id: string) => void;
  testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!onStepPress) setFocused(false);
  }, [onStepPress]);
  const inverse = tone === 'inverse';
  const current = step.status === 'current';
  const currentBackground = inverse ? '$whiteA3' : '$bgSubdued';
  const focusColor = inverse ? '$whiteA12' : '$focusRing';
  const accessibilityState = useMemo(
    () => ({ disabled: step.disabled, selected: current }),
    [step.disabled, current],
  );
  const handlePress = useCallback(
    () => onStepPress?.(step.id),
    [onStepPress, step.id],
  );
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => setFocused(false), []);
  const showFocus = focused && !!onStepPress && !step.disabled;
  const content = (
    <XStack
      alignItems="center"
      gap="$2"
      px="$2"
      py="$1.5"
      minWidth={0}
      flexShrink={1}
      borderRadius="$2"
      bg={current ? currentBackground : 'transparent'}
      transition={reduceMotion ? undefined : 'quick'}
      animateOnly={ANIMATE_BACKGROUND}
      outlineColor={showFocus ? focusColor : undefined}
      outlineWidth={showFocus ? 2 : 0}
      outlineStyle={showFocus ? 'solid' : undefined}
      outlineOffset={-2}
    >
      <StepIndicatorMark
        index={index}
        status={step.status}
        tone={tone}
        currentMarkTextColor={currentMarkTextColor}
        testID={testID ? `${testID}-mark` : undefined}
      />
      <SizableText
        size={current ? '$bodySmMedium' : '$bodySm'}
        color={inverse ? '$whiteA12' : '$text'}
        numberOfLines={1}
        flexShrink={1}
      >
        {step.label}
      </SizableText>
    </XStack>
  );
  if (!onStepPress) {
    return (
      <View
        style={STEP_STYLE}
        testID={testID}
        accessible
        accessibilityLabel={step.accessibilityLabel ?? step.label}
        accessibilityState={accessibilityState}
        aria-current={current ? 'step' : undefined}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      style={STEP_STYLE}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={step.accessibilityLabel ?? step.label}
      accessibilityState={accessibilityState}
      aria-current={current ? 'step' : undefined}
      aria-disabled={step.disabled}
      disabled={step.disabled}
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {content}
    </Pressable>
  );
}

export function StepIndicator({
  steps,
  onStepPress,
  tone = 'default',
  currentMarkTextColor,
  testID,
}: IStepIndicatorProps) {
  const inverse = tone === 'inverse';
  return (
    <XStack alignItems="center" width="100%" testID={testID}>
      {steps.map((step, index) => {
        const completedConnector =
          index > 0 && steps[index - 1].status === 'done';
        const connectorBackground = inverse ? '$whiteA4' : '$borderSubdued';
        const completedBackground = inverse ? '$whiteA8' : '$borderActive';
        return (
          <Fragment key={step.id}>
            {index > 0 ? (
              <Stack
                flex={1}
                minWidth="$2"
                height={1}
                mx="$1"
                bg={
                  completedConnector ? completedBackground : connectorBackground
                }
              />
            ) : null}
            <StepIndicatorSegment
              step={step}
              index={index}
              tone={tone}
              currentMarkTextColor={currentMarkTextColor}
              onStepPress={onStepPress}
              testID={testID ? `${testID}-step-${step.id}` : undefined}
            />
          </Fragment>
        );
      })}
    </XStack>
  );
}
