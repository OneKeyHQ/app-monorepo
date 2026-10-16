import { useIntl } from 'react-intl';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferralCardEmpty } from '../../../components/ReferralCardEmpty';
import { ReferFriendsTestIDs } from '../../../testIDs';

import { useInviteHomeCardStyle } from './useInviteCardStyle';

// The Perks tab before it has content: why it is empty and the one action
// that fills it, entering the referral code the user was invited with. It
// sits under the rewards section title, so it takes the same in-card empty
// state as the invite tab's empty rewards breakdown.
export function BenefitsTabPlaceholder() {
  const intl = useIntl();
  const cardStyle = useInviteHomeCardStyle();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { bindWalletInviteCode } = useWalletBoundReferralCode({
    entry: platformEnv.isNative ? 'modal' : 'tab',
  });
  return (
    <ReferralCardEmpty
      testID={ReferFriendsTestIDs.benefitsPlaceholder}
      {...cardStyle}
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
          bindWalletInviteCode({
            source: 'invite_home',
            preferredWalletId: activeAccount?.wallet?.id,
          });
        },
      }}
    />
  );
}
