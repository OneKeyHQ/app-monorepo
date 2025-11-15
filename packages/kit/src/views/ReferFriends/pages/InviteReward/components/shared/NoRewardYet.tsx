import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function NoRewardYet() {
  const intl = useIntl();
  return (
    <XStack pt="$4" gap="$2.5" ai="center">
      <XStack>
        <Icon size="$4" name="GiftOutline" color="$iconSubdued" />
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.referral_no_reward })}
      </SizableText>
    </XStack>
  );
}
