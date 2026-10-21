import { chunk, uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isTerminalHeadlessBuyOrder } from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EHeadlessBuyOrderStatus,
  type IAddHeadlessBuyOrderParams,
  type IFiatCryptoToken,
  type IFiatCryptoTokenListWithNetworks,
  type IFiatCryptoType,
  type IGenerateWidgetUrl,
  type IGenerateWidgetUrlResponse,
  type IGenerateWidgetUrlWithAccountId,
  type IGetTokensListParams,
  type IHeadlessBuyOrder,
  type IOnramperSessionResponse,
  type IOnramperTransactionLookupItem,
  type IOnramperTransactionStatus,
} from '@onekeyhq/shared/types/fiatCrypto';

import ServiceBase from './ServiceBase';

// Wallet-side Onramper transaction lookup (OK-64602): one POST looks up to
// LOOKUP_MAX_IDS_PER_REQUEST ids (the backend forwards them to Onramper's
// list endpoint in one upstream call per `source`), no auth, rate limited per
// IP at the edge (10 requests/min). Each entry's `source` selects the Onramper
// key that created the transaction; native buy always uses the headless key.
// An id the backend could not resolve (unknown id, wrong key, upstream error)
// comes back with `transaction: null` and `failed: true`.
const ONRAMPER_TRANSACTIONS_PATH = '/wallet/v1/fiat-pay/onramper-transactions';
const ONRAMPER_TRANSACTION_SOURCE = 'headless';
// Backend cap per request; more ids are rejected with code 10422.
const LOOKUP_MAX_IDS_PER_REQUEST = 20;
// A successful lookup is reused for this long so a Buy page -> list -> detail
// walk does not spend the per-IP rate limit on duplicate requests.
const MIN_RECHECK_INTERVAL_MS = 10_000;
// A failed lookup (network error, 429, unknown id) is not retried before
// this; otherwise every page entry and poll tick would spend budget on an id
// the edge keeps rejecting.
const FAILED_RECHECK_INTERVAL_MS = 60_000;
// Hidden (pre-payment) records and timed-out failures are kept only for a
// late completion: a general refresh rechecks them this rarely so they never
// crowd out the visible orders. Explicit ids (the detail page) are exempt.
const LOW_PRIORITY_RECHECK_INTERVAL_MS = 10 * 60_000;
// Device-wide request budget per rolling minute, under the 10/min/IP edge
// limit. One page entry can refresh up to LOOKUP_MAX_IDS_PER_REQUEST orders
// per request; beyond that the least recently checked orders go first and
// the rest get their turn on the next request or the next entry.
const LOOKUP_BUDGET_PER_MINUTE = 8;
const LOOKUP_BUDGET_WINDOW_MS = 60_000;
// A general refresh leaves this many of those slots to explicit-id requests
// (the detail page's poll), so a page entry that refreshes a long list cannot
// lock the open order out of its next status for the rest of the window.
const EXPLICIT_LOOKUP_RESERVED_SLOTS = 2;
// One 429 pauses every lookup on this device for this long.
const RATE_LIMITED_PAUSE_MS = 60_000;
// Ids minted by the Simulator mock client / the no-id fallback never exist on
// Onramper: they are never looked up and stay Processing until the time rules
// clear them.
const MOCK_TRANSACTION_ID_PREFIX = 'mock-';
const LOCAL_TRANSACTION_ID_PREFIX = 'local-';

function isSyntheticTransactionId(transactionId: string): boolean {
  return (
    transactionId.startsWith(MOCK_TRANSACTION_ID_PREFIX) ||
    transactionId.startsWith(LOCAL_TRANSACTION_ID_PREFIX)
  );
}

// Why an entry of a successful request carries no transaction.
function describeUnresolvedLookup(
  item: IOnramperTransactionLookupItem | undefined,
): string {
  if (!item) {
    return 'missing from response';
  }
  return item.failed ? 'backend lookup failed' : 'not found';
}

function sortOrdersNewestFirst(
  orders: IHeadlessBuyOrder[],
): IHeadlessBuyOrder[] {
  return orders.toSorted(
    (a, b) => (b.submittedAt ?? b.createdAt) - (a.submittedAt ?? a.createdAt),
  );
}

// Visible processing orders first, then hidden records, then timed-out
// failures (the sort is stable, so each tier stays newest first).
function lookupPriority(order: IHeadlessBuyOrder): number {
  if (order.timedOut) {
    return 2;
  }
  return order.submittedAt === undefined ? 1 : 0;
}

// The orders one status round may look up: non-terminal real ids, each past
// its recheck interval, highest priority first and within a tier the least
// recently checked first (never checked before all), capped to `limit`.
function selectLookupTargets({
  orders,
  wanted,
  now,
  limit,
}: {
  orders: IHeadlessBuyOrder[];
  wanted: Set<string> | undefined;
  now: number;
  limit: number;
}): IHeadlessBuyOrder[] {
  const candidates = orders.filter((o) => {
    if (
      isTerminalHeadlessBuyOrder(o) ||
      isSyntheticTransactionId(o.transactionId) ||
      (wanted && !wanted.has(o.transactionId))
    ) {
      return false;
    }
    if (o.lastCheckedAt === undefined) {
      return true;
    }
    const sinceLastCheck = now - o.lastCheckedAt;
    if (
      sinceLastCheck <
      (o.lastCheckOk ? MIN_RECHECK_INTERVAL_MS : FAILED_RECHECK_INTERVAL_MS)
    ) {
      return false;
    }
    return (
      wanted !== undefined ||
      lookupPriority(o) === 0 ||
      sinceLastCheck >= LOW_PRIORITY_RECHECK_INTERVAL_MS
    );
  });
  return candidates
    .toSorted(
      (a, b) =>
        lookupPriority(a) - lookupPriority(b) ||
        (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0),
    )
    .slice(0, limit);
}

@backgroundClass()
class ServiceFiatCrypto extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _buildUriForFiatToken = memoizee(
    async (params: IGenerateWidgetUrl) => {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{
        data: { url: string; build: boolean };
      }>('/wallet/v1/fiat-pay/url', {
        params,
      });
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  public async generateWidgetUrl(
    params: IGenerateWidgetUrlWithAccountId,
  ): Promise<IGenerateWidgetUrlResponse> {
    const { accountId, ...rest } = params;
    let address: string | undefined;
    if (accountId) {
      try {
        address =
          await this.backgroundApi.serviceAccount.getAccountAddressForApi({
            networkId: rest.networkId,
            accountId,
          });
      } catch (e) {
        console.error('generateWidgetUrl', e);
      }
    }
    return this._buildUriForFiatToken({ ...rest, address });
  }

  _getTokensList = memoizee(
    async (params: {
      networkId: string;
      type: IFiatCryptoType;
      address?: string;
    }) => {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{
        data: IFiatCryptoToken[];
      }>('/wallet/v1/fiat-pay/list', {
        params,
      });
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  @backgroundMethod()
  public async getTokensList(
    params: IGetTokensListParams,
  ): Promise<IFiatCryptoToken[]> {
    const { networkId, accountId } = params;
    let address: string | undefined;
    const walletId = accountId
      ? accountUtils.getWalletIdFromAccountId({ accountId })
      : undefined;
    if (accountId && !networkUtils.isAllNetwork({ networkId })) {
      address = await this.backgroundApi.serviceAccount.getAccountAddressForApi(
        {
          networkId,
          accountId,
        },
      );
    }
    let result = await this._getTokensList({
      networkId,
      address,
      type: params.type,
    });
    defaultLogger.fiatCrypto.request.getTokensList({ params, result });
    if (walletId) {
      const { networkIdsIncompatible } =
        await this.backgroundApi.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
          { walletId },
        );
      if (networkIdsIncompatible.length > 0) {
        const incompatibleSet = new Set(networkIdsIncompatible);
        result = result.filter((o) => !incompatibleSet.has(o.networkId));
      }
    }
    return result;
  }

  @backgroundMethod()
  public async getTokensListWithNetworks(
    params: IGetTokensListParams,
  ): Promise<IFiatCryptoTokenListWithNetworks> {
    const tokens = await this.getTokensList(params);
    const networkIds = uniq(tokens.map((token) => token.networkId));
    const { serviceNetwork } = this.backgroundApi;
    const [{ networks }, mergeDeriveFlags] = await Promise.all([
      // Network metadata only decorates the rows (name / icon). Before it
      // moved into this response the page loaded it separately, so a failed
      // lookup merely left rows unlabeled; keep that contract instead of
      // letting it hide a token list the fiat API already returned.
      serviceNetwork
        .getNetworksByIds({ networkIds })
        .catch((): { networks: IServerNetwork[] } => ({ networks: [] })),
      Promise.all(
        networkIds.map(async (networkId): Promise<boolean> => {
          try {
            const vaultSettings = await serviceNetwork.getVaultSettings({
              networkId,
            });
            return Boolean(vaultSettings?.mergeDeriveAssetsEnabled);
          } catch {
            return false;
          }
        }),
      ),
    ]);
    const networksMap: Record<string, IServerNetwork> = {};
    for (const network of networks) {
      networksMap[network.id] = network;
    }
    return {
      tokens,
      networksMap,
      mergeDeriveAssetsNetworkIds: networkIds.filter(
        (_, index) => mergeDeriveFlags[index],
      ),
    };
  }

  @backgroundMethod()
  public async isNetworkSupported(params: IGetTokensListParams) {
    const tokens = await this.getTokensList(params);
    return tokens.length > 0;
  }

  @backgroundMethod()
  public async isTokenSupported(
    params: IGetTokensListParams & { tokenAddress: string },
  ): Promise<boolean> {
    const res = await this.generateWidgetUrl(params);
    const isSupported = Boolean(res.url && res.build);
    return isSupported;
  }

  // Mint an Onramper Headless SDK session via the OneKey backend. The backend
  // SigV2-signs and forwards to Onramper partners/v2 client-sessions, returning
  // the { sessionId, sessionToken } pair the SDK consumes.
  @backgroundMethod()
  public async fetchOnramperSession(): Promise<IOnramperSessionResponse> {
    // The backend restricts sessions to exactly this scope pair anyway.
    const scope = ['quotes:read', 'checkout:write'];
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const startedAt = Date.now();
    try {
      const resp = await client.post<{ data: IOnramperSessionResponse }>(
        '/wallet/v1/fiat-pay/onramper-session',
        { scope },
      );
      const session = resp.data.data;
      defaultLogger.fiatCrypto.request.onramperSessionMinted({
        durationMs: Date.now() - startedAt,
        expiresAt: session.expiresAt,
      });
      return session;
    } catch (error) {
      const err = error as {
        message?: string;
        response?: { status?: number };
      };
      defaultLogger.fiatCrypto.request.onramperSessionMintFailed({
        durationMs: Date.now() - startedAt,
        status: err?.response?.status,
        message: err?.message,
      });
      throw error;
    }
  }

  // Resolve a buy-list token for the native Headless SDK path. Reads the
  // (memoized) fiat-pay list; the caller checks `headlessSupported` /
  // `onramperNetworkCode` on the result. Used by direct-buy entry points
  // that don't already carry the list token.
  @backgroundMethod()
  public async getHeadlessBuyToken(params: {
    networkId: string;
    tokenAddress: string;
    accountId?: string;
  }): Promise<IFiatCryptoToken | undefined> {
    const { networkId, tokenAddress, accountId } = params;
    const tokens = await this.getTokensList({
      networkId,
      type: 'buy',
      accountId,
    });
    return tokens.find(
      (o) => o.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
  }

  // ---------------------------------------------------------------------------
  // Native buy orders (device-local record + wallet-side status lookup)
  // ---------------------------------------------------------------------------

  // Lookups in flight by transaction id: a list refresh and the detail page's
  // first poll can ask for the same id in the same tick.
  private pendingOnramperLookups = new Map<
    string,
    Promise<IOnramperTransactionLookupItem | undefined>
  >();

  // Set after a 429: no lookup is attempted on this device until then.
  private onramperLookupsPausedUntil = 0;

  // Start times of the lookup requests issued in the last budget window.
  private onramperLookupTimes: number[] = [];

  // Ids whose Apple Pay sheet was authorized before their record landed: the
  // `paymentAuthorized` event can overtake addHeadlessBuyOrder's metadata
  // lookups. The insert that follows folds the flag into the record.
  private paymentSeenBeforeRecord = new Set<string>();

  // Ids whose checkout was cancelled / failed before their record landed: on
  // iOS a `failed` can follow `paymentAuthorized` while addHeadlessBuyOrder
  // is still resolving metadata. The insert that follows replays the discard,
  // so an authorized order is surfaced at once instead of by the 24 h rule.
  private abandonedBeforeRecord = new Map<string, 'cancelled' | 'failed'>();

  private emitHeadlessBuyOrdersChanged() {
    appEventBus.emit(EAppEventBusNames.HeadlessBuyOrdersChanged, undefined);
  }

  // Records the order the moment the SDK publishes a transaction id (before
  // Apple Pay). Hidden until markHeadlessBuyOrderSubmitted; idempotent so a
  // repeated event or the submit fallback cannot overwrite the first record.
  @backgroundMethod()
  public async addHeadlessBuyOrder(
    params: IAddHeadlessBuyOrderParams,
  ): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const existing = await simpleDb.headlessBuyOrders.getOrder({
      transactionId: params.transactionId,
    });
    if (existing) {
      return;
    }
    const order = await this.buildHeadlessBuyOrder(params);
    // The `completed` fallback may have written (and submitted) this id while
    // the metadata lookups above were in flight; never overwrite it.
    const inserted = await this.insertHeadlessBuyOrder(order);
    if (inserted) {
      defaultLogger.fiatCrypto.onramper.orderRecorded({
        networkId: order.networkId,
        tokenSymbol: order.tokenSymbol,
        transactionId: order.transactionId,
        amount: order.fiatAmount,
        ramp: order.providerName,
        entryFrom: order.entryFrom,
      });
      this.emitHeadlessBuyOrdersChanged();
    }
    await this.replayAbandonedCheckout(order.transactionId);
  }

  private async buildHeadlessBuyOrder(
    params: IAddHeadlessBuyOrderParams,
  ): Promise<IHeadlessBuyOrder> {
    const { serviceAccount, serviceNetwork } = this.backgroundApi;
    // Display metadata is best-effort: a lookup failure must never lose the
    // order itself.
    const [accountName, network] = await Promise.all([
      params.accountId
        ? serviceAccount
            .getAccount({
              accountId: params.accountId,
              networkId: params.networkId,
            })
            .then((account) => account?.name)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      serviceNetwork
        .getNetwork({ networkId: params.networkId })
        .catch(() => undefined),
    ]);
    return {
      ...params,
      accountName,
      networkName: network?.name,
      networkLogoURI: network?.logoURI,
      createdAt: Date.now(),
      status: EHeadlessBuyOrderStatus.Processing,
    };
  }

  // Inserts a record unless one exists, merging in a `paymentAuthorized` that
  // arrived before it: one noted before the insert goes in with the row, one
  // that lands while the insert is in flight is patched in afterwards. When
  // another writer got there first, the flag is patched onto its record.
  private async insertHeadlessBuyOrder(
    order: IHeadlessBuyOrder,
  ): Promise<boolean> {
    const { simpleDb } = this.backgroundApi;
    const { transactionId } = order;
    const paymentSeen = this.paymentSeenBeforeRecord.delete(transactionId);
    const inserted = await simpleDb.headlessBuyOrders.insertOrderIfAbsent({
      order: paymentSeen ? { ...order, paymentSeen: true } : order,
    });
    const lateAuthorization =
      this.paymentSeenBeforeRecord.delete(transactionId);
    if ((paymentSeen && !inserted) || lateAuthorization) {
      await simpleDb.headlessBuyOrders.patchOrder({
        transactionId,
        patch: { paymentSeen: true },
      });
    }
    return inserted;
  }

  @backgroundMethod()
  public async markHeadlessBuyOrderPaymentSeen({
    transactionId,
  }: {
    transactionId: string;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    // Noted before the read so an insert racing with this call picks the
    // flag up whichever side finishes first.
    this.paymentSeenBeforeRecord.add(transactionId);
    const order = await simpleDb.headlessBuyOrders.getOrder({ transactionId });
    if (!order) {
      // No record yet: the pending insert folds the flag in.
      return;
    }
    this.paymentSeenBeforeRecord.delete(transactionId);
    if (order.paymentSeen) {
      return;
    }
    await simpleDb.headlessBuyOrders.patchOrder({
      transactionId,
      patch: { paymentSeen: true },
    });
  }

  // `completed` event: the order becomes visible. `order` lets the caller
  // recover when the pre-payment record never landed (a missing record would
  // otherwise leave the user with no order to look at).
  @backgroundMethod()
  public async markHeadlessBuyOrderSubmitted({
    transactionId,
    order: fallback,
  }: {
    transactionId: string;
    order?: IAddHeadlessBuyOrderParams;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const existing = await simpleDb.headlessBuyOrders.getOrder({
      transactionId,
    });
    if (existing?.submittedAt !== undefined) {
      return;
    }
    const submittedAt = Date.now();
    let recordedBeforePayment = Boolean(existing);
    let next = await simpleDb.headlessBuyOrders.patchOrder({
      transactionId,
      patch: { submittedAt },
    });
    if (!next) {
      if (!fallback) {
        return;
      }
      // No pre-payment record: create one already submitted. If the
      // pre-payment write lands in between, patch that one instead.
      const built = await this.buildHeadlessBuyOrder({
        ...fallback,
        transactionId,
      });
      recordedBeforePayment = false;
      const inserted = await this.insertHeadlessBuyOrder({
        ...built,
        submittedAt,
      });
      next = inserted
        ? { ...built, submittedAt }
        : await simpleDb.headlessBuyOrders.patchOrder({
            transactionId,
            patch: { submittedAt },
          });
      if (!next) {
        return;
      }
    }
    defaultLogger.fiatCrypto.onramper.orderSubmitted({
      networkId: next.networkId,
      tokenSymbol: next.tokenSymbol,
      transactionId,
      recordedBeforePayment,
    });
    this.emitHeadlessBuyOrdersChanged();
  }

  // cancelled / failed before completion: nothing was paid, drop the hidden
  // record. A visible (paid) order is never discarded by a checkout event,
  // and neither is a hidden one whose Apple Pay sheet was already authorized:
  // money may have moved, so that record is surfaced for the user to track
  // and the next status lookup settles it.
  @backgroundMethod()
  public async discardHeadlessBuyOrder({
    transactionId,
    reason,
  }: {
    transactionId: string;
    reason: 'cancelled' | 'failed';
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    // Noted before the read so an insert racing with this call replays the
    // discard whichever side finishes first.
    this.abandonedBeforeRecord.set(transactionId, reason);
    const order = await simpleDb.headlessBuyOrders.getOrder({ transactionId });
    if (!order) {
      // No record yet: addHeadlessBuyOrder replays this once its insert lands.
      return;
    }
    this.abandonedBeforeRecord.delete(transactionId);
    await this.settleAbandonedHeadlessBuyOrder({ order, reason });
  }

  // Applies a cancel / failure that found no record when it arrived, now that
  // the record exists. Safe to run alongside the original call: the removal
  // is conditional inside the storage lock and the submit is idempotent.
  private async replayAbandonedCheckout(transactionId: string): Promise<void> {
    const reason = this.abandonedBeforeRecord.get(transactionId);
    if (reason === undefined) {
      return;
    }
    this.abandonedBeforeRecord.delete(transactionId);
    const order = await this.backgroundApi.simpleDb.headlessBuyOrders.getOrder({
      transactionId,
    });
    if (!order) {
      return;
    }
    await this.settleAbandonedHeadlessBuyOrder({ order, reason });
  }

  private async settleAbandonedHeadlessBuyOrder({
    order,
    reason,
  }: {
    order: IHeadlessBuyOrder;
    reason: 'cancelled' | 'failed';
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const { transactionId } = order;
    if (order.submittedAt !== undefined) {
      return;
    }
    if (!order.paymentSeen) {
      // Conditional inside the storage lock: a `completed` or
      // `paymentAuthorized` write that lands after the read above wins.
      const removed = await simpleDb.headlessBuyOrders.removeOrderIfHidden({
        transactionId,
      });
      if (removed) {
        defaultLogger.fiatCrypto.onramper.orderDiscarded({
          transactionId,
          reason,
        });
        this.emitHeadlessBuyOrdersChanged();
        return;
      }
    }
    await this.markHeadlessBuyOrderSubmitted({ transactionId });
  }

  // The Buy-tab banner shows a failed order until its detail is opened once.
  @backgroundMethod()
  public async markHeadlessBuyOrderViewed({
    transactionId,
  }: {
    transactionId: string;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const order = await simpleDb.headlessBuyOrders.getOrder({ transactionId });
    if (
      !order ||
      order.status !== EHeadlessBuyOrderStatus.Failed ||
      order.failureViewedAt !== undefined
    ) {
      return;
    }
    await simpleDb.headlessBuyOrders.patchOrder({
      transactionId,
      patch: { failureViewedAt: Date.now() },
    });
    this.emitHeadlessBuyOrdersChanged();
  }

  // All orders (hidden included), newest first, with the time rules applied
  // and persisted — the UI never needs a network round-trip for them.
  @backgroundMethod()
  public async getHeadlessBuyOrders(): Promise<IHeadlessBuyOrder[]> {
    const { simpleDb } = this.backgroundApi;
    const { orders, changes } = await simpleDb.headlessBuyOrders.applyTimeRules(
      { now: Date.now() },
    );
    for (const { from, to } of changes) {
      if (!to) {
        defaultLogger.fiatCrypto.onramper.orderDiscarded({
          transactionId: from.transactionId,
          reason: 'timeout',
        });
      } else {
        this.logHeadlessBuyOrderStatusChange(from, to);
      }
    }
    if (changes.length > 0) {
      this.emitHeadlessBuyOrdersChanged();
    }
    return sortOrdersNewestFirst(orders);
  }

  private logHeadlessBuyOrderStatusChange(
    from: IHeadlessBuyOrder,
    to: IHeadlessBuyOrder,
  ) {
    if (
      from.status === to.status &&
      Boolean(from.timedOut) === Boolean(to.timedOut)
    ) {
      return;
    }
    defaultLogger.fiatCrypto.onramper.orderStatusUpdated({
      transactionId: to.transactionId,
      from: from.status,
      to: to.status,
      rawStatus: to.rawStatus,
      hasTxHash: Boolean(to.transactionHash),
      timedOut: to.timedOut,
    });
  }

  // One status round for the non-terminal orders (optionally narrowed to
  // `transactionIds`). Called by the UI at the spec'd moments only: Buy/Sell
  // page mount, order list mount, and the detail page's focused poll. Never
  // scheduled from the background. Budgeted against the edge rate limit:
  // per-order recheck intervals (longer after a failure), a rolling
  // per-minute budget, in-flight de-duplication, and a device-wide pause
  // after a 429.
  @backgroundMethod()
  public async refreshHeadlessBuyOrders({
    transactionIds,
  }: {
    transactionIds?: string[];
  }): Promise<IHeadlessBuyOrder[]> {
    const orders = await this.getHeadlessBuyOrders();
    const now = Date.now();
    if (now < this.onramperLookupsPausedUntil) {
      return orders;
    }
    this.onramperLookupTimes = this.onramperLookupTimes.filter(
      (t) => now - t < LOOKUP_BUDGET_WINDOW_MS,
    );
    const budget = transactionIds
      ? LOOKUP_BUDGET_PER_MINUTE
      : LOOKUP_BUDGET_PER_MINUTE - EXPLICIT_LOOKUP_RESERVED_SLOTS;
    const remainingRequests = budget - this.onramperLookupTimes.length;
    if (remainingRequests <= 0) {
      return orders;
    }
    const targets = selectLookupTargets({
      orders,
      wanted: transactionIds ? new Set(transactionIds) : undefined,
      now,
      limit: remainingRequests * LOOKUP_MAX_IDS_PER_REQUEST,
    });
    if (targets.length === 0) {
      return orders;
    }
    // One request per LOOKUP_MAX_IDS_PER_REQUEST ids: a rejected request
    // fails every id it carried, an unresolved entry only its own order.
    const results = await this.lookupOnramperTransactions(
      targets.map((o) => o.transactionId),
    );
    const statuses: Record<string, IOnramperTransactionStatus | null> = {};
    let rateLimited = false;
    results.forEach((result, index) => {
      const { transactionId } = targets[index];
      const item = result.status === 'fulfilled' ? result.value : undefined;
      const tx = item?.transaction;
      if (tx && typeof tx.transactionId === 'string') {
        statuses[transactionId] = tx;
        return;
      }
      statuses[transactionId] = null;
      const err =
        result.status === 'rejected'
          ? (result.reason as
              | {
                  message?: string;
                  code?: number;
                  httpStatusCode?: number;
                  response?: { status?: number };
                }
              | undefined)
          : undefined;
      const status = err?.httpStatusCode ?? err?.response?.status;
      if (status === 429) {
        rateLimited = true;
      }
      defaultLogger.fiatCrypto.onramper.orderStatusFetchFailed({
        transactionId,
        code: err?.code,
        status,
        errorMessage: err ? err.message : describeUnresolvedLookup(item),
      });
    });
    if (rateLimited) {
      this.onramperLookupsPausedUntil = Date.now() + RATE_LIMITED_PAUSE_MS;
    }
    // Merged inside the storage lock against the records as they are now, so
    // a checkout event that landed during the lookups is never overwritten.
    const { changes } =
      await this.backgroundApi.simpleDb.headlessBuyOrders.applyTransactionStatuses(
        { statuses, now },
      );
    const deliveredAccounts: { accountId: string; networkId: string }[] = [];
    for (const { from, to } of changes) {
      if (!to) {
        defaultLogger.fiatCrypto.onramper.orderDiscarded({
          transactionId: from.transactionId,
          reason: 'backendFailed',
        });
      } else {
        this.logHeadlessBuyOrderStatusChange(from, to);
        if (
          to.status === EHeadlessBuyOrderStatus.Delivered &&
          from.status !== EHeadlessBuyOrderStatus.Delivered &&
          to.accountId
        ) {
          deliveredAccounts.push({
            accountId: to.accountId,
            networkId: to.networkId,
          });
        }
      }
    }
    if (changes.length > 0) {
      this.emitHeadlessBuyOrdersChanged();
    }
    if (deliveredAccounts.length > 0) {
      // Delivered coins should show up without a manual pull-to-refresh.
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: deliveredAccounts,
      });
      appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
    }
    return this.getHeadlessBuyOrders();
  }

  // Shares one in-flight lookup per transaction id between overlapping
  // rounds: ids already on their way join that request, the rest go out in
  // one new request per LOOKUP_MAX_IDS_PER_REQUEST ids. Results come back in
  // the order of `transactionIds`.
  private lookupOnramperTransactions(
    transactionIds: string[],
  ): Promise<
    PromiseSettledResult<IOnramperTransactionLookupItem | undefined>[]
  > {
    const fresh = transactionIds.filter(
      (id) => !this.pendingOnramperLookups.has(id),
    );
    for (const ids of chunk(fresh, LOOKUP_MAX_IDS_PER_REQUEST)) {
      this.onramperLookupTimes.push(Date.now());
      const request = this.fetchOnramperTransactions(ids);
      for (const id of ids) {
        const lookup = request
          .then((items) => items.get(id))
          .finally(() => {
            this.pendingOnramperLookups.delete(id);
          });
        this.pendingOnramperLookups.set(id, lookup);
      }
    }
    return Promise.allSettled(
      transactionIds.map(
        (id) =>
          this.pendingOnramperLookups.get(id) ?? Promise.resolve(undefined),
      ),
    );
  }

  private async fetchOnramperTransactions(
    transactionIds: string[],
  ): Promise<Map<string, IOnramperTransactionLookupItem>> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: IOnramperTransactionLookupItem[] | null;
    }>(ONRAMPER_TRANSACTIONS_PATH, {
      transactions: transactionIds.map((transactionId) => ({
        transactionId,
        source: ONRAMPER_TRANSACTION_SOURCE,
      })),
    });
    const items = new Map<string, IOnramperTransactionLookupItem>();
    const entries = resp.data?.data;
    for (const item of Array.isArray(entries) ? entries : []) {
      if (item && typeof item.transactionId === 'string') {
        items.set(item.transactionId, item);
      }
    }
    return items;
  }
}

export default ServiceFiatCrypto;
