import { cloneDeep } from 'lodash';

import type {
  IAccountTokensCacheScope,
  ICachedAccountTokens,
  ITokenData,
} from '@onekeyhq/shared/types/token';

type IRequest = {
  key: string;
  order: number;
  epoch: number;
};

type IEntry = {
  snapshot: ICachedAccountTokens;
  tokenCount: number;
};

function getKey({ accountId, networkId }: IAccountTokensCacheScope) {
  return JSON.stringify([accountId, networkId]);
}

// Keep only the group's own fiat entries: persisted groups share one map,
// which also contains risky assets that must not enter the wallet subtotal.
export function copyAccountTokenGroup(group: ITokenData): ITokenData {
  return cloneDeep({
    data: group.data,
    keys: group.data.map((token) => token.$key).join(','),
    map: Object.fromEntries(
      group.data.flatMap((token) => {
        const fiat = group.map[token.$key];
        return fiat ? [[token.$key, fiat]] : [];
      }),
    ),
    currency: group.currency,
    fiatValue: group.fiatValue,
  });
}

export class AccountTokensSnapshotCache {
  private entries = new Map<string, IEntry>();

  private pending = new Map<
    string,
    { latestOrder: number; active: Set<number> }
  >();

  private order = 0;

  private epoch = 0;

  private tokenCount = 0;

  constructor(
    private readonly options = {
      maxEntries: 64,
      maxTokens: 10_000,
      ttlMs: 5 * 60 * 1000,
      now: Date.now,
    },
  ) {}

  begin(scope: IAccountTokensCacheScope, invalidate = false): IRequest {
    this.pruneExpired();
    const key = getKey(scope);
    this.order += 1;
    const pending = this.pending.get(key) ?? {
      latestOrder: this.order,
      active: new Set<number>(),
    };
    pending.latestOrder = this.order;
    pending.active.add(this.order);
    this.pending.set(key, pending);
    if (invalidate) this.remove(key);
    return { key, order: this.order, epoch: this.epoch };
  }

  finish(request: IRequest) {
    if (request.epoch !== this.epoch) return;
    const pending = this.pending.get(request.key);
    pending?.active.delete(request.order);
    if (pending?.active.size === 0) this.pending.delete(request.key);
  }

  set(request: IRequest, snapshot: ICachedAccountTokens) {
    if (
      request.epoch !== this.epoch ||
      this.pending.get(request.key)?.latestOrder !== request.order ||
      request.key !== getKey(snapshot)
    )
      return;
    this.pruneExpired();
    const tokenCount =
      snapshot.tokens.data.length +
      snapshot.smallBalanceTokens.data.length +
      snapshot.riskTokens.data.length;
    this.remove(request.key);
    if (tokenCount > this.options.maxTokens) return;
    const copy: ICachedAccountTokens = {
      accountId: snapshot.accountId,
      networkId: snapshot.networkId,
      accountAddress: snapshot.accountAddress,
      xpub: snapshot.xpub,
      source: snapshot.source,
      coverage: 'partial',
      capturedAt: this.options.now(),
      tokens: copyAccountTokenGroup(snapshot.tokens),
      smallBalanceTokens: copyAccountTokenGroup(snapshot.smallBalanceTokens),
      riskTokens: copyAccountTokenGroup(snapshot.riskTokens),
    };
    this.entries.set(request.key, { snapshot: copy, tokenCount });
    this.tokenCount += tokenCount;
    while (
      this.entries.size > this.options.maxEntries ||
      this.tokenCount > this.options.maxTokens
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
  }

  get(scope: IAccountTokensCacheScope): ICachedAccountTokens | undefined {
    this.pruneExpired();
    const key = getKey(scope);
    const entry = this.entries.get(key);
    if (
      !entry ||
      (scope.accountAddress &&
        scope.accountAddress !== entry.snapshot.accountAddress) ||
      (scope.xpub && scope.xpub !== entry.snapshot.xpub)
    )
      return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    // Desktop/web callers share this heap with the background service.
    return cloneDeep(entry.snapshot);
  }

  clear() {
    this.epoch += 1;
    this.entries.clear();
    this.pending.clear();
    this.tokenCount = 0;
  }

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.tokenCount -= entry.tokenCount;
    this.entries.delete(key);
  }

  private pruneExpired() {
    const now = this.options.now();
    for (const [key, { snapshot }] of this.entries) {
      if (now - (snapshot.capturedAt ?? 0) >= this.options.ttlMs) {
        this.remove(key);
      }
    }
  }
}
