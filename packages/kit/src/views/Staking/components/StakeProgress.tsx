import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function StakeProgress({ currentStep }: { currentStep: number }) {
  const intl = useIntl();
  return (
    <XStack gap="$1" ai="center">
      <SizableText size="$bodyMdMedium">
        1. {intl.formatMessage({ id: ETranslations.global_approve })}
      </SizableText>
      <Icon
        name="ArrowRightOutline"
        size="$4"
        color={currentStep > 1 ? '$icon' : '$iconSubdued'}
      />
      <SizableText
        size="$bodyMdMedium"
        color={currentStep > 1 ? undefined : '$textDisabled'}
      >
        2. {intl.formatMessage({ id: ETranslations.earn_supply })}
      </SizableText>
    </XStack>
  );
}
