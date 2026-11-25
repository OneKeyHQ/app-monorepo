import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  type IStrk20AccountKey,
  type IStrk20AccountPrivacyState,
} from '@onekeyhq/shared/types/starknetPrivacy';

import simpleDb from '../../dbs/simple/simpleDb';

import { buildPrivacyCacheKey } from './types';

import type {
  IPrivateBalanceQuery,
  IPrivateBalanceSnapshot,
  IStarknetPrivacyContext,
} from './types';

const PRIVATE_BALANCE_REFRESH_INTERVAL_MS = 60_000;

function hasNonZeroPrivateBalance(byToken: Record<string, string>): boolean {
  return Object.values(byToken).some(
    (amount) => amount !== '0' && amount !== '',
  );
}

function didPrivateBalancesChange(
  previous: Record<string, string> | undefined,
  next: Record<string, string>,
): boolean {
  if (!previous) {
    return hasNonZeroPrivateBalance(next);
  }
  const prevKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) {
    return true;
  }
  return nextKeys.some((token) => previous[token] !== next[token]);
}

type IPrivacyBalanceStoreDeps = {
  getGeneration: () => number;
  resolvePoolAddress: (networkId: string) => Promise<string>;
  isDisabledByServer: (networkId: string) => Promise<boolean>;
  getAccountPrivacyState: (
    p: IStrk20AccountKey,
  ) => Promise<IStrk20AccountPrivacyState>;
  getRegisteredPrivacyContext: (
    p: IStrk20AccountKey,
    purpose: 'read' | 'transfer',
    allowPrompt: boolean,
  ) => Promise<IStarknetPrivacyContext | undefined>;
};

/**
 * In-memory read-model store for discovered STRK20 private balances.
 * Handles TTL caching, concurrent refresh deduplication, and monotonic block updates.
 */
export class PrivacyBalanceStore {
  private readonly deps: IPrivacyBalanceStoreDeps;

  private readonly privateBalances = new Map<string, IPrivateBalanceSnapshot>();

  private readonly privateBalanceRequests = new Map<
    string,
    Promise<IPrivateBalanceSnapshot>
  >();

  constructor(deps: IPrivacyBalanceStoreDeps) {
    this.deps = deps;
  }

  clear(): void {
    this.privateBalanceRequests.clear();
    this.privateBalances.clear();
  }

  dropScope(scopeKey: string): void {
    for (const reqKey of this.privateBalanceRequests.keys()) {
      if (reqKey === scopeKey || reqKey.startsWith(`${scopeKey}|`)) {
        this.privateBalanceRequests.delete(reqKey);
      }
    }
    for (const balanceKey of this.privateBalances.keys()) {
      if (balanceKey.startsWith(`${scopeKey}|`)) {
        this.privateBalances.delete(balanceKey);
      }
    }
  }

  private async getPrivateBalanceKey(p: IPrivateBalanceQuery): Promise<string> {
    const poolAddress = await this.deps.resolvePoolAddress(p.networkId);
    const tokens = p.tokenAddresses
      ?.map((token) => BigInt(token).toString(16))
      .toSorted()
      .join(',');
    return `${buildPrivacyCacheKey({ ...p, poolAddress })}|${tokens ?? '*'}`;
  }

  async getCachedPrivateBalances(
    p: IPrivateBalanceQuery,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    const key = await this.getPrivateBalanceKey(p);
    return this.readCachedPrivateBalances(p, key);
  }

  /**
   * Low-cost, non-blocking read for Home token list composition:
   * - Returns the in-memory cached account-wide snapshot immediately (<1ms).
   * - Never prompts for password and never waits on network Discovery.
   * - Triggers a silent background refresh when missing or stale; if balances
   *   change, `RefreshTokenList` notifies Home to re-merge.
   */
  async getHomePrivateBalances(
    p: IStrk20AccountKey,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    let key: string;
    try {
      key = await this.getPrivateBalanceKey(p);
    } catch {
      return undefined;
    }
    // Pure in-memory read: never await `getAccountPrivacyState` here because
    // reconciling a pending transfer performs a receipt RPC and would stall Home.
    const cached = this.privateBalances.get(key);
    if (
      cached &&
      Date.now() - cached.lastSyncedAt < PRIVATE_BALANCE_REFRESH_INTERVAL_MS
    ) {
      return cached;
    }
    void this.refreshPrivateBalances({ ...p, allowPrompt: false }).catch(
      () => undefined,
    );
    return cached;
  }

  private async readCachedPrivateBalances(
    p: IPrivateBalanceQuery,
    key: string,
  ): Promise<IPrivateBalanceSnapshot | undefined> {
    if (!this.privateBalances.has(key)) return undefined;
    if (
      (await this.deps.isDisabledByServer(p.networkId)) ||
      (await this.deps.getAccountPrivacyState(p)).optInStatus !==
        EStrk20OptInStatus.Registered
    ) {
      return undefined;
    }
    return this.privateBalances.get(key);
  }

  async getPrivateBalances(
    p: IPrivateBalanceQuery,
  ): Promise<IPrivateBalanceSnapshot> {
    const generation = this.deps.getGeneration();
    const key = await this.getPrivateBalanceKey(p);
    const cached = await this.readCachedPrivateBalances(p, key);
    if (generation !== this.deps.getGeneration()) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    const unlocking = this.privateBalanceRequests.get(`${key}|true`);
    if (unlocking) return unlocking;
    if (
      cached &&
      Date.now() - cached.lastSyncedAt < PRIVATE_BALANCE_REFRESH_INTERVAL_MS
    ) {
      return cached;
    }
    return this.refreshPrivateBalances(p);
  }

  async refreshPrivateBalances(
    p: IPrivateBalanceQuery & { allowPrompt?: boolean },
  ): Promise<IPrivateBalanceSnapshot> {
    const generation = this.deps.getGeneration();
    const key = await this.getPrivateBalanceKey(p);
    if (generation !== this.deps.getGeneration()) {
      throw strk20Error(EStrk20ErrorCode.Locked);
    }
    const requestKey = `${key}|${p.allowPrompt === true}`;
    const pending = this.privateBalanceRequests.get(requestKey);
    if (pending) return pending;

    const request = this.fetchPrivateBalances(p).then((snapshot) => {
      if (generation !== this.deps.getGeneration()) {
        throw strk20Error(EStrk20ErrorCode.Locked);
      }
      const previous = this.privateBalances.get(key);
      if (previous && previous.blockNumber > snapshot.blockNumber) {
        return previous;
      }
      this.privateBalances.set(key, snapshot);
      if (!p.tokenAddresses?.length) {
        if (didPrivateBalancesChange(previous?.byToken, snapshot.byToken)) {
          appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
        }
      } else {
        // Keep an already-cached account-wide Home snapshot in sync when a
        // token-scoped refresh (e.g. from TokenDetails) finishes with newer data.
        const scopePrefix = key.slice(0, key.lastIndexOf('|'));
        const allTokensKey = `${scopePrefix}|*`;
        const allSnapshot = this.privateBalances.get(allTokensKey);
        if (allSnapshot && snapshot.blockNumber >= allSnapshot.blockNumber) {
          const nextByToken = { ...allSnapshot.byToken };
          for (const rawToken of p.tokenAddresses) {
            const normalized = `0x${BigInt(rawToken).toString(16).padStart(64, '0')}`;
            const updatedAmount = snapshot.byToken[normalized];
            if (updatedAmount !== undefined) {
              nextByToken[normalized] = updatedAmount;
            } else {
              delete nextByToken[normalized];
            }
          }
          if (didPrivateBalancesChange(allSnapshot.byToken, nextByToken)) {
            // Keep the account-wide snapshot's blockNumber tied to full reads so
            // other tokens are not relabeled as fresh at the scoped block height.
            this.privateBalances.set(allTokensKey, {
              ...allSnapshot,
              byToken: nextByToken,
            });
            appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
            void this.refreshPrivateBalances({
              networkId: p.networkId,
              accountId: p.accountId,
              allowPrompt: false,
            }).catch(() => undefined);
          }
        }
      }
      return snapshot;
    });
    this.privateBalanceRequests.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (this.privateBalanceRequests.get(requestKey) === request) {
        this.privateBalanceRequests.delete(requestKey);
      }
    }
  }

  private async fetchPrivateBalances(
    p: IPrivateBalanceQuery & { allowPrompt?: boolean },
  ): Promise<IPrivateBalanceSnapshot> {
    const ctx = await this.deps.getRegisteredPrivacyContext(
      p,
      'read',
      p.allowPrompt === true,
    );
    if (!ctx) throw strk20Error(EStrk20ErrorCode.Unavailable);
    const transfers = await ctx.buildTransfers();
    // A finalized number, so the amounts and the block they are true at agree.
    const blockNumber = await ctx.client.getBlockNumber();
    ctx.assertSession();
    const discovered = await transfers.discoverNotes({
      tokens: p.tokenAddresses?.map((token) => BigInt(token)),
      blockIdentifier: blockNumber,
    });
    ctx.assertSession();

    const { normalizeTokenAddress, toHexFelt } =
      await import('../../vaults/impls/starknet/utils');
    const byToken: Record<string, string> = {};
    let noteCount = 0;
    for (const [token, notes] of discovered.notes.entries()) {
      const total = notes.reduce(
        (sum, note) => sum + BigInt(note.amount),
        BigInt(0),
      );
      byToken[normalizeTokenAddress(toHexFelt(token))] = total.toString(10);
      noteCount += notes.length;
    }

    const lastSyncedAt = Date.now();
    await simpleDb.starknetPrivacy.patchRecord({
      ...p,
      poolAddress: ctx.poolAddress,
      patch: { lastRefreshAt: lastSyncedAt },
    });
    ctx.assertSession();
    return { byToken, noteCount, blockNumber, lastSyncedAt };
  }
}
