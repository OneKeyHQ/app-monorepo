import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import liveActivity from '@onekeyhq/shared/src/modules/LiveActivity';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  buildSwapLiveActivitySnapshot,
  canAdvanceLiveActivityStatus,
  getSwapLiveActivityOrderKey,
  isLiveActivityTerminal,
} from '@onekeyhq/shared/src/utils/liveActivityUtils';
import type {
  ILiveActivityMockScenario,
  ILiveActivitySnapshot,
  ILiveActivityStatus,
  ILiveActivitySubscriptionRequest,
  ILiveActivitySubscriptionResult,
  ILiveActivitySystemStatus,
} from '@onekeyhq/shared/types/liveActivity';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import ServiceBase from '../ServiceBase';

import { getLiveActivityLocalizedStrings } from './localizedStrings';
import { createLiveActivityMockScenario } from './mockScenarios';
import {
  isBlockedOrder,
  isReplacedDeposit,
  markBlockedOrder,
  markReplacedDeposit,
} from './replacementGuard';
import {
  createMockLiveActivitySubscriptionTransport,
  liveActivityRemoteTracking,
  pendingServerSubscriptionTransport,
} from './subscriptionTransport';

@backgroundClass()
class ServiceLiveActivity extends ServiceBase {
  private lastStatusRevision = 0;

  private mockSequence = 0;

  private mockRevision = 0;

  private mockSnapshots = new Map<string, ILiveActivitySnapshot>();

  private mockSubscriptions = createMockLiveActivitySubscriptionTransport();

  private mockTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

  private subscriptions = new Map<
    string,
    ILiveActivitySubscriptionResult & {
      orderKey: string;
      isMock: boolean;
      depositTxId?: string;
      lastOrderStatus: ILiveActivityStatus;
      expiresAtMs: number;
    }
  >();

  private subscribing = new Map<string, Promise<void>>();

  private presenting = new Map<
    string,
    Promise<ILiveActivitySystemStatus | undefined>
  >();

  private ordersByDeposit = new Map<string, Map<string, number>>();

  private replacementCleanups = new Set<string>();

  private privacyHalted = false;

  private desiredTracking = new Map<
    string,
    { revision: number; tracking: ILiveActivitySubscriptionRequest['tracking'] }
  >();

  private pruneReplacementState() {
    const now = Date.now();
    for (const orderKey of this.replacementCleanups) {
      if (!isBlockedOrder(orderKey)) this.replacementCleanups.delete(orderKey);
    }
    for (const [txId, orders] of this.ordersByDeposit) {
      for (const [orderKey, expiresAt] of orders) {
        if (expiresAt <= now) orders.delete(orderKey);
      }
      if (!orders.size) this.ordersByDeposit.delete(txId);
    }
  }

  private blockReplacedOrder(orderKey: string, expiresAtMs: number) {
    markBlockedOrder(orderKey, expiresAtMs);
    if (this.replacementCleanups.has(orderKey)) return;
    this.replacementCleanups.add(orderKey);
    const previous = this.presenting.get(orderKey);
    const cleanup = (async () => {
      await previous?.catch(() => undefined);
      await liveActivity.end(orderKey);
      return undefined;
    })();
    this.presenting.set(orderKey, cleanup);
    void cleanup
      .catch((error: unknown) => {
        this.replacementCleanups.delete(orderKey);
        defaultLogger.notification.jpush.consoleError(
          'Live Activity replacement cleanup failed',
          {
            errorType: error instanceof Error ? error.name : 'UnknownError',
          },
        );
      })
      .finally(() => {
        if (this.presenting.get(orderKey) === cleanup)
          this.presenting.delete(orderKey);
      });
  }

  async onSwapDepositReplaced({
    oldTxId,
    orderKey,
    expiresAtMs,
  }: {
    oldTxId: string;
    orderKey?: string;
    expiresAtMs?: number;
  }) {
    if (!platformEnv.isNativeIOS) return;
    this.pruneReplacementState();
    const expiresAt = Math.max(
      expiresAtMs ?? 0,
      Date.now() + 8 * 60 * 60 * 1000,
    );
    markReplacedDeposit(oldTxId, expiresAt);
    const orders = this.ordersByDeposit.get(oldTxId);
    if (orders)
      for (const [key, expiry] of orders)
        this.blockReplacedOrder(key, Math.max(expiry, expiresAt));
    if (orderKey) this.blockReplacedOrder(orderKey, expiresAt);

    // A new background runtime has no in-memory order map. Recover only exact
    // deposit matches from ActivityKit; unrelated or unknown activities stay.
    if (this.privacyHalted) return;
    const status = await liveActivity.getStatus();
    if (this.privacyHalted) return;
    for (const activity of status.activities) {
      if (!activity.order.isMock && activity.order.depositTxId === oldTxId) {
        this.blockReplacedOrder(
          activity.order.orderKey,
          Math.max(activity.order.expiresAtMs, expiresAt),
        );
      }
    }
  }

  private async reconcile(status: ILiveActivitySystemStatus) {
    for (const [activityId, subscription] of this.subscriptions) {
      const current = status.activities.find(
        (item) => item.activityId === activityId,
      );
      if (current) {
        subscription.lastOrderStatus = current.content.status;
      } else {
        this.mockTimers.get(subscription.orderKey)?.forEach(clearTimeout);
        this.mockTimers.delete(subscription.orderKey);
        let reason: 'expired' | 'terminal' | 'dismissed' = 'dismissed';
        if (subscription.expiresAtMs <= Date.now()) {
          reason = 'expired';
        } else if (isLiveActivityTerminal(subscription.lastOrderStatus)) {
          reason = 'terminal';
        }
        await (
          subscription.isMock
            ? this.mockSubscriptions
            : pendingServerSubscriptionTransport
        ).unsubscribe({
          activityId,
          orderKey: subscription.orderKey,
          reason,
        });
        this.subscriptions.delete(activityId);
        this.desiredTracking.delete(activityId);
      }
    }
  }

  private async present(
    snapshot: ILiveActivitySnapshot,
    create: boolean,
    tracking?: ILiveActivitySubscriptionRequest['tracking'],
  ) {
    if (!platformEnv.isNativeIOS || this.privacyHalted) {
      return;
    }
    this.pruneReplacementState();
    const { orderKey, depositTxId, expiresAtMs } = snapshot.order;
    if (isBlockedOrder(orderKey) || isReplacedDeposit(depositTxId)) return;
    const orders =
      this.ordersByDeposit.get(depositTxId) ?? new Map<string, number>();
    orders.set(orderKey, expiresAtMs);
    this.ordersByDeposit.set(depositTxId, orders);
    try {
      await appLocale.isReady;
      if (
        this.privacyHalted ||
        isBlockedOrder(orderKey) ||
        isReplacedDeposit(depositTxId)
      )
        return;
      const previous = this.presenting.get(orderKey);
      const presentation = (async () => {
        // An update may arrive before native creation has completed.
        await previous?.catch(() => undefined);
        if (
          this.privacyHalted ||
          isBlockedOrder(orderKey) ||
          isReplacedDeposit(depositTxId)
        )
          return undefined;
        const localizedSnapshot: ILiveActivitySnapshot = {
          ...snapshot,
          content: {
            ...snapshot.content,
            strings: getLiveActivityLocalizedStrings({
              fromNetworkName: snapshot.order.fromToken.networkName,
              toNetworkName: snapshot.order.toToken.networkName,
              updatedAtMs: snapshot.content.updatedAtMs,
            }),
          },
        };
        return create
          ? liveActivity.start(localizedSnapshot)
          : liveActivity.update(localizedSnapshot);
      })();
      this.presenting.set(orderKey, presentation);
      let status: ILiveActivitySystemStatus | undefined;
      try {
        status = await presentation;
      } finally {
        if (this.presenting.get(orderKey) === presentation) {
          this.presenting.delete(orderKey);
        }
      }
      if (
        !status ||
        this.privacyHalted ||
        isBlockedOrder(orderKey) ||
        isReplacedDeposit(depositTxId)
      )
        return;
      await this.reconcile(status);
      const instance = status.activities.find(
        (activity) => activity.order.orderKey === snapshot.order.orderKey,
      );
      if (instance) {
        const desired = this.desiredTracking.get(instance.activityId);
        if (!desired || snapshot.content.revision >= desired.revision) {
          this.desiredTracking.set(instance.activityId, {
            revision: snapshot.content.revision,
            tracking,
          });
        }
        await this.syncSubscription(instance.activityId);
      }
    } catch (error) {
      defaultLogger.notification.jpush.consoleError('Live Activity failed', {
        operation: create ? 'start' : 'update',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async syncSubscription(activityId: string): Promise<void> {
    const inFlight = this.subscribing.get(activityId);
    if (inFlight) {
      // A newer tracking request still needs an attempt if its predecessor failed.
      await inFlight.catch(() => undefined);
      await this.syncSubscription(activityId);
      return;
    }
    const status = await liveActivity.getStatus();
    await this.reconcile(status);
    const instance = status.activities.find(
      (item) => item.activityId === activityId,
    );
    const desired = this.desiredTracking.get(activityId);
    const subscription = this.subscriptions.get(activityId);
    if (!instance) {
      this.desiredTracking.delete(activityId);
      return;
    }
    if (
      !desired ||
      (subscription &&
        subscription.depositTxId === desired.tracking?.currentDepositTxId)
    )
      return;
    // Recheck after native reads so only one caller owns the transport request.
    if (this.subscribing.has(activityId)) {
      await this.syncSubscription(activityId);
      return;
    }
    const transport = instance.order.isMock
      ? this.mockSubscriptions
      : pendingServerSubscriptionTransport;
    const subscribe = (async () => {
      const result = await transport.subscribe({
        schemaVersion: 1,
        activityId: instance.activityId,
        order: instance.order,
        tracking: desired.tracking,
      });
      this.subscriptions.set(instance.activityId, {
        ...result,
        orderKey: instance.order.orderKey,
        isMock: instance.order.isMock,
        depositTxId: desired.tracking?.currentDepositTxId,
        lastOrderStatus: instance.content.status,
        expiresAtMs: instance.order.expiresAtMs,
      });
      await this.reconcile(await liveActivity.getStatus());
    })();
    this.subscribing.set(activityId, subscribe);
    try {
      await subscribe;
    } finally {
      this.subscribing.delete(activityId);
    }
    await this.syncSubscription(activityId);
  }

  private trackingContext(
    history: ISwapTxHistory,
  ): ILiveActivitySubscriptionRequest['tracking'] {
    const ctx: unknown = history.ctx;
    return {
      currentDepositTxId: history.txInfo.txId ?? '',
      protocol: history.protocol ?? EProtocolOfExchange.SWAP,
      toTokenAddress: history.baseInfo.toToken.contractAddress,
      receivedAddress: history.txInfo.receiver || undefined,
      ctx,
    };
  }

  @backgroundMethod()
  async onSwapBroadcast(history: ISwapTxHistory) {
    if (!liveActivityRemoteTracking.isReady()) return;
    const snapshot = buildSwapLiveActivitySnapshot(history);
    if (snapshot && !isLiveActivityTerminal(snapshot.content.status)) {
      this.lastStatusRevision = Math.max(
        this.lastStatusRevision,
        snapshot.content.revision,
      );
      await this.present(snapshot, true, this.trackingContext(history));
    }
  }

  @backgroundMethod()
  async onSwapStatus({
    history,
    status,
  }: {
    history: ISwapTxHistory;
    status: IFetchSwapTxHistoryStatusResponse;
  }) {
    if (!liveActivityRemoteTracking.isReady()) return;
    const snapshot = buildSwapLiveActivitySnapshot(history, status);
    if (snapshot) {
      snapshot.content.updatedAtMs = Date.now();
      this.lastStatusRevision = Math.max(
        snapshot.content.updatedAtMs,
        this.lastStatusRevision + 1,
      );
      snapshot.content.revision = this.lastStatusRevision;
      await this.present(snapshot, false, this.trackingContext(history));
    }
  }

  @backgroundMethod()
  async getStatus() {
    const status = await liveActivity.getStatus();
    await this.reconcile(status);
    return {
      ...status,
      // Version 1 native attributes have no reliable wallet ownership field.
      activities: status.activities.map((activity) => ({
        ...activity,
        ownershipStatus: 'needsConfirmation' as const,
      })),
      subscriptions: [...this.subscriptions.entries()].map(
        ([activityId, subscription]) => ({ activityId, ...subscription }),
      ),
      lastMockOrderKey: [...this.mockSnapshots.keys()].at(-1),
    };
  }

  @backgroundMethod()
  async refreshLanguage() {
    if (!platformEnv.isNativeIOS || this.privacyHalted) return;
    try {
      await Promise.allSettled(this.presenting.values());
      if (this.privacyHalted) return;
      const status = await liveActivity.getStatus();
      if (this.privacyHalted) return;
      const updates = status.activities.map((activity) => {
        const orderKey = activity.order.orderKey;
        if (isBlockedOrder(orderKey)) return Promise.resolve();
        const previous = this.presenting.get(orderKey);
        const update = (async () => {
          await previous?.catch(() => undefined);
          if (this.privacyHalted || isBlockedOrder(orderKey)) return undefined;
          return liveActivity.updateStrings({
            orderKey,
            revision: activity.content.revision,
            strings: getLiveActivityLocalizedStrings({
              fromNetworkName: activity.order.fromToken.networkName,
              toNetworkName: activity.order.toToken.networkName,
              updatedAtMs: activity.content.updatedAtMs,
            }),
          });
        })();
        this.presenting.set(orderKey, update);
        return update.finally(() => {
          if (this.presenting.get(orderKey) === update) {
            this.presenting.delete(orderKey);
          }
        });
      });
      await Promise.all(updates);
    } catch (error) {
      defaultLogger.notification.jpush.consoleError(
        'Live Activity language refresh failed',
        {
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
      );
    }
  }

  @backgroundMethod()
  async stopForPrivacyTransition() {
    if (!platformEnv.isNativeIOS) return;
    this.privacyHalted = true;
    for (const timers of this.mockTimers.values()) timers.forEach(clearTimeout);
    this.mockTimers.clear();
    await Promise.allSettled(this.presenting.values());
    const status = await liveActivity.getStatus();
    for (const activity of status.activities) {
      await liveActivity.end(activity.order.orderKey);
    }
    const remaining = await liveActivity.getStatus();
    if (remaining.activities.length) {
      throw new OneKeyLocalError('Could not close Live Activities');
    }
    await liveActivity.clearTracking();
    await this.reconcile(remaining);
  }

  @backgroundMethod()
  async resolveOrderForDeepLink({ orderKey }: { orderKey: string }) {
    if (!orderKey || orderKey.length > 256) return undefined;
    const mock = (await liveActivity.getStatus()).activities.find(
      (item) => item.order.isMock && item.order.orderKey === orderKey,
    );
    if (mock && platformEnv.isDev)
      return { source: 'mock' as const, snapshot: mock };
    const history = (
      await this.backgroundApi.simpleDb.swapHistory.getSwapHistoryList()
    ).find(
      (item) =>
        getSwapLiveActivityOrderKey(item) === orderKey &&
        !!buildSwapLiveActivitySnapshot(item),
    );
    return history ? { source: 'history' as const, history } : undefined;
  }

  @backgroundMethodForDev()
  async startMockScenario({
    scenario,
    automatic = false,
  }: IBackgroundMethodWithDevOnlyPassword & {
    scenario: ILiveActivityMockScenario;
    automatic?: boolean;
  }) {
    this.mockSequence += 1;
    const { snapshot, states } = createLiveActivityMockScenario({
      scenario,
      nowMs: Date.now(),
      sequence: this.mockSequence,
    });
    for (const [orderKey, previous] of this.mockSnapshots) {
      if (previous.order.expiresAtMs <= Date.now())
        this.mockSnapshots.delete(orderKey);
    }
    this.mockSnapshots.set(snapshot.order.orderKey, snapshot);
    await this.present(snapshot, true);
    if (automatic && !this.privacyHalted) {
      const timers = states.slice(1).map((status, index) =>
        setTimeout(
          () => {
            void this.updateMock({
              orderKey: snapshot.order.orderKey,
              status,
            }).catch(() => undefined);
          },
          (index + 1) * 10_000,
        ),
      );
      this.mockTimers.set(snapshot.order.orderKey, timers);
    }
    return this.getStatus();
  }

  @backgroundMethodForDev()
  async replayMockScenario({
    orderKey,
    operation,
  }: IBackgroundMethodWithDevOnlyPassword & {
    orderKey: string;
    operation: 'broadcast' | 'done';
  }) {
    const snapshot = this.mockSnapshots.get(orderKey);
    if (snapshot) {
      this.mockRevision = Math.max(this.mockRevision + 1, Date.now());
      await this.present(
        {
          order: snapshot.order,
          content: {
            ...snapshot.content,
            status: operation === 'done' ? 'done' : snapshot.content.status,
            revision: this.mockRevision,
            updatedAtMs: Date.now(),
          },
        },
        operation === 'broadcast',
      );
    }
    return this.getStatus();
  }

  private async updateMock({
    orderKey,
    status,
  }: {
    orderKey: string;
    status: ILiveActivityStatus;
  }) {
    const systemStatus = await liveActivity.getStatus();
    const current = systemStatus.activities.find(
      (activity) =>
        activity.order.orderKey === orderKey && activity.order.isMock,
    );
    if (
      current &&
      canAdvanceLiveActivityStatus(current.content.status, status)
    ) {
      this.mockRevision = Math.max(
        this.mockRevision + 1,
        Date.now(),
        current.content.revision + 1,
      );
      await this.present(
        {
          order: current.order,
          content: {
            status,
            revision: this.mockRevision,
            updatedAtMs: Date.now(),
          },
        },
        false,
      );
    }
  }

  @backgroundMethodForDev()
  async updateMockScenario({
    orderKey,
    status,
  }: IBackgroundMethodWithDevOnlyPassword & {
    orderKey: string;
    status: ILiveActivityStatus;
  }) {
    this.mockTimers.get(orderKey)?.forEach(clearTimeout);
    this.mockTimers.delete(orderKey);
    await this.updateMock({ orderKey, status });
    return this.getStatus();
  }

  @backgroundMethodForDev()
  async clearMockScenarios(_: IBackgroundMethodWithDevOnlyPassword) {
    for (const timers of this.mockTimers.values()) timers.forEach(clearTimeout);
    this.mockTimers.clear();
    this.mockSnapshots.clear();
    const status = await liveActivity.getStatus();
    for (const activity of status.activities.filter(
      (item) => item.order.isMock,
    )) {
      this.mockTimers.get(activity.order.orderKey)?.forEach(clearTimeout);
      this.mockTimers.delete(activity.order.orderKey);
      await liveActivity.end(activity.order.orderKey);
    }
    return this.getStatus();
  }
}

export default ServiceLiveActivity;
