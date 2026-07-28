import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IChainValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export const getAccountIdOnNetwork = async ({
  account,
  network,
}: {
  account?: INetworkAccount;
  network: IChainValue['network'];
}) => {
  if (account?.indexedAccountId) {
    const { accounts } =
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: account?.indexedAccountId ?? '',
        },
      );
    const networkAccount = accounts.find((item) => item.impl === network?.impl);
    if (networkAccount) {
      return networkAccount.id;
    }
    // need create account on network
    if (account?.id) {
      const newAccount =
        await backgroundApiProxy.serviceAccount.createAddressIfNotExists(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: account?.id || '',
            }),
            networkId: network?.id || '',
            accountId: account?.id,
            indexedAccountId: account.indexedAccountId,
          },
          {
            allowWatchAccount: false,
          },
        );
      return newAccount?.id;
    }
  }
};
