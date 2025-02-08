import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IStakeProgressProps {
  /** Current step in the staking process (1 or 2) */
  currentStep: number;
}

export enum EStakeProgressStep {
  approve = 1,
  supply = 2,
}

export function StakeProgress({ currentStep }: IStakeProgressProps) {
  const intl = useIntl();
  return (
    <XStack gap="$1" ai="center">
      <SizableText size="$bodyMdMedium">
        1. {intl.formatMessage({ id: ETranslations.global_approve })}
      </SizableText>
      <Icon
        name="ArrowRightOutline"
        size="$4"
        color={
          currentStep > EStakeProgressStep.approve ? '$icon' : '$iconSubdued'
        }
      />
      <SizableText
        size="$bodyMdMedium"
        color={
          currentStep > EStakeProgressStep.approve ? undefined : '$textDisabled'
        }
      >
        2. {intl.formatMessage({ id: ETranslations.earn_supply })}
      </SizableText>
    </XStack>
  );
}
