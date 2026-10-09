import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';

// The Perks tab before it has content: why it is empty and the one action
// that fills it, entering the referral code the user was invited with.
export function BenefitsTabPlaceholder() {
  const intl = useIntl();
  const { bindWalletInviteCode } = useWalletBoundReferralCode({
    entry: platformEnv.isNative ? 'modal' : 'tab',
  });
  return (
    <YStack
      testID={ReferFriendsTestIDs.benefitsPlaceholder}
      flex={1}
      px="$pagePadding"
      py="$10"
    >
      <Empty
        icon="GiftOutline"
        title={intl.formatMessage({
          id: ETranslations.referral_perks_empty__title,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_perks_empty__desc,
        })}
        buttonProps={{
          testID: ReferFriendsTestIDs.benefitsBindBtn,
          variant: 'secondary',
          size: 'small',
          mt: '$4',
          children: intl.formatMessage({
            id: ETranslations.referral_enter_code__action,
          }),
          onPress: () => {
            bindWalletInviteCode({ source: 'invite_home' });
          },
        }}
      />
    </YStack>
  );
}
