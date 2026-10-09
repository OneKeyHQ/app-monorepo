import { Empty, YStack } from '@onekeyhq/components';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { INVITE_COPY } from '../inviteCopy';

// The Perks tab before it has content: why it is empty and the one action
// that fills it, entering the referral code the user was invited with.
export function BenefitsTabPlaceholder() {
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
        title={INVITE_COPY.perksEmptyTitle}
        description={INVITE_COPY.perksEmptyDescription}
        buttonProps={{
          testID: ReferFriendsTestIDs.benefitsBindBtn,
          variant: 'secondary',
          size: 'small',
          mt: '$4',
          children: INVITE_COPY.enterReferralCode,
          onPress: () => {
            bindWalletInviteCode({ source: 'invite_home' });
          },
        }}
      />
    </YStack>
  );
}
