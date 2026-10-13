import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Skeleton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useNavigateToEditAddress } from '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { shortenPayoutAddress } from '../../../utils/shortenPayoutAddress';
import { openInviteWithdrawAddressEditor } from '../openInviteWithdrawAddressEditor';

export function InviteWithdrawAddressRow() {
  const intl = useIntl();
  const navigateToEditAddress = useNavigateToEditAddress();
  const {
    result: summaryInfo,
    run: fetchSummaryInfo,
    isLoading,
  } = usePromiseResult(
    async () => backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
    [],
    {
      undefinedResultIfError: true,
      revalidateOnFocus: true,
      watchLoading: true,
    },
  );

  const toEditAddressPage = useCallback(() => {
    if (!summaryInfo) {
      return;
    }
    openInviteWithdrawAddressEditor({
      summaryInfo,
      navigateToEditAddress,
      fetchSummaryInfo,
      formatMessage: (descriptor) => intl.formatMessage(descriptor),
    });
  }, [fetchSummaryInfo, intl, navigateToEditAddress, summaryInfo]);

  const title = intl.formatMessage({
    id: ETranslations.referral_reward_received_address,
  });

  if (!summaryInfo) {
    // This row is the payout list's header. Hold its height while loading so
    // the list below doesn't shift when the address arrives; `isLoading` is
    // undefined until the first request starts.
    return isLoading === false ? null : (
      <ListItem title={title} subtitle={<Skeleton.BodyMd w={120} />} drillIn />
    );
  }

  const withdrawAddress = summaryInfo.withdrawAddresses[0];

  return (
    <ListItem
      testID={ReferFriendsTestIDs.inviteWithdrawAddressRow}
      title={title}
      subtitle={
        withdrawAddress
          ? shortenPayoutAddress(withdrawAddress.address)
          : intl.formatMessage({
              id: ETranslations.referral_reward_received_address_notset,
            })
      }
      drillIn
      onPress={toEditAddressPage}
    />
  );
}
