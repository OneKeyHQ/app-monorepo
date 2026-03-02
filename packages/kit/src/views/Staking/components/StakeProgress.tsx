import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EApproveType } from '@onekeyhq/shared/types/staking';

interface IStakeProgressProps {
  /** Current step in the staking process (1, 2, or 3) */
  currentStep: number;
  approveType?: EApproveType;
  /** Override the step 2 label (e.g. "Swap" for Pendle) */
  step2LabelId?: ETranslations;
  /** Optional step 3 label — when provided, renders a 3-step indicator */
  step3LabelId?: ETranslations;
}

export enum EStakeProgressStep {
  approve = 1,
  deposit = 2,
  unstake = 3,
}

export function StakeProgress({
  currentStep,
  approveType,
  step2LabelId,
  step3LabelId,
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
  if (!approveType) {
    return null;
  }
  return (
    <XStack gap="$1" ai="center" flexWrap="wrap">
      <XStack ai="center" gap="$1.5">
        <SizableText
          size="$bodyMdMedium"
          color={isStep1Done ? '$textSuccess' : undefined}
        >
          1.{' '}
          {intl.formatMessage({
            id:
              approveType === EApproveType.Permit
                ? ETranslations.earn_approve_permit
                : ETranslations.global_approve,
          })}
        </SizableText>
        {isStep1Done ? (
          <Icon name="CheckRadioOutline" size="$4" color="$iconSuccess" />
        ) : null}
      </XStack>
      <Icon
        name="ArrowRightOutline"
        size="$4"
        color={isStep1Done ? '$icon' : '$iconSubdued'}
      />
      <XStack ai="center" gap="$1.5">
        <SizableText size="$bodyMdMedium" color={step2Color}>
          2.{' '}
          {intl.formatMessage({
            id: step2LabelId ?? ETranslations.earn_deposit,
          })}
        </SizableText>
        {isStep2Done ? (
          <Icon name="CheckRadioOutline" size="$4" color="$iconSuccess" />
        ) : null}
      </XStack>
      {hasStep3 ? (
        <>
          <Icon
            name="ArrowRightOutline"
            size="$4"
            color={isStep2Done ? '$icon' : '$iconSubdued'}
          />
          <SizableText
            size="$bodyMdMedium"
            color={isStep2Done ? undefined : '$textDisabled'}
          >
            3. {intl.formatMessage({ id: step3LabelId })}
          </SizableText>
        </>
      ) : null}
    </XStack>
  );
}
