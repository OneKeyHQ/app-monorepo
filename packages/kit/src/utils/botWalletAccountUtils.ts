import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export async function isAccountIdDeactivatedBotWallet({
  accountId,
}: {
  accountId?: string;
}): Promise<boolean> {
  if (!accountId) {
    return false;
  }
  const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
  if (!accountUtils.isBotWallet({ walletId })) {
    return false;
  }
  return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
    walletId,
  });
}
