import type {
  IAllNetworkAccountsInfoResult,
  IAllNetworkAccountsParams,
} from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const ALL_NETWORK_ACCOUNT_CACHE_TTL_MS = 15_000;
const ALL_NETWORK_ACCOUNT_CACHE_MAX_ENTRIES = 100;

type ICacheEntry = {
  createdAt: number;
  settled: boolean;
  walletId?: string;
  promise: Promise<IAllNetworkAccountsInfoResult>;
  rerunPromise?: Promise<IAllNetworkAccountsInfoResult>;
};

interface IAllNetworkAccountRepositoryPort {
  clear(): Promise<void> | void;
  fetch(
    params: IAllNetworkAccountsParams,
  ): Promise<IAllNetworkAccountsInfoResult>;
}

function buildKey(params: IAllNetworkAccountsParams): string {
  return [
    params.accountId,
    params.networkId,
    params.indexedAccountId ?? '',
    params.deriveType ?? '',
    params.nftEnabledOnly ? 'nft' : '',
    params.DeFiEnabledOnly ? 'defi' : '',
    params.includingNonExistingAccount ? 'includeMissing' : '',
    params.includingNotEqualGlobalDeriveTypeAccount ? 'includeDerive' : '',
    params.includingDeriveTypeMismatchInDefaultVisibleNetworks === false
      ? 'strictVisible'
      : 'includeVisibleMismatch',
    params.fetchAllNetworkAccounts ? 'fetchAll' : '',
    params.networksEnabledOnly ? 'enabled' : 'all',
    params.excludeTestNetwork === false ? 'testnet' : 'mainnet',
    params.excludeIncompatibleWithWalletAccounts ? 'compatible' : 'anyWallet',
    params.maxConcurrency ?? '',
  ]
    .map((part) => `${String(part).length}:${String(part)}`)
    .join('|');
}

export class AllNetworkAccountRepository {
  private readonly entries = new Map<string, ICacheEntry>();

  private revision = 0;

  private disposed = false;

  constructor(private readonly port: IAllNetworkAccountRepositoryPort) {}

  get(
    params: IAllNetworkAccountsParams,
    options: {
      force?: boolean;
      skipAccountsCache?: boolean;
      walletId?: string;
    } = {},
  ): Promise<IAllNetworkAccountsInfoResult> {
    if (this.disposed) {
      return Promise.reject(
        new OneKeyLocalError('All-network account repository is disposed'),
      );
    }
    const now = Date.now();
    this.sweep(now);
    const key = buildKey(params);
    const current = this.entries.get(key);
    const force = Boolean(options.force || options.skipAccountsCache);
    if (force && current && !current.settled) {
      if (!current.rerunPromise) {
        const revision = this.revision;
        current.rerunPromise = current.promise
          .catch(() => undefined)
          .then(() => {
            if (this.disposed || revision !== this.revision) {
              throw new OneKeyLocalError(
                'All-network account refresh was invalidated',
              );
            }
            return this.startRequest(key, params, {
              force: true,
              walletId: options.walletId ?? current.walletId,
            });
          });
      }
      return current.rerunPromise;
    }
    if (
      !force &&
      current &&
      now - current.createdAt < ALL_NETWORK_ACCOUNT_CACHE_TTL_MS
    ) {
      this.touch(key, current);
      return current.promise;
    }
    return this.startRequest(key, params, {
      force,
      walletId: options.walletId,
    });
  }

  invalidate(): void {
    this.revision += 1;
    this.entries.clear();
    void this.port.clear();
  }

  invalidateWallet(walletId: string): void {
    let invalidated = false;
    this.entries.forEach((entry, key) => {
      if (entry.walletId === walletId) {
        this.entries.delete(key);
        invalidated = true;
      }
    });
    if (invalidated) {
      this.revision += 1;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.revision += 1;
    this.entries.clear();
  }

  private startRequest(
    key: string,
    params: IAllNetworkAccountsParams,
    options: { force: boolean; walletId?: string },
  ): Promise<IAllNetworkAccountsInfoResult> {
    if (this.disposed) {
      return Promise.reject(
        new OneKeyLocalError('All-network account repository is disposed'),
      );
    }
    const promise = Promise.resolve()
      .then(() =>
        this.port.fetch({
          ...params,
          skipCache: options.force || params.skipCache,
        }),
      )
      .then((result) => {
        const current = this.entries.get(key);
        if (current?.promise === promise) {
          if (result.allAccountsInfo.length === 0) {
            this.entries.delete(key);
          } else {
            current.createdAt = Date.now();
            current.settled = true;
          }
        }
        return result;
      })
      .catch((error) => {
        if (this.entries.get(key)?.promise === promise) {
          this.entries.delete(key);
        }
        throw error;
      });
    const entry: ICacheEntry = {
      createdAt: Date.now(),
      settled: false,
      walletId: options.walletId,
      promise,
    };
    this.touch(key, entry);
    this.sweep(entry.createdAt);
    return promise;
  }

  private touch(key: string, entry: ICacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private sweep(now: number): void {
    this.entries.forEach((entry, key) => {
      if (now - entry.createdAt >= ALL_NETWORK_ACCOUNT_CACHE_TTL_MS) {
        this.entries.delete(key);
      }
    });
    while (this.entries.size > ALL_NETWORK_ACCOUNT_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) {
        return;
      }
      this.entries.delete(oldest);
    }
  }
}
