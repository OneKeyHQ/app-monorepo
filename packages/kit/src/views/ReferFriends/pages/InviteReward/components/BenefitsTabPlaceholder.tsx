import { useIntl } from 'react-intl';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useGetReferralCodeWalletInfo,
  useWalletBoundReferralCode,
} from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import type { IReferralBindDisplayStatus } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/referralBindStatusUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferralCardEmpty } from '../../../components/ReferralCardEmpty';
import { ReferFriendsTestIDs } from '../../../testIDs';

import { useInviteHomeCardStyle } from './useInviteCardStyle';

// 'unsupported': a wallet that cannot take a referral code at all (QR,
// watch-only, imported, external, hidden hardware).
type IBenefitsWalletStatus = IReferralBindDisplayStatus | 'unsupported';

function useBenefitsWalletStatus({
  walletId,
  getReferralCodeBindDisplayStatus,
}: {
  walletId: string | undefined;
  getReferralCodeBindDisplayStatus: ReturnType<
    typeof useWalletBoundReferralCode
  >['getReferralCodeBindDisplayStatus'];
}) {
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();
  const { result, run } = usePromiseResult(
    async (): Promise<{
      walletId: string | undefined;
      status: IBenefitsWalletStatus;
    }> => {
      const walletInfo = await getReferralCodeWalletInfo(walletId);
      if (!walletInfo) {
        return { walletId, status: 'unsupported' };
      }
      const status = await getReferralCodeBindDisplayStatus({ walletId });
      return { walletId, status };
    },
    [getReferralCodeBindDisplayStatus, getReferralCodeWalletInfo, walletId],
    { undefinedResultIfReRun: true },
  );
  // The previous wallet's status can linger for a render after a switch.
  const status = result?.walletId === walletId ? result.status : undefined;
  return { status, refresh: run };
}

// The Perks tab before it has content. A wallet that can still take a
// referral code is asked for one; a wallet that already has one, can no
// longer take one, or never could, only says there is nothing yet, since the
// code dialog could only bind some other wallet.
export function BenefitsTabPlaceholder() {
  const intl = useIntl();
  const cardStyle = useInviteHomeCardStyle();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const walletId = activeAccount?.wallet?.id;
  const { bindWalletInviteCode, getReferralCodeBindDisplayStatus } =
    useWalletBoundReferralCode({
      entry: platformEnv.isNative ? 'modal' : 'tab',
    });
  const { status, refresh } = useBenefitsWalletStatus({
    walletId,
    getReferralCodeBindDisplayStatus,
  });

  const emptyTitle = intl.formatMessage({
    id: ETranslations.referral_perks_empty__title,
  });

  // Nothing to offer until the status is known, so the code button does not
  // flash for a wallet that cannot use it.
  if (status === undefined) {
    return (
      <ReferralCardEmpty
        testID={ReferFriendsTestIDs.benefitsPlaceholder}
        {...cardStyle}
        title={emptyTitle}
      />
    );
  }

  if (status === 'unsupported') {
    return (
      <ReferralCardEmpty
        testID={ReferFriendsTestIDs.benefitsPlaceholder}
        {...cardStyle}
        title={intl.formatMessage({
          id: ETranslations.referral_not_applicable,
        })}
      />
    );
  }

  if (status === 'bound' || status === 'notApplicable') {
    return (
      <ReferralCardEmpty
        testID={ReferFriendsTestIDs.benefitsPlaceholder}
        {...cardStyle}
        title={emptyTitle}
        description={intl.formatMessage({
          id:
            status === 'bound'
              ? ETranslations.referral_no_reward
              : ETranslations.referral_not_applicable_desc,
        })}
      />
    );
  }

  // 'bind', or 'unknown' when the server check failed: offering the code
  // keeps the way in open, and the dialog re-checks before binding.
  return (
    <ReferralCardEmpty
      testID={ReferFriendsTestIDs.benefitsPlaceholder}
      {...cardStyle}
      title={emptyTitle}
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
            source: 'perks_empty',
            preferredWalletId: walletId,
            onSuccess: () => {
              void refresh();
            },
          });
        },
      }}
    />
  );
}
