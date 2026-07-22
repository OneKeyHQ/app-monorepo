// cspell: words unifold Unifold hypercore Hypercore
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  assertUnifoldEchoMatches,
  formatUnifoldUsdAmount,
} from '@onekeyhq/shared/src/utils/unifoldDepositUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type {
  IUnifoldActivationStatus,
  IUnifoldDepositAddressParams,
  IUnifoldDepositAddressResult,
  IUnifoldDepositDestination,
  IUnifoldDepositExecution,
  IUnifoldExecutionStatus,
  IUnifoldSupportedAsset,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { perpsUnifoldDepositTrackingAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const TRACKING_LOOP_INTERVAL_MS = 10 * 1000;
const TRACKING_MAX_AGE_MS = 48 * 60 * 60 * 1000;
// A live session renews its claim on a fixed cadence, so a mute older than a
// few renewal periods means the session is gone without having handed
// tracking back (tab closed, app killed) and the entry must be reactivated.
const TRACKING_MUTE_MAX_AGE_MS = 3 * 60 * 1000;

@backgroundClass()
export default class ServiceUnifoldDeposit extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private trackingLoopTimer: ReturnType<typeof setTimeout> | null = null;

  // All Unifold endpoints opt out of the interceptor's automatic error toast
  // (autoHandleError: false, same pattern as ServiceHistory): the UI renders
  // its own error states, and the 3s poll must never spam global toasts. We
  // re-inspect `code` ourselves and throw a quiet typed error carrying it so
  // the UI can branch on 14101/14102/10422.
  private async requestUnifold<T>({
    method,
    url,
    params,
    body,
  }: {
    method: 'get' | 'post';
    url: string;
    params?: Record<string, unknown>;
    body?: unknown;
  }): Promise<T> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const requestConfig: { autoHandleError?: boolean; params?: unknown } = {
      autoHandleError: false,
      params,
    };
    const resp =
      method === 'get'
        ? await client.get<IApiClientResponse<T>>(url, requestConfig)
        : await client.post<IApiClientResponse<T>>(url, body, requestConfig);
    const { code, message, data } = resp.data;
    if (code !== 0) {
      throw new OneKeyError({
        message: message || 'Unifold request failed',
        code,
        autoToast: false,
      });
    }
    return data;
  }

  @backgroundMethod()
  async getSupportedAssets(
    destination: IUnifoldDepositDestination,
  ): Promise<IUnifoldSupportedAsset[]> {
    // supported-assets is a vendor catalog passthrough: the envelope's `data`
    // wraps the vendor's own `{ data: [...] }` (contract §2.1) — verified
    // against the live local wallet service. Unwrap defensively either way.
    const data = await this.requestUnifold<
      IUnifoldSupportedAsset[] | { data?: IUnifoldSupportedAsset[] }
    >({
      method: 'get',
      url: '/wallet/v1/perp/unifold/supported-assets',
      params: { ...destination },
    });
    if (Array.isArray(data)) {
      return data;
    }
    return data?.data ?? [];
  }

  @backgroundMethod()
  async createDepositAddress(
    params: IUnifoldDepositAddressParams,
  ): Promise<IUnifoldDepositAddressResult> {
    const result = await this.requestUnifold<IUnifoldDepositAddressResult>({
      method: 'post',
      url: '/wallet/v1/perp/unifold/deposit-address',
      body: params,
    });
    assertUnifoldEchoMatches(result.echo, params);
    return result;
  }

  @backgroundMethod()
  async listDepositExecutions(params: {
    recipientAddress: string;
    since?: string;
  }): Promise<IUnifoldDepositExecution[]> {
    const data = await this.requestUnifold<IUnifoldDepositExecution[]>({
      method: 'get',
      url: '/wallet/v1/perp/unifold/deposit-executions',
      params: { ...params },
    });
    return data ?? [];
  }

  // Only meaningful for the HyperCore destination (chainId 1337); the server
  // caches vendor responses for 2 minutes, so no client-side cache is needed.
  @backgroundMethod()
  async getActivationStatus(params: {
    recipientAddress: string;
    sourceAddress?: string;
  }): Promise<IUnifoldActivationStatus> {
    return this.requestUnifold<IUnifoldActivationStatus>({
      method: 'get',
      url: '/wallet/v1/perp/unifold/activation-status',
      params: { ...params },
    });
  }

  // Called by the modal on close for every session execution that has not yet
  // reached a terminal status, and on app start to resume tracking.
  @backgroundMethod()
  async trackExecutionsAfterModalClose(params: {
    recipientAddress: string;
    sessionId: string | null;
    executions: Array<{
      executionId: string;
      lastStatus: IUnifoldExecutionStatus;
    }>;
  }) {
    const now = Date.now();
    const recipient = params.recipientAddress.toLowerCase();
    await perpsUnifoldDepositTrackingAtom.set((prev) => {
      const existingIds = new Set(prev.items.map((i) => i.executionId));
      const added = params.executions
        .filter((e) => !existingIds.has(e.executionId))
        .map((e) => ({
          executionId: e.executionId,
          recipientAddress: params.recipientAddress,
          sessionId: params.sessionId,
          lastStatus: e.lastStatus,
          trackedAt: now,
          mutedAt: null,
        }));
      // The session is over, so it hands announcements back for every entry of
      // this recipient — including ones it never saw itself.
      const unmuted = prev.items.map((item) =>
        item.recipientAddress.toLowerCase() === recipient && item.mutedAt
          ? { ...item, mutedAt: null }
          : item,
      );
      return { items: [...unmuted, ...added] };
    });
    void this.unifoldDepositTrackingLoop();
  }

  // Called when a deposit-modal session (re)starts polling for a recipient:
  // the live session becomes the announcer for that recipient, so the bg loop
  // must stay quiet — otherwise both would toast the same terminal transition.
  //
  // Muted, never deleted: the session only sees executions inside its lookback
  // window, so deleting here would strand any older in-flight execution with
  // nobody left to announce its outcome.
  @backgroundMethod()
  async claimTrackedExecutions(params: { recipientAddress: string }) {
    const now = Date.now();
    const recipient = params.recipientAddress.toLowerCase();
    await perpsUnifoldDepositTrackingAtom.set((prev) => ({
      items: prev.items.map((item) =>
        item.recipientAddress.toLowerCase() === recipient
          ? { ...item, mutedAt: now }
          : item,
      ),
    }));
  }

  // Self-rescheduling loop (mirrors perpDepositOrderFetchLoop): polls the
  // executions endpoint while tracked items remain, toasts on terminal status,
  // ages out stale entries. Safe to kick repeatedly — it clears its own timer.
  @backgroundMethod()
  async unifoldDepositTrackingLoop() {
    if (this.trackingLoopTimer) {
      clearTimeout(this.trackingLoopTimer);
      this.trackingLoopTimer = null;
    }
    const now = Date.now();
    // A mute is released by the session's unmount handler. If that never ran
    // (tab closed, app killed) the mute would strand the entry forever, so a
    // stale one expires here.
    await perpsUnifoldDepositTrackingAtom.set((prev) => ({
      items: prev.items.map((item) =>
        item.mutedAt && now - item.mutedAt >= TRACKING_MUTE_MAX_AGE_MS
          ? { ...item, mutedAt: null }
          : item,
      ),
    }));
    const { items } = await perpsUnifoldDepositTrackingAtom.get();
    const liveItems = items.filter(
      (item) => now - item.trackedAt < TRACKING_MAX_AGE_MS && !item.mutedAt,
    );

    const settledIds = new Set<string>();
    if (liveItems.length) {
      const byRecipient = new Map<string, typeof liveItems>();
      for (const item of liveItems) {
        const list = byRecipient.get(item.recipientAddress) ?? [];
        list.push(item);
        byRecipient.set(item.recipientAddress, list);
      }

      for (const [recipientAddress, tracked] of byRecipient) {
        try {
          const executions = await this.listDepositExecutions({
            recipientAddress,
          });
          const byId = new Map(executions.map((e) => [e.executionId, e]));
          for (const item of tracked) {
            const execution = byId.get(item.executionId);
            if (execution?.terminal) {
              settledIds.add(item.executionId);
              this.showTerminalToast(execution, item.sessionId);
            }
          }
        } catch {
          // Transient polling failure — keep tracking, retry next tick.
        }
      }
    }

    // Functional update: entries added while this loop awaited network calls
    // (e.g. another modal close, or a session claim removing entries) must not
    // be resurrected or dropped by a stale wholesale overwrite.
    await perpsUnifoldDepositTrackingAtom.set((prev) => ({
      items: prev.items.filter(
        (item) =>
          !settledIds.has(item.executionId) &&
          now - item.trackedAt < TRACKING_MAX_AGE_MS,
      ),
    }));

    const { items: remaining } = await perpsUnifoldDepositTrackingAtom.get();
    if (remaining.length) {
      this.trackingLoopTimer = setTimeout(() => {
        void this.unifoldDepositTrackingLoop();
      }, TRACKING_LOOP_INTERVAL_MS);
    }
  }

  private showTerminalToast(
    execution: IUnifoldDepositExecution,
    sessionId: string | null,
  ) {
    if (execution.status === 'succeeded') {
      void this.backgroundApi.serviceApp.showToast({
        method: 'success',
        title: appLocale.intl.formatMessage({
          id: ETranslations.perp_deposit_success_title,
        }),
        message: formatUnifoldUsdAmount(
          execution.destinationAmountUsd ?? execution.sourceAmountUsd,
        ),
      });
      void this.backgroundApi.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
      return;
    }
    // failed / refunded: never invent a failure reason (contract §1). The body
    // stays the bare support reference rather than an English sentence under a
    // localized title; the in-app screens carry the "contact support" wording.
    void this.backgroundApi.serviceApp.showToast({
      method: 'error',
      title: appLocale.intl.formatMessage({
        id: ETranslations.perp_deposit_fail_title,
      }),
      ...(sessionId ? { message: `Ref ${sessionId}` } : undefined),
    });
  }
}
