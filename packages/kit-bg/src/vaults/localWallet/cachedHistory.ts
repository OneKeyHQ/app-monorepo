import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// The rows this device already holds for an account, confirmed and pending.
// A local-wallet chain answers with these when its scanner cannot: returning
// undefined instead sends the account's address to the server history API.
export async function loadCachedLocalWalletHistory({
  backgroundApi,
  networkId,
  accountAddress,
  xpub,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountAddress: string;
  xpub?: string;
}): Promise<IAccountHistoryTx[]> {
  const [confirmed, pending] = await Promise.all([
    backgroundApi.simpleDb.localHistory.getAccountLocalHistoryConfirmedTxs({
      networkId,
      accountAddress,
      xpub,
    }),
    backgroundApi.simpleDb.localHistory.getAccountLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
    }),
  ]);
  return [...confirmed, ...pending];
}
