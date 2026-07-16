import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IKaspaGetTransactionResponse } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types';

// Proxy-based kaspa REST client: reads go through the OneKey RPC proxy, which is
// network-aware and transparently forwards to the configured kaspa REST endpoint
// (e.g. api.kaspa.org). Mirrors the per-chain client convention (ClientSol etc.).
export class ClientKaspa {
  private networkId: string;

  private backgroundApi: IBackgroundApi;

  constructor({
    networkId,
    backgroundApi,
  }: {
    networkId: string;
    backgroundApi: IBackgroundApi;
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
  }

  // Batch-fetch full transactions by id via the REST search endpoint: one upstream
  // request for all txids (POST body carried by params.data), instead of one GET
  // per txid. Capped at 30s so a slow request can't block the caller (the refTx
  // flow falls back to blind signing on failure).
  async getTransactions(
    txids: string[],
  ): Promise<IKaspaGetTransactionResponse[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const [txs = []] = await Promise.race([
        this.backgroundApi.serviceAccountProfile.sendProxyRequest<
          IKaspaGetTransactionResponse[]
        >({
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'POST',
                url: '/transactions/search?resolve_previous_outpoints=light',
                params: [],
                data: { transactionIds: txids },
              },
            },
          ],
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new OneKeyLocalError('kaspa getTransactions timeout')),
            timerUtils.getTimeDurationMs({ seconds: 30 }),
          );
        }),
      ]);
      return txs;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
