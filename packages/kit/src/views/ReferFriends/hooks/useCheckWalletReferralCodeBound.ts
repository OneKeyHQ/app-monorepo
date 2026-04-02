import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useWalletBoundReferralCode } from './useWalletBoundReferralCode';

export function useCheckWalletReferralCodeBound({
  walletId,
}: {
  walletId: string | undefined;
}) {
  const { getReferralCodeBondStatus } = useWalletBoundReferralCode({
    entry: 'modal',
  });

  const {
    result,
    isLoading: isLoadingReferralCodeButton,
    run: refreshReferralCodeStatus,
  } = usePromiseResult(
    async () => {
      if (!walletId) {
        return { shouldBound: false, isSupported: false };
      }

      // Quick check: Only HD and hardware wallets support referral code binding
      const isHdWallet = accountUtils.isHdWallet({ walletId });
      const isHwWallet = accountUtils.isHwWallet({ walletId });

      if (!isHdWallet && !isHwWallet) {
        return { shouldBound: false, isSupported: false };
      }

      // Get wallet object to check if it's a hidden wallet
      let wallet;
      try {
        wallet = await backgroundApiProxy.serviceAccount.getWallet({
          walletId,
        });
      } catch (error) {
        console.error('Failed to get wallet:', error);
        return { shouldBound: false, isSupported: false };
      }

      // Hidden wallets (passphrase) are not supported
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return { shouldBound: false, isSupported: false };
      }

      // Mocked wallets (removed hardware wallets) are not supported
      if (wallet.isMocked) {
        return { shouldBound: false, isSupported: false };
      }

      // Wallet is supported (HD or non-hidden, non-mocked hardware wallet)
      const isSupported = true;

      // Check local database
      const referralCodeInfo =
        await backgroundApiProxy.serviceReferralCode.getWalletReferralCode({
          walletId,
        });

      if (!referralCodeInfo) {
        // No local record, check with server
        // getReferralCodeBondStatus will save the result to local DB
        const shouldBound = await getReferralCodeBondStatus({ walletId });
        return { shouldBound, isSupported };
      }

      // Has local record, check if binding is needed
      const shouldBound = Boolean(
        referralCodeInfo.walletId && !referralCodeInfo.isBound,
      );
      return { shouldBound, isSupported };
    },
    [walletId, getReferralCodeBondStatus],
    {
      initResult: { shouldBound: false, isSupported: false },
      watchLoading: true,
    },
  );

  return {
    shouldBoundReferralCode: result?.shouldBound ?? false,
    isLoadingReferralCodeButton,
    refreshReferralCodeStatus,
    isWalletSupported: result?.isSupported ?? false,
  };
}
