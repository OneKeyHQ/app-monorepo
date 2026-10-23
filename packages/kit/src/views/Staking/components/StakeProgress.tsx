import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EApproveType } from '@onekeyhq/shared/types/staking';

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

const CHECK_ENTER = { opacity: 0 } as const;

// After a step's label: a check once done, a spinner while it runs
function StepStatus({ done, running }: { done: boolean; running: boolean }) {
  if (done) {
    return (
      <Stack
        // Keyed apart from the spinner's stack, which uses other hooks
        key="done"
        transition="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
        enterStyle={CHECK_ENTER}
      >
        <Icon name="CheckRadioOutline" size="$4" color="$iconSuccess" />
      </Stack>
    );
  }
  if (running) {
    return (
      <Stack key="running" w="$4" h="$4" ai="center" jc="center">
        <Spinner size="small" color="$iconSubdued" scale={0.8} />
      </Stack>
    );
  }
  return null;
}

export enum EStakeProgressStep {
  approve = 1,
  deposit = 2,
  unstake = 3,
}

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
  const isStep1Done = currentStep >= EStakeProgressStep.deposit;
  const isStep2Done = currentStep >= EStakeProgressStep.unstake;
  const hasStep3 = !!step3LabelId;
  const step2Color = useMemo(() => {
    if (isStep2Done) return '$textSuccess' as const;
    if (isStep1Done) return undefined;
    return '$textDisabled' as const;
  }, [isStep2Done, isStep1Done]);
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
  return (
    <XStack gap="$1" ai="center" flexWrap="wrap">
      <XStack ai="center" gap="$1.5">
        <SizableText
          size="$bodyMdMedium"
          color={isStep1Done ? '$textSuccess' : undefined}
        >
          1. {resolvedStep1Label}
        </SizableText>
        <StepStatus done={isStep1Done} running={isRunning} />
      </XStack>
      <Icon
        name="ArrowRightOutline"
        size="$4"
        color={isStep1Done ? '$icon' : '$iconSubdued'}
      />
      <XStack ai="center" gap="$1.5">
        <SizableText size="$bodyMdMedium" color={step2Color}>
          2. {resolvedStep2Label}
        </SizableText>
        <StepStatus done={isStep2Done} running={isRunning && isStep1Done} />
      </XStack>
      {hasStep3 ? (
        <>
          <Icon
            name="ArrowRightOutline"
            size="$4"
            color={isStep2Done ? '$icon' : '$iconSubdued'}
          />
          <XStack ai="center" gap="$1.5">
            <SizableText
              size="$bodyMdMedium"
              color={isStep2Done ? undefined : '$textDisabled'}
            >
              3. {intl.formatMessage({ id: step3LabelId })}
            </SizableText>
            <StepStatus done={false} running={isRunning && isStep2Done} />
          </XStack>
        </>
      ) : null}
    </XStack>
  );
}
