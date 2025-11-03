import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function UpgradeProgressTitle() {
  const intl = useIntl();

  return (
    <YStack gap="$2">
      <SizableText size="$heading3xl" color="$text">
        {intl.formatMessage({ id: ETranslations.referral_upgrade_progress })}
      </SizableText>
    </YStack>
  );
}
