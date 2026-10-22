import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { buildHardwareShopInviteUrl } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/referralLinks';

export function useHardwareShopInviteUrl() {
  const { result: inviteUrl, isLoading } = usePromiseResult(
    async () => {
      const summary =
        await backgroundApiProxy.serviceReferralCode.getSummaryInfo();
      return summary.inviteUrl;
    },
    [],
    {
      initResult: '',
      keepResultIfError: true,
      watchLoading: true,
    },
  );

  return {
    shopInviteUrl: buildHardwareShopInviteUrl(inviteUrl),
    isReady: isLoading === false,
  };
}
