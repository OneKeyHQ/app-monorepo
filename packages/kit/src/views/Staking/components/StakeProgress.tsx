import { Fragment, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import Svg, { Line } from 'react-native-svg';

import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  useTheme,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import type { LayoutChangeEvent } from 'react-native';

interface IStakeProgressProps {
  /** Current step in the staking process (1, 2, or 3) */
  currentStep: number;
  approveType?: EApproveType;
  /** Override the step 1 label with already formatted text */
  step1Label?: string;
  /** Override the step 1 label */
  step1LabelId?: ETranslations;
  /** Override the step 2 label with already formatted text */
  step2Label?: string;
  /** Override the step 2 label (e.g. "Swap" for Pendle) */
  step2LabelId?: ETranslations;
  /** Optional step 3 label — when provided, renders a 3-step indicator */
  step3LabelId?: ETranslations;
  /** A step is under way: the current one spins until it is done */
  isRunning?: boolean;
}

type IStepState = 'todo' | 'next' | 'running' | 'done';

const MARK_SIZE = 20;
const RING_SIZE = 16;
const LINE_HEIGHT = 2;
const DASH = '4 4';
const FADE_IN = { opacity: 0 } as const;

// Each step's mark, in the marks of Swap's order progress: a ring still to
// come (stronger for the one the press starts with), a spinner while it
// runs, a green check once done. Keyed apart, so a change fades in
function StepMark({ state }: { state: IStepState }) {
  let mark;
  if (state === 'done') {
    mark = <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />;
  } else if (state === 'running') {
    mark = <Spinner size="small" color="$iconSubdued" scale={0.8} />;
  } else {
    mark = (
      <Stack
        w={RING_SIZE}
        h={RING_SIZE}
        borderRadius="$full"
        borderWidth={2}
        borderColor={state === 'next' ? '$iconSubdued' : '$iconDisabled'}
      />
    );
  }
  return (
    <Stack
      key={state === 'todo' || state === 'next' ? 'ring' : state}
      w={MARK_SIZE}
      h={MARK_SIZE}
      ai="center"
      jc="center"
      flexShrink={0}
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      enterStyle={FADE_IN}
    >
      {mark}
    </Stack>
  );
}

// Between two steps: dashed while the one before is still to do, a solid
// green line once it is done, the way traveled
function StepLine({ isTraveled }: { isTraveled: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);
  return (
    <Stack
      flex={1}
      minWidth="$4"
      h={MARK_SIZE}
      jc="center"
      onLayout={handleLayout}
    >
      {isTraveled ? (
        <Stack
          key="traveled"
          h={LINE_HEIGHT}
          borderRadius="$full"
          bg="$borderSuccess"
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={FADE_IN}
        />
      ) : null}
      {!isTraveled && width > 0 ? (
        <Svg width={width} height={LINE_HEIGHT}>
          <Line
            x1={1}
            y1={LINE_HEIGHT / 2}
            x2={width - 1}
            y2={LINE_HEIGHT / 2}
            stroke={theme.borderStrong.val}
            strokeWidth={LINE_HEIGHT}
            strokeDasharray={DASH}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </Stack>
  );
}

export { EStakeProgressStep } from './stakeProgressStep';

/**
 * The steps one press runs, over the button that names them ("Swap and
 * Deposit", "Approve and Supply"): spread across the form's width, the
 * first at its left edge and the last at its right, a line between each.
 * Shown before the press as well, the step it starts with marked
 */
export function StakeProgress({
  currentStep,
  approveType,
  step1Label,
  step1LabelId,
  step2Label,
  step2LabelId,
  step3LabelId,
  isRunning = false,
}: IStakeProgressProps) {
  const intl = useIntl();
  const resolvedStep1Label = useMemo(() => {
    if (step1Label) {
      return step1Label;
    }

    let labelId = step1LabelId;
    if (!labelId && approveType) {
      labelId =
        approveType === EApproveType.Permit
          ? ETranslations.earn_approve_permit
          : ETranslations.global_approve;
    }

    return labelId ? intl.formatMessage({ id: labelId }) : undefined;
  }, [approveType, intl, step1Label, step1LabelId]);

  const resolvedStep2Label = useMemo(
    () =>
      step2Label ||
      intl.formatMessage({
        id: step2LabelId ?? ETranslations.earn_deposit,
      }),
    [intl, step2Label, step2LabelId],
  );

  if (!resolvedStep1Label) {
    return null;
  }
  const labels = [
    resolvedStep1Label,
    resolvedStep2Label,
    ...(step3LabelId ? [intl.formatMessage({ id: step3LabelId })] : []),
  ];
  const getState = (step: number): IStepState => {
    if (step < currentStep) {
      return 'done';
    }
    if (step === currentStep) {
      return isRunning ? 'running' : 'next';
    }
    return 'todo';
  };
  return (
    <XStack testID="earn-step-path" ai="center" gap="$2">
      {labels.map((label, index) => {
        const step = index + 1;
        const state = getState(step);
        return (
          <Fragment key={step}>
            {index > 0 ? (
              <StepLine isTraveled={step - 1 < currentStep} />
            ) : null}
            <XStack
              testID={`earn-step-path-${step}-${state}`}
              ai="center"
              gap="$1.5"
              flexShrink={0}
            >
              <StepMark state={state} />
              <SizableText
                size="$bodyMdMedium"
                color={
                  state === 'next' || state === 'running'
                    ? '$text'
                    : '$textSubdued'
                }
                numberOfLines={1}
              >
                {label}
              </SizableText>
            </XStack>
          </Fragment>
        );
      })}
    </XStack>
  );
}
