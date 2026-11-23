import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
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
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  ILiveActivityInstance,
  ILiveActivityMockScenario,
  ILiveActivitySnapshot,
  ILiveActivityStatus,
  ILiveActivitySubscriptionResult,
  ILiveActivitySystemStatus,
} from '@onekeyhq/shared/types/liveActivity';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';
import ServiceBase from '../ServiceBase';

import { getLiveActivityLocalizedStrings } from './localizedStrings';
import { createLiveActivityMockScenario } from './mockScenarios';
import {
  getDepositKey,
  isBlockedOrder,
  isReplacedDeposit,
  markBlockedOrder,
  markReplacedDeposit,
} from './replacementGuard';
import {
  createMockLiveActivitySubscriptionTransport,
  createServerLiveActivitySubscriptionTransport,
  liveActivityRemoteTracking,
} from './subscriptionTransport';

function usesRemotePush(order: ILiveActivitySnapshot['order']) {
  return !order.isMock || order.isPushTest === true;
}

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
      remote: boolean;
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

  private remoteAttempts = new Map<
    string,
    {
      orderKey: string;
      expiresAtMs: number;
      retryAtMs: number;
      attempts: number;
      errorCode?: number;
    }
  >();

  private unsubscribing = new Map<string, Promise<void>>();

  private remoteSyncTimer?: ReturnType<typeof setTimeout>;

  private remoteTransport?: ReturnType<
    typeof createServerLiveActivitySubscriptionTransport
  >;

  private async getRemoteTransport() {
    if (!this.remoteTransport) {
      const client = await appApiClient.getBasicClient({
        name: EServiceEndpointEnum.Notification,
        endpoint: endpointsMap.test.notification,
      });
      this.remoteTransport =
        createServerLiveActivitySubscriptionTransport(client);
    }
    return this.remoteTransport;
  }

  private scheduleRemoteSync(delayMs: number) {
    if (this.privacyHalted || this.remoteSyncTimer) return;
    this.remoteSyncTimer = setTimeout(() => {
      this.remoteSyncTimer = undefined;
      void this.resumeRemoteSubscriptions().catch(() => {
        this.scheduleRemoteSync(15_000);
      });
    }, delayMs);
  }

  @backgroundMethod()
  async resumeRemoteSubscriptions() {
    if (this.privacyHalted || !(await liveActivityRemoteTracking.isReady())) {
      return;
    }
    const status = await liveActivity.getStatus();
    await this.reconcile(status);
    const remoteActivities = status.activities.filter((item) =>
      usesRemotePush(item.order),
    );
    await Promise.all(
      remoteActivities.map(async (item) => {
        if (item.order.expiresAtMs <= Date.now()) {
          await liveActivity.end(item.order.orderKey);
        } else {
          await this.syncSubscription(item);
        }
      }),
    );
    if (
      remoteActivities.length ||
      this.remoteAttempts.size ||
      [...this.subscriptions.values()].some(
        (subscription) => subscription.remote,
      )
    ) {
      const now = Date.now();
      const awaitingRegistration = remoteActivities.some(
        (item) =>
          !this.subscriptions.has(item.activityId) &&
          item.pushRegistration !== 'failed' &&
          (this.remoteAttempts.get(item.activityId)?.retryAtMs ?? 0) <=
            now + 3000,
      );
      this.scheduleRemoteSync(awaitingRegistration ? 3000 : 15_000);
    }
  }

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
    networkId,
    oldTxId,
    orderKey,
    expiresAtMs,
  }: {
    networkId: string;
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
    markReplacedDeposit(networkId, oldTxId, expiresAt);
    const orders = this.ordersByDeposit.get(getDepositKey(networkId, oldTxId));
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
      if (
        !activity.order.isMock &&
        activity.order.networkId === networkId &&
        activity.order.depositTxId === oldTxId
      ) {
        this.blockReplacedOrder(
          activity.order.orderKey,
          Math.max(activity.order.expiresAtMs, expiresAt),
        );
      }
    }
  }

  private async reconcile(status: ILiveActivitySystemStatus) {
    const activeIds = new Set(status.activities.map((item) => item.activityId));
    const activeSubscriptions = new Map(
      status.activities.map((item) => [item.activityId, item]),
    );
    for (const [activityId, subscription] of this.subscriptions) {
      const item = activeSubscriptions.get(activityId);
      if (item) subscription.lastOrderStatus = item.content.status;
    }
    const knownIds = new Set([
      ...this.subscriptions.keys(),
      ...this.remoteAttempts.keys(),
    ]);
    await Promise.all(
      [...knownIds]
        .filter((activityId) => !activeIds.has(activityId))
        .map((activityId) => this.unsubscribe(activityId)),
    );
  }

  private async unsubscribe(activityId: string) {
    const existing = this.unsubscribing.get(activityId);
    if (existing) return existing;
    if (this.subscribing.has(activityId)) return;
    const subscription = this.subscriptions.get(activityId);
    const attempt = this.remoteAttempts.get(activityId);
    const orderKey = subscription?.orderKey ?? attempt?.orderKey;
    if (orderKey === undefined) return;
    const remote = subscription?.remote || !!attempt;
    const operation = (async () => {
      const latest = await liveActivity.getStatus();
      if (
        latest.activities.some((activity) => activity.activityId === activityId)
      ) {
        return;
      }
      const transport = remote
        ? await this.getRemoteTransport()
        : this.mockSubscriptions;
      let reason: 'dismissed' | 'terminal' | 'expired' = 'dismissed';
      if (attempt && attempt.expiresAtMs <= Date.now()) {
        reason = 'expired';
      } else if (subscription) {
        if (subscription.expiresAtMs <= Date.now()) reason = 'expired';
        else if (isLiveActivityTerminal(subscription.lastOrderStatus))
          reason = 'terminal';
      }
      await transport.unsubscribe({ activityId, orderKey, reason });
      this.mockTimers.get(orderKey)?.forEach(clearTimeout);
      this.mockTimers.delete(orderKey);
      this.subscriptions.delete(activityId);
      this.remoteAttempts.delete(activityId);
    })();
    this.unsubscribing.set(activityId, operation);
    try {
      await operation;
    } finally {
      this.unsubscribing.delete(activityId);
    }
  }

  private async present(snapshot: ILiveActivitySnapshot, create: boolean) {
    if (!platformEnv.isNativeIOS || this.privacyHalted) {
      return;
    }
    this.pruneReplacementState();
    const { orderKey, depositTxId, expiresAtMs, networkId } = snapshot.order;
    if (isBlockedOrder(orderKey) || isReplacedDeposit(networkId, depositTxId))
      return;
    const depositKey = getDepositKey(networkId, depositTxId);
    const orders =
      this.ordersByDeposit.get(depositKey) ?? new Map<string, number>();
    orders.set(orderKey, expiresAtMs);
    this.ordersByDeposit.set(depositKey, orders);
    try {
      await appLocale.isReady;
      if (
        this.privacyHalted ||
        isBlockedOrder(orderKey) ||
        isReplacedDeposit(networkId, depositTxId)
      )
        return;
      const previous = this.presenting.get(orderKey);
      const presentation = (async () => {
        // An update may arrive before native creation has completed.
        await previous?.catch(() => undefined);
        if (
          this.privacyHalted ||
          isBlockedOrder(orderKey) ||
          isReplacedDeposit(networkId, depositTxId)
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
        isReplacedDeposit(networkId, depositTxId)
      )
        return;
      await this.reconcile(status);
      const instance = status.activities.find(
        (activity) => activity.order.orderKey === snapshot.order.orderKey,
      );
      if (instance) {
        if (usesRemotePush(instance.order)) this.scheduleRemoteSync(3000);
        await this.syncSubscription(instance);
      }
    } catch (error) {
      defaultLogger.notification.jpush.consoleError('Live Activity failed', {
        operation: create ? 'start' : 'update',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async syncSubscription(instance: ILiveActivityInstance) {
    const { activityId, order, content } = instance;
    if (
      this.privacyHalted ||
      this.subscriptions.has(activityId) ||
      this.subscribing.has(activityId) ||
      this.unsubscribing.has(activityId)
    ) {
      return;
    }
    const remote = usesRemotePush(order);
    const attempt = this.remoteAttempts.get(activityId);
    if (
      remote &&
      (instance.pushRegistration !== 'registered' ||
        order.expiresAtMs <= Date.now() ||
        (attempt && attempt.retryAtMs > Date.now()))
    ) {
      return;
    }
    const subscribe = (async () => {
      try {
        const transport = remote
          ? await this.getRemoteTransport()
          : this.mockSubscriptions;
        if (this.privacyHalted) return;
        if (remote) {
          // Keep enough identity to clean up when the response is lost.
          this.remoteAttempts.set(activityId, {
            orderKey: order.orderKey,
            expiresAtMs: order.expiresAtMs,
            retryAtMs: 0,
            attempts: (attempt?.attempts ?? 0) + 1,
          });
        }
        const result = await transport.subscribe({
          schemaVersion: 1,
          activityId,
          order,
        });
        this.subscriptions.set(activityId, {
          ...result,
          orderKey: order.orderKey,
          isMock: order.isMock,
          remote,
          lastOrderStatus: content.status,
          expiresAtMs: order.expiresAtMs,
        });
        this.remoteAttempts.delete(activityId);
      } catch (error) {
        const failed = this.remoteAttempts.get(activityId);
        if (failed) {
          const code =
            error instanceof OneKeyServerApiError ? error.code : undefined;
          failed.errorCode = code;
          if (code === 80_007 || code === 80_010) {
            failed.retryAtMs = Number.POSITIVE_INFINITY;
          } else {
            const backoffMs =
              code === 80_012
                ? 60_000
                : Math.min(
                    60_000,
                    3000 * 2 ** Math.min(failed.attempts - 1, 5),
                  );
            failed.retryAtMs = Date.now() + backoffMs;
          }
        }
        defaultLogger.notification.jpush.consoleError(
          'Live Activity subscription failed',
          { errorType: error instanceof Error ? error.name : 'UnknownError' },
        );
      }
    })();
    this.subscribing.set(activityId, subscribe);
    try {
      await subscribe;
    } finally {
      this.subscribing.delete(activityId);
    }
    await this.reconcile(await liveActivity.getStatus());
  }

  @backgroundMethod()
  async onSwapBroadcast(history: ISwapTxHistory) {
    if (!(await liveActivityRemoteTracking.isReady())) return;
    const snapshot = buildSwapLiveActivitySnapshot(history);
    if (
      snapshot?.order.serviceOrderId &&
      !isLiveActivityTerminal(snapshot.content.status)
    ) {
      this.lastStatusRevision = Math.max(
        this.lastStatusRevision,
        snapshot.content.revision,
      );
      await this.present(snapshot, true);
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
    if (!(await liveActivityRemoteTracking.isReady())) return;
    const snapshot = buildSwapLiveActivitySnapshot(history, status);
    if (snapshot) {
      snapshot.content.updatedAtMs = Date.now();
      this.lastStatusRevision = Math.max(
        snapshot.content.updatedAtMs,
        this.lastStatusRevision + 1,
      );
      snapshot.content.revision = this.lastStatusRevision;
      await this.present(snapshot, false);
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
      lastMockOrderKey: [...this.mockSnapshots.values()].findLast(
        ({ order }) => !order.isPushTest,
      )?.order.orderKey,
      subscriptionErrors: Array.from(
        this.remoteAttempts,
        ([activityId, attempt]) => ({
          activityId,
          code: attempt.errorCode,
        }),
      ),
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
        const { revision, updatedAtMs } = activity.content;
        if (
          isBlockedOrder(orderKey) ||
          revision === undefined ||
          updatedAtMs === undefined
        )
          return Promise.resolve();
        const previous = this.presenting.get(orderKey);
        const update = (async () => {
          await previous?.catch(() => undefined);
          if (this.privacyHalted || isBlockedOrder(orderKey)) return undefined;
          return liveActivity.updateStrings({
            orderKey,
            revision,
            strings: getLiveActivityLocalizedStrings({
              fromNetworkName: activity.order.fromToken.networkName,
              toNetworkName: activity.order.toToken.networkName,
              updatedAtMs,
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
    clearTimeout(this.remoteSyncTimer);
    this.remoteSyncTimer = undefined;
    for (const timers of this.mockTimers.values()) timers.forEach(clearTimeout);
    this.mockTimers.clear();
    await Promise.allSettled(this.presenting.values());
    const status = await liveActivity.getStatus();
    for (const activity of status.activities) {
      await liveActivity.end(activity.order.orderKey);
    }
    await Promise.allSettled(this.subscribing.values());
    // Recover IDs from ActivityKit even if the background JS runtime restarted.
    for (const activity of status.activities) {
      if (
        usesRemotePush(activity.order) &&
        !this.subscriptions.has(activity.activityId) &&
        !this.remoteAttempts.has(activity.activityId)
      ) {
        this.remoteAttempts.set(activity.activityId, {
          orderKey: activity.order.orderKey,
          expiresAtMs: activity.order.expiresAtMs,
          retryAtMs: 0,
          attempts: 0,
        });
      }
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
  async startPushTest(_params: IBackgroundMethodWithDevOnlyPassword) {
    if (!(await liveActivityRemoteTracking.isReady())) {
      throw new OneKeyLocalError(
        'Enable the standard test endpoint on an iOS development build',
      );
    }
    const { instanceId } = await settingsPersistAtom.get();
    const current = (await liveActivity.getStatus()).activities.find(
      ({ order }) => order.isPushTest,
    );
    if (current) return { instanceId };
    this.mockSequence += 1;
    const nowMs = Date.now();
    const { snapshot } = createLiveActivityMockScenario({
      scenario: 'success',
      nowMs,
      sequence: this.mockSequence,
    });
    snapshot.order.isPushTest = true;
    snapshot.order.serviceOrderId = `live-activity-test-${nowMs}-${this.mockSequence}`;
    snapshot.order.fromToken.networkId = 'btc--0';
    snapshot.order.fromToken.isNative = true;
    snapshot.order.expiresAtMs = nowMs + 60 * 60_000;
    this.mockSnapshots.set(snapshot.order.orderKey, snapshot);
    await this.present(snapshot, true);
    const activity = (await liveActivity.getStatus()).activities.find(
      ({ order }) => order.orderKey === snapshot.order.orderKey,
    );
    if (!activity) {
      this.mockSnapshots.delete(snapshot.order.orderKey);
      throw new OneKeyLocalError('Could not create the iOS push test activity');
    }
    if (
      !activity.order.isPushTest ||
      activity.pushRegistration === 'notRequested'
    ) {
      this.mockSnapshots.delete(snapshot.order.orderKey);
      await liveActivity.end(snapshot.order.orderKey);
      await this.reconcile(await liveActivity.getStatus());
      throw new OneKeyLocalError(
        'Build and reinstall the iOS App to enable Live Activity push testing',
      );
    }
    return { instanceId };
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
    if (snapshot && !snapshot.order.isPushTest) {
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
        activity.order.orderKey === orderKey &&
        activity.order.isMock &&
        !activity.order.isPushTest,
    );
    if (
      current &&
      canAdvanceLiveActivityStatus(current.content.status, status)
    ) {
      this.mockRevision = Math.max(
        this.mockRevision + 1,
        Date.now(),
        (current.content.revision ?? 0) + 1,
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
