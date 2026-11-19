import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useNavigateToEditAddress } from '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteSummary } from '@onekeyhq/shared/src/referralCode/type';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { shortenPayoutAddress } from '../../../utils/shortenPayoutAddress';
import { openInviteWithdrawAddressEditor } from '../openInviteWithdrawAddressEditor';

export function InviteWithdrawAddressRow({
  summaryInfo,
  fetchSummaryInfo,
}: {
  summaryInfo: IInviteSummary;
  fetchSummaryInfo: () => unknown;
}) {
  const intl = useIntl();
  const navigateToEditAddress = useNavigateToEditAddress();

  const toEditAddressPage = useCallback(() => {
    openInviteWithdrawAddressEditor({
      summaryInfo,
      navigateToEditAddress,
      fetchSummaryInfo,
      formatMessage: (descriptor) => intl.formatMessage(descriptor),
    });
  }, [fetchSummaryInfo, intl, navigateToEditAddress, summaryInfo]);

  const withdrawAddress = summaryInfo.withdrawAddresses[0];

  return (
    <ListItem
      testID={ReferFriendsTestIDs.inviteWithdrawAddressRow}
      title={intl.formatMessage({
        id: ETranslations.referral_reward_received_address,
      })}
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

// Loads its own summary and refreshes it when the page regains focus. Native
// passes the summary in instead so the list can mount with its final header.
export function InviteWithdrawAddressRowWithSummary() {
  const { result: summaryInfo, run: fetchSummaryInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
    [],
    {
      undefinedResultIfError: true,
      revalidateOnFocus: true,
    },
  );

  if (!summaryInfo) {
    return null;
  }

  return (
    <InviteWithdrawAddressRow
      summaryInfo={summaryInfo}
      fetchSummaryInfo={fetchSummaryInfo}
    />
  );
}
