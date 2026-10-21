import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { buildHardwareShopInviteUrl } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/referralLinks';

export function useHardwareShopInviteUrl() {
  const { result: inviteUrl, isLoading } = usePromiseResult(
    async () => {
      try {
        const summary =
          await backgroundApiProxy.serviceReferralCode.getSummaryInfo();
        return summary?.inviteUrl ?? '';
      } catch {
        return '';
      }
    },
    [],
    {
      initResult: '',
      watchLoading: true,
    },
  );

  const shopInviteUrl = inviteUrl ? buildHardwareShopInviteUrl(inviteUrl) : '';

  return {
    shopInviteUrl,
    isReady: Boolean(shopInviteUrl) || isLoading === false,
  };
}
