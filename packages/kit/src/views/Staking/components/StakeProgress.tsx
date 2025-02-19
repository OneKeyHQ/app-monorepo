import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IStakeProgressProps {
  /** Current step in the staking process (1 or 2) */
  currentStep: number;
}

export enum EStakeProgressStep {
  approve = 1,
  deposit = 2,
}

export function StakeProgress({ currentStep }: IStakeProgressProps) {
  const intl = useIntl();
  const isDepositStep = currentStep === EStakeProgressStep.deposit;
  return (
    <XStack gap="$1" ai="center">
      <XStack ai="center" gap="$1.5">
        <SizableText
          size="$bodyMdMedium"
          color={isDepositStep ? '$textSuccess' : undefined}
        >
          1. {intl.formatMessage({ id: ETranslations.global_approve })}
        </SizableText>
        {isDepositStep ? (
          <Icon name="CheckRadioOutline" size="$4" color="$iconSuccess" />
        ) : null}
      </XStack>
      <Icon
        name="ArrowRightOutline"
        size="$4"
        color={isDepositStep ? '$icon' : '$iconSubdued'}
      />
      <SizableText
        size="$bodyMdMedium"
        color={isDepositStep ? undefined : '$textDisabled'}
      >
        2. {intl.formatMessage({ id: ETranslations.earn_deposit })}
      </SizableText>
    </XStack>
  );
}
