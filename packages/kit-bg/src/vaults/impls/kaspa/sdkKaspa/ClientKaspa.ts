import type {
  IKaspaBlockTransaction,
  IKaspaGetBlockResponse,
  IKaspaGetTransactionResponse,
} from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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

  // Bounds a request so a slow upstream can't stall signing; chained calls share
  // one deadline instead of each holding their own.
  private async withDeadline<T>(
    label: string,
    deadline: number,
    run: () => Promise<T>,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        run(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new OneKeyLocalError(`kaspa ${label} timeout`)),
            Math.max(0, deadline - Date.now()),
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private static defaultDeadline() {
    return Date.now() + timerUtils.getTimeDurationMs({ seconds: 30 });
  }

  // Batch-fetches txs via REST search — one request for all txids instead of
  // one GET each.
  async getTransactions(
    txids: string[],
    deadline: number = ClientKaspa.defaultDeadline(),
  ): Promise<IKaspaGetTransactionResponse[]> {
    const [txs = []] = await this.withDeadline(
      'getTransactions',
      deadline,
      () =>
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
    );
    return txs;
  }

  // Search resolves txid -> block (the only endpoint with a txid index); the
  // block then fills in the fields search lacks — 2 round trips total.
  async getRefTransactions(
    txids: string[],
  ): Promise<Map<string, IKaspaBlockTransaction>> {
    const deadline = ClientKaspa.defaultDeadline();
    const searched = await this.getTransactions(txids, deadline);

    const blockHashByTxid = new Map<string, string>();
    for (const tx of searched) {
      // Any block containing the tx carries identical transaction bytes; the
      // first is enough.
      const blockHash = tx?.block_hash?.[0];
      if (tx?.transaction_id && blockHash) {
        blockHashByTxid.set(tx.transaction_id.toLowerCase(), blockHash);
      }
    }
    const blockHashes = Array.from(new Set(blockHashByTxid.values()));
    if (blockHashes.length === 0) {
      return new Map();
    }

    const blocks = await this.withDeadline('getRefTransactions', deadline, () =>
      this.backgroundApi.serviceAccountProfile.sendProxyRequest<IKaspaGetBlockResponse>(
        {
          networkId: this.networkId,
          body: blockHashes.map((blockHash) => ({
            route: 'rpc',
            params: {
              method: 'GET',
              url: `/blocks/${blockHash}?includeTransactions=true`,
              params: [],
            },
          })),
        },
      ),
    );

    const result = new Map<string, IKaspaBlockTransaction>();
    for (const block of blocks ?? []) {
      for (const tx of block?.transactions ?? []) {
        const txid = tx?.verboseData?.transactionId?.toLowerCase();
        if (txid && blockHashByTxid.has(txid)) {
          result.set(txid, tx);
        }
      }
    }
    return result;
  }
}
