import { uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  applyHeadlessBuyOrderTimeRules,
  applyOnramperTransactionStatus,
  isTerminalHeadlessBuyOrder,
} from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  type IOnramperTransactionStatus,
} from '@onekeyhq/shared/types/fiatCrypto';

import ServiceBase from './ServiceBase';

// Wallet-side Onramper transaction lookup (OK-64602). PLACEHOLDER path: the
// backend has not shipped the endpoint yet, so production lookups 404 until
// it does and the UI shows "Can't update right now". Only this constant should
// need to change once the real path is confirmed.
const ONRAMPER_TRANSACTIONS_PATH = '/wallet/v1/fiat-pay/onramper-transactions';
// Ids minted by the Simulator mock client / the no-id fallback never exist on
// Onramper: they are scripted locally (dev) or left untouched (prod).
const MOCK_TRANSACTION_ID_PREFIX = 'mock-';
const LOCAL_TRANSACTION_ID_PREFIX = 'local-';
// Scripted mock lifecycle: processing for a short while, then delivered.
const MOCK_DELIVERY_DELAY_MS = 30_000;

function isSyntheticTransactionId(transactionId: string): boolean {
  return (
    transactionId.startsWith(MOCK_TRANSACTION_ID_PREFIX) ||
    transactionId.startsWith(LOCAL_TRANSACTION_ID_PREFIX)
  );
}

function sortOrdersNewestFirst(
  orders: IHeadlessBuyOrder[],
): IHeadlessBuyOrder[] {
  return orders.toSorted(
    (a, b) => (b.submittedAt ?? b.createdAt) - (a.submittedAt ?? a.createdAt),
  );
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
    const inserted = await simpleDb.headlessBuyOrders.insertOrderIfAbsent({
      order,
    });
    if (!inserted) {
      return;
    }
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

  @backgroundMethod()
  public async markHeadlessBuyOrderPaymentSeen({
    transactionId,
  }: {
    transactionId: string;
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const order = await simpleDb.headlessBuyOrders.getOrder({ transactionId });
    if (!order || order.paymentSeen) {
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
      const inserted = await simpleDb.headlessBuyOrders.insertOrderIfAbsent({
        order: { ...built, submittedAt },
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
  // record. A visible (paid) order is never discarded by a checkout event.
  @backgroundMethod()
  public async discardHeadlessBuyOrder({
    transactionId,
    reason,
  }: {
    transactionId: string;
    reason: 'cancelled' | 'failed';
  }): Promise<void> {
    const { simpleDb } = this.backgroundApi;
    const order = await simpleDb.headlessBuyOrders.getOrder({ transactionId });
    if (!order || order.submittedAt !== undefined) {
      return;
    }
    await simpleDb.headlessBuyOrders.mergeOrders({
      updates: { [transactionId]: null },
    });
    defaultLogger.fiatCrypto.onramper.orderDiscarded({ transactionId, reason });
    this.emitHeadlessBuyOrdersChanged();
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
    const stored = await simpleDb.headlessBuyOrders.getOrders();
    const now = Date.now();
    const updates: Record<string, IHeadlessBuyOrder | null> = {};
    const result: IHeadlessBuyOrder[] = [];
    for (const order of stored) {
      const next = applyHeadlessBuyOrderTimeRules(order, now);
      if (!next) {
        updates[order.transactionId] = null;
        defaultLogger.fiatCrypto.onramper.orderDiscarded({
          transactionId: order.transactionId,
          reason: 'timeout',
        });
      } else {
        if (next !== order) {
          updates[order.transactionId] = next;
          this.logHeadlessBuyOrderStatusChange(order, next);
        }
        result.push(next);
      }
    }
    if (Object.keys(updates).length > 0) {
      await simpleDb.headlessBuyOrders.mergeOrders({ updates });
      this.emitHeadlessBuyOrdersChanged();
    }
    return sortOrdersNewestFirst(result);
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
  // scheduled from the background.
  @backgroundMethod()
  public async refreshHeadlessBuyOrders({
    transactionIds,
  }: {
    transactionIds?: string[];
  }): Promise<IHeadlessBuyOrder[]> {
    const orders = await this.getHeadlessBuyOrders();
    const wanted = transactionIds ? new Set(transactionIds) : undefined;
    const targets = orders.filter(
      (o) =>
        !isTerminalHeadlessBuyOrder(o) &&
        (!wanted || wanted.has(o.transactionId)),
    );
    if (targets.length === 0) {
      return orders;
    }
    const now = Date.now();
    const statuses = new Map<string, IOnramperTransactionStatus>();
    const real = targets.filter(
      (o) => !isSyntheticTransactionId(o.transactionId),
    );
    let lookupOk = true;
    if (real.length > 0) {
      try {
        const fetched = await this.fetchOnramperTransactionStatuses(
          real.map((o) => o.transactionId),
        );
        fetched.forEach((tx) => statuses.set(tx.transactionId, tx));
      } catch (error) {
        lookupOk = false;
        const err = error as {
          message?: string;
          response?: { status?: number };
        };
        defaultLogger.fiatCrypto.onramper.orderStatusFetchFailed({
          count: real.length,
          status: err?.response?.status,
          errorMessage: err?.message,
        });
      }
    }
    targets
      .filter((o) => isSyntheticTransactionId(o.transactionId))
      .forEach((o) => {
        const scripted = this.buildMockTransactionStatus(o, now);
        if (scripted) {
          statuses.set(o.transactionId, scripted);
        }
      });

    const updates: Record<string, IHeadlessBuyOrder | null> = {};
    const deliveredAccounts: { accountId: string; networkId: string }[] = [];
    for (const order of targets) {
      const tx = statuses.get(order.transactionId);
      if (!tx) {
        if (!lookupOk && !isSyntheticTransactionId(order.transactionId)) {
          updates[order.transactionId] = {
            ...order,
            lastCheckedAt: now,
            lastCheckOk: false,
          };
        }
      } else {
        const next = applyOnramperTransactionStatus(order, tx, now);
        if (!next) {
          updates[order.transactionId] = null;
          defaultLogger.fiatCrypto.onramper.orderDiscarded({
            transactionId: order.transactionId,
            reason: 'backendFailed',
          });
        } else {
          updates[order.transactionId] = next;
          this.logHeadlessBuyOrderStatusChange(order, next);
          if (
            next.status === EHeadlessBuyOrderStatus.Delivered &&
            order.status !== EHeadlessBuyOrderStatus.Delivered &&
            next.accountId
          ) {
            deliveredAccounts.push({
              accountId: next.accountId,
              networkId: next.networkId,
            });
          }
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      await this.backgroundApi.simpleDb.headlessBuyOrders.mergeOrders({
        updates,
      });
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

  private async fetchOnramperTransactionStatuses(
    transactionIds: string[],
  ): Promise<IOnramperTransactionStatus[]> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{ data: IOnramperTransactionStatus[] }>(
      ONRAMPER_TRANSACTIONS_PATH,
      { transactionIds },
    );
    const data = resp.data?.data;
    return Array.isArray(data)
      ? data.filter((tx) => typeof tx?.transactionId === 'string')
      : [];
  }

  // Dev-only lifecycle for Simulator orders; production leaves synthetic ids
  // untouched (they stay "Processing" with no lookup).
  private buildMockTransactionStatus(
    order: IHeadlessBuyOrder,
    now: number,
  ): IOnramperTransactionStatus | undefined {
    if (
      !platformEnv.isDev ||
      !order.transactionId.startsWith(MOCK_TRANSACTION_ID_PREFIX)
    ) {
      return undefined;
    }
    if (now - order.createdAt < MOCK_DELIVERY_DELAY_MS) {
      return { transactionId: order.transactionId, status: 'pending' };
    }
    return {
      transactionId: order.transactionId,
      status: 'completed',
      outAmount: order.payout,
      transactionHash: `0x${'ab'.repeat(32)}`,
      statusDate: new Date(now).toISOString(),
    };
  }
}

export default ServiceFiatCrypto;
