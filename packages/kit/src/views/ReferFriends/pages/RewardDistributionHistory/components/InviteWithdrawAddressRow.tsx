import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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
