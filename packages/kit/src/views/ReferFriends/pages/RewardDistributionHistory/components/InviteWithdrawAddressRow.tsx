import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useNavigateToEditAddress } from '@onekeyhq/kit/src/views/ReferFriends/pages/EditAddress/hooks/useNavigateToEditAddress';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { ReferFriendsTestIDs } from '../../../testIDs';
import { openInviteWithdrawAddressEditor } from '../openInviteWithdrawAddressEditor';

export function InviteWithdrawAddressRow() {
  const intl = useIntl();
  const navigateToEditAddress = useNavigateToEditAddress();
  const { result: summaryInfo, run: fetchSummaryInfo } = usePromiseResult(
    async () => backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
    [],
    {
      undefinedResultIfError: true,
      revalidateOnFocus: true,
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

  if (!summaryInfo) {
    return null;
  }

  const withdrawAddress = summaryInfo.withdrawAddresses[0];

  return (
    <ListItem
      testID={ReferFriendsTestIDs.inviteWithdrawAddressRow}
      title={intl.formatMessage({
        id: ETranslations.referral_reward_received_address,
      })}
      subtitle={
        withdrawAddress
          ? accountUtils.shortenAddress({ address: withdrawAddress.address })
          : intl.formatMessage({
              id: ETranslations.referral_reward_received_address_notset,
            })
      }
      drillIn
      onPress={toEditAddressPage}
    />
  );
}
