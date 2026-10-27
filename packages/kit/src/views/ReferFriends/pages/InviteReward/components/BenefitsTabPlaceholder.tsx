import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ReferralCardEmpty } from '../../../components/ReferralCardEmpty';
import { ReferFriendsTestIDs } from '../../../testIDs';

import { useInviteHomeCardStyle } from './useInviteCardStyle';

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
  const { result, run: refresh } = usePromiseResult(
    async () => ({
      walletId,
      status: await getReferralCodeBindDisplayStatus({ walletId }),
    }),
    [getReferralCodeBindDisplayStatus, walletId],
    { undefinedResultIfReRun: true },
  );
  // The previous wallet's status can linger for a render after a switch.
  // Both sides can be missing: a failed wallet lookup leaves `walletId`
  // undefined while a rerun clears `result`. Comparing those two undefined
  // values must not read `.status`.
  const status =
    result !== undefined && result.walletId === walletId
      ? result.status
      : undefined;

  const t = (id: ETranslations) => intl.formatMessage({ id });
  let content: Pick<
    ComponentProps<typeof ReferralCardEmpty>,
    'title' | 'description' | 'buttonProps'
  >;
  switch (status) {
    // Nothing to offer until the status is known, so the code button does
    // not flash for a wallet that cannot use it.
    case undefined:
      content = { title: t(ETranslations.referral_perks_empty__title) };
      break;
    case 'unsupported':
      content = { title: t(ETranslations.referral_not_applicable) };
      break;
    case 'bound':
      content = {
        title: t(ETranslations.referral_perks_empty__title),
        description: t(ETranslations.referral_no_reward),
      };
      break;
    case 'notApplicable':
      content = {
        title: t(ETranslations.referral_perks_empty__title),
        description: t(ETranslations.referral_not_applicable_desc),
      };
      break;
    // 'bind', or 'unknown' when the server check failed: offering the code
    // keeps the way in open, and the dialog re-checks before binding.
    default:
      content = {
        title: t(ETranslations.referral_perks_empty__title),
        description: t(ETranslations.referral_perks_empty__desc),
        buttonProps: {
          testID: ReferFriendsTestIDs.benefitsBindBtn,
          variant: 'secondary',
          size: 'small',
          mt: '$4',
          children: t(ETranslations.referral_enter_code__action),
          onPress: () => {
            bindWalletInviteCode({
              source: 'perks_empty',
              preferredWalletId: walletId,
              onSuccess: () => {
                void refresh();
              },
            });
          },
        },
      };
  }

  return (
    <ReferralCardEmpty
      testID={ReferFriendsTestIDs.benefitsPlaceholder}
      {...cardStyle}
      {...content}
    />
  );
}
