import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function ReferFriendsListHeader() {
  const intl = useIntl();
  return (
    <XStack ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_friends_address,
        })}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_order_reward,
        })}
      </SizableText>
    </XStack>
  );
}
