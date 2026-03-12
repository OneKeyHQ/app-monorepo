import semver from 'semver';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import type {
  IJsBundleSwitchTaskPayload,
  IPendingInstallTask,
  IResponseAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  EUpdateStrategy,
  compareTargetPriority,
  getTargetVersionKey,
  isFirstLaunchAfterUpdated,
  resolveUpdateDecision,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IUpdateDownloadedEvent } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { appUpdatePersistAtom } from '../states/jotai/atoms';

import {
  clearPendingInstallTask,
  getPendingInstallTask,
  setPendingInstallTask,
} from './pendingInstallTaskStorage';
import ServiceBase from './ServiceBase';

let syncTimerId: ReturnType<typeof setTimeout>;
let downloadTimeoutId: ReturnType<typeof setTimeout>;
let failedRecoveryTimerId: ReturnType<typeof setTimeout>;
let firstLaunch = true;
const PLACEHOLDER_SIGNATURE = 'dev-no-signature';
const MAX_TASK_RETRY = 3;
const MAX_FULL_FLOW_RETRY = 2;
const MAX_RETRY_DELAY_MS = 10 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 30 * 1000;
const RETRY_JITTER_MS = 5 * 1000;
const TASK_FUSE_DURATION_MS = 24 * 60 * 60 * 1000;
const RUNNING_TASK_STALE_MS = timerUtils.getTimeDurationMs({ minute: 5 });
const PROCESS_LOCK_TIMEOUT_MS = timerUtils.getTimeDurationMs({ seconds: 30 });
const IGNORED_TARGET_TTL_MS = timerUtils.getTimeDurationMs({ day: 30 });
const FULL_FLOW_RETRY_TTL_MS = timerUtils.getTimeDurationMs({ day: 7 });
const MAX_IGNORED_TARGETS = 50;
const MAX_FULL_FLOW_RETRY_TARGETS = 100;
const RETRY_TRIGGER_BUNDLE_MISSING = 'BUNDLE_MISSING';
const RETRY_TRIGGER_VERIFY_FAILED = 'VERIFY_EXTRACTED_FAILED';
const RETRY_TRIGGER_INTERRUPTED = 'INTERRUPTED';
const TERMINAL_REASON_RETRY_EXHAUSTED = 'RETRY_EXHAUSTED';
const TERMINAL_REASON_FULL_FLOW_RETRY_EXHAUSTED = 'FULL_FLOW_RETRY_EXHAUSTED';
const PENDING_ACTION_SWITCH_BUNDLE = 'switch-bundle';

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

@backgroundClass()
class ServiceAppUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private isResetting = false;

  private updateAt = 0;

  cachedUpdateInfo: IResponseAppUpdateInfo | undefined;

  private isProcessingPendingTask = false;

  private pendingTaskLockAcquiredAt = 0;

  private fallbackRequestSeqCounter = 0;

  private logUpdateEvent(
    event: string,
    payload: Record<string, unknown>,
    level: 'info' | 'warn' | 'error' = 'info',
  ) {
    const message = JSON.stringify({ event, ...payload });
    if (level === 'error') {
      defaultLogger.app.error.log(message);
      return;
    }
    defaultLogger.app.appUpdate.log(message);
  }

  private buildTaskLogFields(
    task?: Partial<IPendingInstallTask> | null,
  ): Record<string, unknown> {
    return {
      taskId: task?.taskId ?? null,
      revision: task?.revision ?? null,
      action: task?.action ?? null,
      targetAppVersion: task?.targetAppVersion ?? null,
      targetBundleVersion: task?.targetBundleVersion ?? null,
      retryCount: task?.retryCount ?? null,
      nextRetryAt: task?.nextRetryAt ?? null,
    };
  }

  private async clearPendingTaskWithLog({
    traceId,
    requestSeq,
    task,
    clearReason,
    level = 'info',
  }: {
    traceId: string;
    requestSeq?: number;
    task?: IPendingInstallTask | null;
    clearReason: string;
    level?: 'info' | 'warn' | 'error';
  }) {
    await clearPendingInstallTask();
    this.logUpdateEvent(
      'pending_task_cleared',
      {
        traceId,
        requestSeq: requestSeq ?? null,
        ...this.buildTaskLogFields(task),
        clearReason,
      },
      level,
    );
  }

  private getTargetKey(taskOrTarget: {
    targetAppVersion: string;
    targetBundleVersion: string;
  }) {
    return getTargetVersionKey(
      taskOrTarget.targetAppVersion,
      taskOrTarget.targetBundleVersion,
    );
  }

  private isTargetAligned(
    targetAppVersion: string,
    targetBundleVersion: string,
  ) {
    return (
      targetAppVersion === (platformEnv.version || '') &&
      targetBundleVersion === String(platformEnv.bundleVersion || '')
    );
  }

  private async nextRequestSeq() {
    let requestSeq = 0;
    await appUpdatePersistAtom.set((prev) => {
      const prevSeq = Number(prev.lastRequestSeq || 0);
      this.fallbackRequestSeqCounter += 1;
      const nextSeq =
        Number.isSafeInteger(prevSeq) && prevSeq > 0
          ? prevSeq + 1
          : Date.now() * 1000 + this.fallbackRequestSeqCounter;
      requestSeq = nextSeq;
      return {
        ...prev,
        lastRequestSeq: nextSeq,
      };
    });
    this.fallbackRequestSeqCounter += 1;
    return requestSeq || Date.now() * 1000 + this.fallbackRequestSeqCounter;
  }

  private pruneIgnoredTargets(
    ignoredTargets: Record<
      string,
      { reason: string; createdAt: number; expiresAt: number }
    >,
    now: number,
  ) {
    const entries = Object.entries(ignoredTargets)
      .filter(([, info]) => info.expiresAt > now)
      .toSorted((a, b) => b[1].createdAt - a[1].createdAt)
      .slice(0, MAX_IGNORED_TARGETS);
    return Object.fromEntries(entries);
  }

  private pruneFullFlowRetryByTarget(
    fullFlowRetryByTarget: Record<string, { count: number; updatedAt: number }>,
    now: number,
  ) {
    const entries = Object.entries(fullFlowRetryByTarget)
      .filter(([, info]) => now - info.updatedAt <= FULL_FLOW_RETRY_TTL_MS)
      .toSorted((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_FULL_FLOW_RETRY_TARGETS);
    return Object.fromEntries(entries);
  }

  private async cleanupUpdateControlState() {
    const now = Date.now();
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      ignoredTargets: this.pruneIgnoredTargets(prev.ignoredTargets || {}, now),
      fullFlowRetryByTarget: this.pruneFullFlowRetryByTarget(
        prev.fullFlowRetryByTarget || {},
        now,
      ),
    }));
  }

  private async resetTargetControlState(targetKey: string) {
    await appUpdatePersistAtom.set((prev) => {
      const nextIgnoredTargets = { ...prev.ignoredTargets };
      delete nextIgnoredTargets[targetKey];
      const nextFullFlowRetryByTarget = { ...prev.fullFlowRetryByTarget };
      delete nextFullFlowRetryByTarget[targetKey];
      return {
        ...prev,
        ignoredTargets: nextIgnoredTargets,
        fullFlowRetryByTarget: nextFullFlowRetryByTarget,
      };
    });
  }

  private async incrementFullFlowRetry(targetKey: string) {
    let nextCount = 0;
    await appUpdatePersistAtom.set((prev) => {
      const fullFlowRetryByTarget = {
        ...prev.fullFlowRetryByTarget,
      };
      const current = fullFlowRetryByTarget[targetKey]?.count || 0;
      nextCount = current + 1;
      fullFlowRetryByTarget[targetKey] = {
        count: nextCount,
        updatedAt: Date.now(),
      };
      return {
        ...prev,
        fullFlowRetryByTarget,
      };
    });
    return nextCount;
  }

  private async freezeAndIgnoreTarget(
    targetKey: string,
    reason: string,
    traceId: string,
  ) {
    const now = Date.now();
    await appUpdatePersistAtom.set((prev) => {
      const ignoredTargets = this.pruneIgnoredTargets(
        {
          ...prev.ignoredTargets,
          [targetKey]: {
            reason,
            createdAt: now,
            expiresAt: now + IGNORED_TARGET_TTL_MS,
          },
        },
        now,
      );
      return {
        ...prev,
        freezeUntil: now + TASK_FUSE_DURATION_MS,
        ignoredTargets,
      };
    });
    this.logUpdateEvent(
      'update_control_frozen_or_ignored',
      {
        traceId,
        target: targetKey,
        freezeUntil: now + TASK_FUSE_DURATION_MS,
        terminalReason: reason,
      },
      'error',
    );
  }

  private isValidTaskBase(task: unknown): task is IPendingInstallTask {
    if (!task || typeof task !== 'object') {
      return false;
    }
    const t = task as IPendingInstallTask;
    if (
      !t.taskId ||
      !Number.isFinite(t.revision) ||
      t.action !== PENDING_ACTION_SWITCH_BUNDLE ||
      !t.type ||
      !t.targetAppVersion ||
      !t.targetBundleVersion ||
      !t.scheduledEnvAppVersion ||
      !t.scheduledEnvBundleVersion ||
      !Number.isFinite(t.createdAt) ||
      !Number.isFinite(t.expiresAt) ||
      !Number.isFinite(t.retryCount)
    ) {
      return false;
    }
    if (
      !['pending', 'running', 'applied_waiting_verify', 'failed'].includes(
        t.status,
      )
    ) {
      return false;
    }
    if (!t.payload || typeof t.payload !== 'object') {
      return false;
    }
    return true;
  }

  private isValidJsBundleSwitchPayload(payload: unknown) {
    const p = payload as IJsBundleSwitchTaskPayload;
    return !!(p?.appVersion && p.bundleVersion && p.signature);
  }

  private isValidPendingInstallTask(
    task: unknown,
  ): task is IPendingInstallTask {
    if (!this.isValidTaskBase(task)) {
      return false;
    }
    if (task.type !== 'jsbundle-switch') {
      return false;
    }
    return this.isValidJsBundleSwitchPayload(task.payload);
  }

  private getRetryDelayMs(retryCount: number) {
    const expDelay = RETRY_BASE_DELAY_MS * 2 ** (retryCount - 1);
    const baseDelay = Math.min(MAX_RETRY_DELAY_MS, expDelay);
    const jitter = Math.floor(Math.random() * (RETRY_JITTER_MS + 1));
    return baseDelay + jitter;
  }

  private shouldUpdateFromReleaseInfo(releaseInfo: IResponseAppUpdateInfo) {
    const resolved = resolveUpdateDecision({
      currentAppVersion: platformEnv.version,
      currentBundleVersion: platformEnv.bundleVersion,
      remoteAppVersion: releaseInfo.version,
      remoteBundleVersion: releaseInfo.jsBundleVersion,
      allowRollback: true,
    });
    return (
      resolved.decision === 'appShellUpdate' ||
      resolved.decision === 'jsBundleUpgrade' ||
      resolved.decision === 'jsBundleRollback'
    );
  }

  private buildPendingJsBundleTask(
    releaseInfo: IResponseAppUpdateInfo,
    revision: number,
  ): IPendingInstallTask | undefined {
    const appVersion = releaseInfo.version;
    const bundleVersion = releaseInfo.jsBundleVersion;
    if (!appVersion || !bundleVersion) {
      return undefined;
    }

    const now = Date.now();
    return {
      taskId: `jsbundle:${appVersion}:${bundleVersion}`,
      revision,
      action: PENDING_ACTION_SWITCH_BUNDLE,
      type: 'jsbundle-switch',
      targetAppVersion: appVersion,
      targetBundleVersion: bundleVersion,
      scheduledEnvAppVersion: platformEnv.version || '',
      scheduledEnvBundleVersion: String(platformEnv.bundleVersion || ''),
      createdAt: now,
      expiresAt: now + timerUtils.getTimeDurationMs({ day: 7 }),
      retryCount: 0,
      status: 'pending',
      payload: {
        appVersion,
        bundleVersion,
        signature: releaseInfo.jsBundle?.signature ?? PLACEHOLDER_SIGNATURE,
      },
    };
  }

  private async shouldSkipTargetByControl(
    targetKey: string,
    traceId: string,
    requestSeq: number,
    emitLog = true,
  ) {
    const now = Date.now();
    const appInfo = await appUpdatePersistAtom.get();
    if ((appInfo.freezeUntil || 0) > now) {
      if (emitLog) {
        this.logUpdateEvent('pending_task_upsert_decision', {
          traceId,
          requestSeq,
          upsertAction: 'drop',
          reason: 'frozen',
          freezeUntil: appInfo.freezeUntil,
          target: targetKey,
        });
      }
      return true;
    }
    const ignored = appInfo.ignoredTargets?.[targetKey];
    if (ignored && ignored.expiresAt > now) {
      if (emitLog) {
        this.logUpdateEvent('pending_task_upsert_decision', {
          traceId,
          requestSeq,
          upsertAction: 'drop',
          reason: 'ignored_target',
          target: targetKey,
        });
      }
      return true;
    }
    return false;
  }

  private async syncPendingInstallTaskWithReleaseInfo(
    releaseInfo: IResponseAppUpdateInfo | undefined,
    requestSeq: number,
    traceId: string,
  ) {
    if (!releaseInfo) {
      return;
    }

    const decision = resolveUpdateDecision({
      currentAppVersion: platformEnv.version,
      currentBundleVersion: platformEnv.bundleVersion,
      remoteAppVersion: releaseInfo.version,
      remoteBundleVersion: releaseInfo.jsBundleVersion,
      allowRollback: true,
    });
    this.logUpdateEvent('app_update_decision_resolved', {
      traceId,
      requestSeq,
      decision: decision.decision,
      reason: decision.reason,
      allowRollback: true,
      currentAppVersion: platformEnv.version,
      currentBundleVersion: String(platformEnv.bundleVersion || ''),
      targetAppVersion: releaseInfo.version ?? null,
      targetBundleVersion: releaseInfo.jsBundleVersion ?? null,
    });

    if (
      decision.decision !== 'jsBundleUpgrade' &&
      decision.decision !== 'jsBundleRollback'
    ) {
      this.logUpdateEvent('pending_task_upsert_decision', {
        traceId,
        requestSeq,
        upsertAction: 'noop',
        reason: `decision_${decision.decision}`,
      });
      return;
    }

    const task = this.buildPendingJsBundleTask(releaseInfo, requestSeq);
    if (!task || !this.isValidPendingInstallTask(task)) {
      this.logUpdateEvent(
        'pending_task_upsert_decision',
        {
          traceId,
          requestSeq,
          upsertAction: 'drop',
          reason: 'invalid_new_task',
        },
        'warn',
      );
      return;
    }

    const targetKey = this.getTargetKey(task);
    if (await this.shouldSkipTargetByControl(targetKey, traceId, requestSeq)) {
      return;
    }

    const existingRaw = await getPendingInstallTask();
    if (!existingRaw) {
      await setPendingInstallTask(task);
      this.logUpdateEvent('pending_task_upsert_decision', {
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'create',
        reason: 'no_existing_task',
      });
      return;
    }

    if (!this.isValidPendingInstallTask(existingRaw)) {
      this.logUpdateEvent(
        'pending_task_unknown_type_dropped',
        {
          traceId,
          requestSeq,
          taskType: (existingRaw as { type?: string })?.type || 'unknown',
        },
        'warn',
      );
      await this.clearPendingTaskWithLog({
        traceId,
        requestSeq,
        task: existingRaw as IPendingInstallTask,
        clearReason: 'replace_invalid_task',
        level: 'warn',
      });
      await setPendingInstallTask(task);
      this.logUpdateEvent('pending_task_upsert_decision', {
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'create',
        reason: 'replace_invalid_task',
      });
      return;
    }

    const existing = existingRaw;
    if (existing.revision > requestSeq) {
      this.logUpdateEvent(
        'pending_task_upsert_decision',
        {
          traceId,
          requestSeq,
          taskId: existing.taskId,
          revision: existing.revision,
          action: existing.action,
          upsertAction: 'drop',
          reason: 'stale_request_seq',
        },
        'warn',
      );
      return;
    }

    if (
      existing.revision === requestSeq &&
      existing.taskId === task.taskId &&
      existing.action === task.action
    ) {
      this.logUpdateEvent('pending_task_upsert_decision', {
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'noop',
        reason: 'same_revision_same_target',
      });
      return;
    }

    if (existing.taskId === task.taskId) {
      await setPendingInstallTask({
        ...task,
        retryCount: existing.retryCount,
        nextRetryAt: existing.nextRetryAt,
        status: existing.status,
        runningStartedAt: existing.runningStartedAt,
        lastError: existing.lastError,
      });
      this.logUpdateEvent('pending_task_upsert_decision', {
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'update',
        reason: 'same_target_keep_retry_state',
      });
      return;
    }

    const priority = compareTargetPriority(
      {
        appVersion: task.targetAppVersion,
        bundleVersion: task.targetBundleVersion,
        rollbackPolicyPriority:
          decision.decision === 'jsBundleRollback' ? 0 : 1,
        actionPriority: decision.decision === 'jsBundleRollback' ? 1 : 2,
      },
      {
        appVersion: existing.targetAppVersion,
        bundleVersion: existing.targetBundleVersion,
        rollbackPolicyPriority:
          Number(existing.targetBundleVersion) <
          Number(existing.scheduledEnvBundleVersion)
            ? 0
            : 1,
        actionPriority:
          Number(existing.targetBundleVersion) <
          Number(existing.scheduledEnvBundleVersion)
            ? 1
            : 2,
      },
    );

    if (priority <= 0) {
      this.logUpdateEvent('pending_task_upsert_decision', {
        traceId,
        requestSeq,
        taskId: existing.taskId,
        revision: existing.revision,
        action: existing.action,
        upsertAction: 'noop',
        reason: 'existing_target_priority_higher_or_equal',
      });
      return;
    }

    await setPendingInstallTask(task);
    this.logUpdateEvent('pending_task_upsert_decision', {
      traceId,
      requestSeq,
      taskId: task.taskId,
      revision: task.revision,
      action: task.action,
      upsertAction: 'update',
      reason: 'new_target_priority_higher',
    });
  }

  private async markTaskFailed(
    task: IPendingInstallTask,
    message: string,
    traceId: string,
    requestSeq?: number,
  ) {
    const targetKey = this.getTargetKey(task);
    const isFullFlowRetryTrigger =
      message.includes(RETRY_TRIGGER_BUNDLE_MISSING) ||
      message.includes(RETRY_TRIGGER_VERIFY_FAILED);

    if (isFullFlowRetryTrigger) {
      const fullFlowRetryCount = await this.incrementFullFlowRetry(targetKey);
      this.logUpdateEvent(
        'full_flow_retry_triggered',
        {
          traceId,
          requestSeq: requestSeq ?? null,
          taskId: task.taskId,
          revision: task.revision,
          action: task.action,
          trigger: message.includes(RETRY_TRIGGER_BUNDLE_MISSING)
            ? 'bundle_missing'
            : 'verify_failed',
          fullFlowRetryCount,
          target: targetKey,
        },
        'warn',
      );
      if (fullFlowRetryCount > MAX_FULL_FLOW_RETRY) {
        await this.clearPendingTaskWithLog({
          traceId,
          requestSeq,
          task,
          clearReason: 'full_flow_retry_exhausted',
          level: 'warn',
        });
        await this.freezeAndIgnoreTarget(
          targetKey,
          TERMINAL_REASON_FULL_FLOW_RETRY_EXHAUSTED,
          traceId,
        );
        return;
      }
      await this.clearPendingTaskWithLog({
        traceId,
        requestSeq,
        task,
        clearReason: 'full_flow_retry_fallback_to_refetch',
        level: 'warn',
      });
      return;
    }

    const nextRetryCount = task.retryCount + 1;
    const now = Date.now();
    if (nextRetryCount >= MAX_TASK_RETRY) {
      await this.clearPendingTaskWithLog({
        traceId,
        requestSeq,
        task,
        clearReason: 'switch_retry_exhausted',
        level: 'warn',
      });
      await this.freezeAndIgnoreTarget(
        targetKey,
        TERMINAL_REASON_RETRY_EXHAUSTED,
        traceId,
      );
      return;
    }

    const delayMs = this.getRetryDelayMs(nextRetryCount);
    const nextRetryAt = now + delayMs;
    await setPendingInstallTask({
      ...task,
      retryCount: nextRetryCount,
      status: 'pending',
      runningStartedAt: undefined,
      lastError: message,
      nextRetryAt,
    });
    this.logUpdateEvent(
      'pending_retry_scheduled',
      {
        traceId,
        requestSeq: requestSeq ?? null,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        retryCount: nextRetryCount,
        nextRetryAt,
        retryType:
          message === RETRY_TRIGGER_INTERRUPTED ? 'interrupted' : 'switch',
      },
      'warn',
    );
  }

  private async executeBundleSwitchTask(task: IPendingInstallTask) {
    const payload = task.payload;
    const { appVersion, bundleVersion, signature } = payload;
    const bundleExists = await BundleUpdate.isBundleExists(
      appVersion,
      bundleVersion,
    );
    if (!bundleExists) {
      throw new OneKeyLocalError(RETRY_TRIGGER_BUNDLE_MISSING);
    }

    try {
      await BundleUpdate.verifyExtractedBundle(appVersion, bundleVersion);
    } catch (error) {
      await BundleUpdate.clearBundle();
      throw new OneKeyLocalError(
        `${RETRY_TRIGGER_VERIFY_FAILED}:${
          (error as Error)?.message || 'unknown'
        }`,
      );
    }

    await BundleUpdate.switchBundle({
      appVersion,
      bundleVersion,
      signature,
    });
  }

  private async executePendingInstallTask(task: IPendingInstallTask) {
    if (task.type === 'jsbundle-switch') {
      await this.executeBundleSwitchTask(task);
      return;
    }
    const unknownType =
      (task as unknown as { type?: string })?.type || 'unknown';
    throw new OneKeyLocalError(`Unknown pending task type: ${unknownType}`);
  }

  private async runPostPendingRefresh({
    traceId,
    requestSeq,
    task,
  }: {
    traceId: string;
    requestSeq: number | null;
    task?: Partial<IPendingInstallTask> | null;
  }) {
    const startedAt = Date.now();
    this.logUpdateEvent('pending_post_process_refresh_start', {
      traceId,
      requestSeq,
      ...this.buildTaskLogFields(task),
    });
    try {
      await this.refreshUpdateStatus();
      this.logUpdateEvent('pending_post_process_refresh_result', {
        traceId,
        requestSeq,
        result: 'success',
        durationMs: Date.now() - startedAt,
        ...this.buildTaskLogFields(task),
      });
    } catch (error) {
      const message = (error as Error)?.message ?? 'unknown';
      this.logUpdateEvent(
        'pending_post_process_refresh_result',
        {
          traceId,
          requestSeq,
          result: 'fail',
          durationMs: Date.now() - startedAt,
          errorCode: message,
          errorMessage: message,
          ...this.buildTaskLogFields(task),
        },
        'warn',
      );
    }
  }

  private startFailedRecoveryTimer() {
    clearTimeout(failedRecoveryTimerId);
    failedRecoveryTimerId = setTimeout(
      async () => {
        const appInfo = await appUpdatePersistAtom.get();
        defaultLogger.app.appUpdate.log(
          `Failed recovery timer fired, current status: ${appInfo.status}`,
        );
        if (ServiceAppUpdate.FAILED_STATUSES.includes(appInfo.status)) {
          const isVerifyFailure =
            ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(appInfo.status);
          await appUpdatePersistAtom.set((prev) => ({
            ...prev,
            errorText: undefined,
            status: EAppUpdateStatus.notify,
            downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
          }));
        }
      },
      timerUtils.getTimeDurationMs({ hour: 2 }),
    );
  }

  @backgroundMethod()
  async processPendingInstallTask() {
    const traceId = generateUUID();
    const requestSeq = null;
    let shouldRunPostRefresh = false;
    let processedTaskSnapshot: Partial<IPendingInstallTask> | null = null;
    const lockNow = Date.now();
    if (this.isProcessingPendingTask) {
      const lockHeldMs = lockNow - this.pendingTaskLockAcquiredAt;
      if (lockHeldMs > PROCESS_LOCK_TIMEOUT_MS) {
        this.logUpdateEvent(
          'pending_task_lock_state',
          {
            traceId,
            requestSeq,
            lockState: 'timeout',
            lockHeldMs,
            lockTimeoutMs: PROCESS_LOCK_TIMEOUT_MS,
          },
          'warn',
        );
        this.isProcessingPendingTask = false;
        this.pendingTaskLockAcquiredAt = 0;
      } else {
        this.logUpdateEvent('pending_task_lock_state', {
          traceId,
          requestSeq,
          lockState: 'reentrant',
          lockHeldMs,
          lockTimeoutMs: PROCESS_LOCK_TIMEOUT_MS,
        });
        return;
      }
    }

    this.isProcessingPendingTask = true;
    this.pendingTaskLockAcquiredAt = Date.now();
    this.logUpdateEvent('pending_task_lock_state', {
      traceId,
      requestSeq,
      lockState: 'acquired',
      lockTimeoutMs: PROCESS_LOCK_TIMEOUT_MS,
    });

    try {
      await this.cleanupUpdateControlState();

      const rawTask = await getPendingInstallTask();
      if (!rawTask) {
        this.logUpdateEvent('pending_task_validation', {
          traceId,
          requestSeq,
          isValid: false,
          invalidReason: 'no_task',
          ...this.buildTaskLogFields(null),
        });
        return;
      }
      shouldRunPostRefresh = true;
      processedTaskSnapshot = rawTask as Partial<IPendingInstallTask>;

      if (!this.isValidPendingInstallTask(rawTask)) {
        this.logUpdateEvent(
          'pending_task_unknown_type_dropped',
          {
            traceId,
            requestSeq,
            taskType: (rawTask as { type?: string })?.type || 'unknown',
          },
          'warn',
        );
        this.logUpdateEvent(
          'pending_task_validation',
          {
            traceId,
            requestSeq,
            isValid: false,
            invalidReason: 'invalid_task_payload',
            ...this.buildTaskLogFields(rawTask as Partial<IPendingInstallTask>),
          },
          'warn',
        );
        await this.clearPendingTaskWithLog({
          traceId,
          task: rawTask as IPendingInstallTask,
          clearReason: 'invalid_task_payload',
          level: 'warn',
        });
        return;
      }

      let task = rawTask;
      const now = Date.now();
      this.logUpdateEvent('pending_task_validation', {
        traceId,
        requestSeq,
        isValid: true,
        invalidReason: null,
        ...this.buildTaskLogFields(task),
      });

      if (task.expiresAt <= now) {
        await this.clearPendingTaskWithLog({
          traceId,
          task,
          clearReason: 'task_expired',
          level: 'warn',
        });
        return;
      }

      const targetKey = this.getTargetKey(task);
      if (task.status === 'failed') {
        this.logUpdateEvent('pending_task_validation', {
          traceId,
          requestSeq,
          isValid: true,
          invalidReason: 'task_already_failed',
          ...this.buildTaskLogFields(task),
        });
        return;
      }

      if (task.status === 'applied_waiting_verify') {
        const aligned = this.isTargetAligned(
          task.targetAppVersion,
          task.targetBundleVersion,
        );
        this.logUpdateEvent(
          'pending_verify_after_restart',
          {
            traceId,
            requestSeq,
            aligned,
            currentAppVersion: platformEnv.version || '',
            currentBundleVersion: String(platformEnv.bundleVersion || ''),
            ...this.buildTaskLogFields(task),
          },
          aligned ? 'info' : 'error',
        );
        if (aligned) {
          await this.resetTargetControlState(targetKey);
          await this.clearPendingTaskWithLog({
            traceId,
            task,
            clearReason: 'applied_task_verified_success',
          });
          return;
        }
        await this.markTaskFailed(
          task,
          'VERIFY_AFTER_RESTART_MISMATCH',
          traceId,
          undefined,
        );
        return;
      }

      if (task.status === 'running') {
        const runningStartedAt = task.runningStartedAt || task.createdAt;
        const runningDuration = now - runningStartedAt;
        if (runningDuration <= RUNNING_TASK_STALE_MS) {
          this.logUpdateEvent('pending_task_lock_state', {
            traceId,
            requestSeq,
            lockState: 'reentrant',
            runningDuration,
            runningStaleMs: RUNNING_TASK_STALE_MS,
            ...this.buildTaskLogFields(task),
          });
          return;
        }
        await this.markTaskFailed(
          task,
          RETRY_TRIGGER_INTERRUPTED,
          traceId,
          undefined,
        );
        const latestTask = await getPendingInstallTask();
        if (!latestTask || !this.isValidPendingInstallTask(latestTask)) {
          return;
        }
        task = latestTask;
      }

      const currentAppVersion = platformEnv.version || '';
      const currentBundleVersion = String(platformEnv.bundleVersion || '');
      const targetMatch = this.isTargetAligned(
        task.targetAppVersion,
        task.targetBundleVersion,
      );
      const scheduledMatch =
        task.scheduledEnvAppVersion === currentAppVersion &&
        task.scheduledEnvBundleVersion === currentBundleVersion;
      let envMatch: 'target' | 'scheduled' | 'mismatch' = 'mismatch';
      if (targetMatch) {
        envMatch = 'target';
      } else if (scheduledMatch) {
        envMatch = 'scheduled';
      }

      this.logUpdateEvent('pending_task_env_check', {
        traceId,
        requestSeq,
        envMatch,
        currentAppVersion,
        currentBundleVersion,
        scheduledEnvAppVersion: task.scheduledEnvAppVersion,
        scheduledEnvBundleVersion: task.scheduledEnvBundleVersion,
        ...this.buildTaskLogFields(task),
      });

      if (targetMatch) {
        await this.resetTargetControlState(targetKey);
        await this.clearPendingTaskWithLog({
          traceId,
          task,
          clearReason: 'target_already_aligned',
        });
        return;
      }

      if (!scheduledMatch) {
        await this.clearPendingTaskWithLog({
          traceId,
          task,
          clearReason: 'scheduled_env_mismatch',
          level: 'warn',
        });
        return;
      }

      if (task.nextRetryAt && task.nextRetryAt > now) {
        this.logUpdateEvent('pending_task_validation', {
          traceId,
          requestSeq,
          isValid: true,
          invalidReason: 'retry_backoff_not_elapsed',
          ...this.buildTaskLogFields(task),
        });
        return;
      }

      const runningTask: IPendingInstallTask = {
        ...task,
        status: 'running',
        runningStartedAt: Date.now(),
      };
      await setPendingInstallTask(runningTask);
      const startedAt = Date.now();
      this.logUpdateEvent('pending_switch_start', {
        traceId,
        requestSeq,
        fromStatus: task.status,
        ...this.buildTaskLogFields(runningTask),
      });

      try {
        await this.executePendingInstallTask(runningTask);
        const durationMs = Date.now() - startedAt;
        await setPendingInstallTask({
          ...runningTask,
          status: 'applied_waiting_verify',
          runningStartedAt: undefined,
          lastError: undefined,
        });
        this.logUpdateEvent('pending_switch_result', {
          traceId,
          requestSeq,
          result: 'success',
          durationMs,
          ...this.buildTaskLogFields(runningTask),
        });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = (error as Error)?.message ?? 'unknown';
        this.logUpdateEvent(
          'pending_switch_result',
          {
            traceId,
            requestSeq,
            result: 'fail',
            durationMs,
            errorCode: message,
            errorMessage: message,
            ...this.buildTaskLogFields(runningTask),
          },
          'error',
        );
        await this.markTaskFailed(runningTask, message, traceId, undefined);
      }
    } finally {
      if (shouldRunPostRefresh) {
        await this.runPostPendingRefresh({
          traceId,
          requestSeq,
          task: processedTaskSnapshot,
        });
      }
      this.isProcessingPendingTask = false;
      this.pendingTaskLockAcquiredAt = 0;
      this.logUpdateEvent('pending_task_lock_state', {
        traceId,
        requestSeq,
        lockState: 'released',
        lockTimeoutMs: PROCESS_LOCK_TIMEOUT_MS,
      });
    }
  }

  @backgroundMethod()
  async fetchConfig() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      data: IResponseAppUpdateInfo;
    }>('/utility/v1/app-update');
    const { code, data } = response.data;
    if (code === 0 && data) {
      const normalizedUpdateStrategy =
        data.updateStrategy === undefined ||
        data.updateStrategy === null ||
        (data.updateStrategy as unknown) === ''
          ? undefined
          : Number(data.updateStrategy);
      const normalizedData: IResponseAppUpdateInfo = {
        ...data,
        updateStrategy: (normalizedUpdateStrategy ??
          data.updateStrategy) as EUpdateStrategy,
        version: normalizeOptionalString(data.version),
        storeUrl: normalizeOptionalString(data.storeUrl),
        downloadUrl: normalizeOptionalString(data.downloadUrl),
        changeLog: normalizeOptionalString(data.changeLog),
        summary: normalizeOptionalString(data.summary),
        jsBundleVersion: normalizeOptionalString(data.jsBundleVersion),
        fileSize: normalizeOptionalNumber(data.fileSize),
        jsBundle: data.jsBundle
          ? {
              downloadUrl: normalizeOptionalString(data.jsBundle.downloadUrl),
              fileSize: normalizeOptionalNumber(data.jsBundle.fileSize),
              sha256: normalizeOptionalString(data.jsBundle.sha256),
              signature: normalizeOptionalString(data.jsBundle.signature),
            }
          : undefined,
      };
      // Security: Validate updateStrategy is a known enum value
      if (
        normalizedUpdateStrategy !== undefined &&
        !Number.isFinite(normalizedUpdateStrategy)
      ) {
        defaultLogger.app.appUpdate.endInstallPackage(
          false,
          new Error(
            `Invalid updateStrategy value: ${String(data.updateStrategy)}`,
          ),
        );
        return this.cachedUpdateInfo;
      }
      if (
        normalizedData.updateStrategy !== undefined &&
        ![
          EUpdateStrategy.silent,
          EUpdateStrategy.force,
          EUpdateStrategy.manual,
          EUpdateStrategy.seamless,
        ].includes(normalizedData.updateStrategy)
      ) {
        defaultLogger.app.appUpdate.endInstallPackage(
          false,
          new Error(
            `Invalid updateStrategy value: ${String(
              normalizedData.updateStrategy,
            )}`,
          ),
        );
        return this.cachedUpdateInfo;
      }
      // Security: Validate jsBundle fields if present
      if (normalizedData.jsBundle) {
        if (
          normalizedData.jsBundle.downloadUrl &&
          !normalizedData.jsBundle.downloadUrl.startsWith('https://')
        ) {
          defaultLogger.app.appUpdate.endInstallPackage(
            false,
            new Error('jsBundle downloadUrl must use HTTPS'),
          );
          return this.cachedUpdateInfo;
        }
      }
      this.updateAt = Date.now();
      this.cachedUpdateInfo = normalizedData;
    }
    return this.cachedUpdateInfo;
  }

  @backgroundMethod()
  async getAppLatestInfo(forceUpdate = false) {
    if (
      !forceUpdate &&
      Date.now() - this.updateAt <
        timerUtils.getTimeDurationMs({
          minute: 5,
        }) &&
      this.cachedUpdateInfo
    ) {
      return this.cachedUpdateInfo;
    }
    return this.fetchConfig();
  }

  @backgroundMethod()
  async getUpdateStatus() {
    const appInfo = await appUpdatePersistAtom.get();
    return appInfo.status;
  }

  static FAILED_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.downloadPackageFailed,
    EAppUpdateStatus.downloadASCFailed,
    EAppUpdateStatus.verifyASCFailed,
    EAppUpdateStatus.verifyPackageFailed,
  ];

  static VERIFY_FAILED_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.verifyASCFailed,
    EAppUpdateStatus.verifyPackageFailed,
  ];

  @backgroundMethod()
  async refreshUpdateStatus() {
    const appInfo = await appUpdatePersistAtom.get();
    if (isFirstLaunchAfterUpdated(appInfo)) {
      defaultLogger.app.appUpdate.log(
        'refreshUpdateStatus: first launch after updated, resetting to done',
      );
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
        updateAt: 0,
        updateStrategy: EUpdateStrategy.manual,
        errorText: undefined,
        status: EAppUpdateStatus.done,
        jsBundleVersion: undefined,
        jsBundle: undefined,
        downloadedEvent: undefined,
      }));
    } else if (ServiceAppUpdate.FAILED_STATUSES.includes(appInfo.status)) {
      // On app launch / foreground, reset failed states back to notify
      // so the user gets a fresh update prompt instead of a stale error.
      defaultLogger.app.appUpdate.log(
        `refreshUpdateStatus: resetting failed status ${appInfo.status} to notify`,
      );
      const isVerifyFailure = ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(
        appInfo.status,
      );
      await appUpdatePersistAtom.set((prev) => ({
        ...prev,
        errorText: undefined,
        status: EAppUpdateStatus.notify,
        // Corrupted/tampered packages must be re-downloaded
        downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
      }));
    }
  }

  @backgroundMethod()
  async isNeedSyncAppUpdateInfo(forceUpdate = false) {
    const { updateAt } = await appUpdatePersistAtom.get();
    clearTimeout(syncTimerId);

    if (firstLaunch) {
      firstLaunch = false;
      return true;
    }

    if (forceUpdate) {
      return true;
    }

    const timeout =
      timerUtils.getTimeDurationMs({
        hour: 1,
      }) +
      timerUtils.getTimeDurationMs({
        minute: 30,
      }) *
        Math.random();
    syncTimerId = setTimeout(() => {
      void this.fetchAppUpdateInfo();
    }, timeout);
    const now = Date.now();
    if (platformEnv.isExtension) {
      return (
        now - updateAt >
        timerUtils.getTimeDurationMs({
          day: 1,
        })
      );
    }
    return (
      now - updateAt >
      timerUtils.getTimeDurationMs({
        hour: 1,
      })
    );
  }

  // States from which downloadPackage is allowed to be called
  static DOWNLOAD_ENTRY_STATUSES: EAppUpdateStatus[] = [
    EAppUpdateStatus.notify,
    EAppUpdateStatus.done,
    EAppUpdateStatus.downloadPackage, // retry during download
    ...ServiceAppUpdate.FAILED_STATUSES,
  ];

  @backgroundMethod()
  public async downloadPackage() {
    const { status } = await appUpdatePersistAtom.get();
    if (!ServiceAppUpdate.DOWNLOAD_ENTRY_STATUSES.includes(status)) {
      defaultLogger.app.appUpdate.log(
        `downloadPackage: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    clearTimeout(failedRecoveryTimerId);
    downloadTimeoutId = setTimeout(
      async () => {
        await this.downloadPackageFailed({
          message: ETranslations.update_download_timed_out_check_connection,
        });
      },
      timerUtils.getTimeDurationMs({ minute: 30 }),
    );
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      downloadedEvent: undefined,
      status: EAppUpdateStatus.downloadPackage,
    }));
  }

  @backgroundMethod()
  updateErrorText(status: EAppUpdateStatus, errorText: string) {
    void appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: errorText as ETranslations,
      status,
    }));
  }

  @backgroundMethod()
  public async downloadPackageFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.downloadPackage) {
      defaultLogger.app.appUpdate.log(
        `downloadPackageFailed: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    // TODO: need replace by error code.
    let errorText: ETranslations | string =
      e?.message || ETranslations.update_network_exception_check_connection;
    if (errorText.includes('Server not responding')) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (errorText.startsWith('Cannot download')) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (errorText.includes('Software caused connection abort')) {
      errorText = ETranslations.update_network_instability_check_connection;
    }
    const statusNumber = e?.message ? Number(e.message) : undefined;
    if (statusNumber === 500) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (statusNumber === 404 || statusNumber === 403) {
      errorText = ETranslations.update_server_not_responding_try_later;
    }
    defaultLogger.app.error.log(e?.message || errorText);
    this.updateErrorText(EAppUpdateStatus.downloadPackageFailed, errorText);
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async updateDownloadedEvent(downloadedEvent: IUpdateDownloadedEvent) {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      downloadedEvent,
    }));
  }

  @backgroundMethod()
  public async updateDownloadUrl(downloadUrl: string) {
    // Security: Reject empty or non-HTTPS download URLs
    if (!downloadUrl || !downloadUrl.startsWith('https://')) {
      defaultLogger.app.appUpdate.log(
        `updateDownloadUrl: invalid URL rejected: ${downloadUrl}`,
      );
      defaultLogger.app.appUpdate.endInstallPackage(
        false,
        new Error('Download URL must be a non-empty HTTPS URL'),
      );
      return;
    }
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      downloadedEvent: {
        ...prev.downloadedEvent,
        downloadUrl,
      },
    }));
  }

  @backgroundMethod()
  public async getDownloadEvent() {
    const appInfo = await appUpdatePersistAtom.get();
    return appInfo.downloadedEvent;
  }

  @backgroundMethod()
  public async getUpdateInfo() {
    const appInfo = await appUpdatePersistAtom.get();
    return appInfo;
  }

  @backgroundMethod()
  public async verifyPackage() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.verifyASC &&
      status !== EAppUpdateStatus.verifyPackage &&
      status !== EAppUpdateStatus.verifyPackageFailed
    ) {
      defaultLogger.app.appUpdate.log(
        `verifyPackage: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.verifyPackage,
    }));
  }

  @backgroundMethod()
  public async verifyASC() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.downloadASC &&
      status !== EAppUpdateStatus.verifyASC &&
      status !== EAppUpdateStatus.verifyASCFailed
    ) {
      defaultLogger.app.appUpdate.log(
        `verifyASC: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.verifyASC,
    }));
  }

  @backgroundMethod()
  public async downloadASC() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.downloadPackage &&
      status !== EAppUpdateStatus.downloadASC
    ) {
      defaultLogger.app.appUpdate.log(
        `downloadASC: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.downloadASC,
    }));
  }

  @backgroundMethod()
  public async verifyASCFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.verifyASC) {
      defaultLogger.app.appUpdate.log(
        `verifyASCFailed: rejected, current status=${status}`,
      );
      return;
    }
    let errorText =
      e?.message ||
      ETranslations.update_signature_verification_failed_alert_text;
    if (platformEnv.isNativeAndroid) {
      if (errorText === 'UPDATE_SIGNATURE_VERIFICATION_FAILED_ALERT_TEXT')
        errorText =
          ETranslations.update_signature_verification_failed_alert_text;
    }
    defaultLogger.app.error.log(e?.message || errorText);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: errorText as ETranslations,
      status: EAppUpdateStatus.verifyASCFailed,
    }));
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async verifyPackageFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.verifyPackage) {
      defaultLogger.app.appUpdate.log(
        `verifyPackageFailed: rejected, current status=${status}`,
      );
      return;
    }
    let errorText =
      e?.message || ETranslations.update_installation_not_safe_alert_text;
    if (platformEnv.isNativeAndroid) {
      if (errorText === 'PACKAGE_NAME_MISMATCH') {
        errorText = ETranslations.update_package_name_mismatch;
      } else if (errorText === 'UPDATE_INSTALLATION_NOT_SAFE_ALERT_TEXT') {
        errorText = ETranslations.update_installation_not_safe_alert_text;
      }
    }
    defaultLogger.app.error.log(e?.message || errorText);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: errorText as ETranslations,
      status: EAppUpdateStatus.verifyPackageFailed,
    }));
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async downloadASCFailed(e?: { message: string }) {
    const { status } = await appUpdatePersistAtom.get();
    if (status !== EAppUpdateStatus.downloadASC) {
      defaultLogger.app.appUpdate.log(
        `downloadASCFailed: rejected, current status=${status}`,
      );
      return;
    }
    const statusNumber = e?.message ? Number(e.message) : undefined;
    let errorText = '';
    if (statusNumber === 500) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else if (statusNumber === 404 || statusNumber === 403) {
      errorText = ETranslations.update_server_not_responding_try_later;
    } else {
      errorText = ETranslations.update_network_instability_check_connection;
    }
    defaultLogger.app.error.log(e?.message || errorText);
    this.updateErrorText(EAppUpdateStatus.downloadASCFailed, errorText);
    this.startFailedRecoveryTimer();
  }

  @backgroundMethod()
  public async readyToInstall() {
    const { status } = await appUpdatePersistAtom.get();
    if (
      status !== EAppUpdateStatus.verifyPackage &&
      status !== EAppUpdateStatus.ready
    ) {
      defaultLogger.app.appUpdate.log(
        `readyToInstall: rejected, current status=${status}`,
      );
      return;
    }
    clearTimeout(downloadTimeoutId);
    clearTimeout(failedRecoveryTimerId);
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      status: EAppUpdateStatus.ready,
    }));
  }

  @backgroundMethod()
  public async reset() {
    clearTimeout(syncTimerId);
    clearTimeout(downloadTimeoutId);
    clearTimeout(failedRecoveryTimerId);
    await appUpdatePersistAtom.set({
      latestVersion: platformEnv.version,
      jsBundleVersion: platformEnv.bundleVersion,
      updateStrategy: EUpdateStrategy.manual,
      updateAt: 0,
      summary: '',
      status: EAppUpdateStatus.done,
      jsBundle: undefined,
      previousAppVersion: undefined,
      downloadedEvent: undefined,
    });
    await this.backgroundApi.serviceApp.resetLaunchTimesAfterUpdate();
    // Schedule an immediate check so that if a newer version was released
    // while the user was installing the current one, it's discovered right away
    // instead of waiting for the next 1–1.5 hour sync cycle.
    // Guard against re-entrancy: if fetchAppUpdateInfo gets empty data from the
    // server it calls reset() again, which would schedule another fetch, creating
    // an infinite loop.  The isResetting flag breaks the cycle.
    if (!this.isResetting) {
      this.isResetting = true;
      setTimeout(() => {
        void this.fetchAppUpdateInfo().finally(() => {
          this.isResetting = false;
        });
      }, 0);
    }
  }

  @backgroundMethod()
  public async resetToManualInstall() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: undefined,
      status: EAppUpdateStatus.manualInstall,
    }));
  }

  @backgroundMethod()
  public async resetToInComplete() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      errorText: undefined,
      status: EAppUpdateStatus.updateIncomplete,
    }));
  }

  @backgroundMethod()
  public async updateLastDialogShownAt() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      lastUpdateDialogShownAt: Date.now(),
    }));
  }

  @backgroundMethod()
  public async clearLastDialogShownAt() {
    await appUpdatePersistAtom.set((prev) => ({
      ...prev,
      lastUpdateDialogShownAt: undefined,
    }));
  }

  @backgroundMethod()
  public async clearCache() {
    clearTimeout(downloadTimeoutId);
    await AppUpdate.clearPackage();
    await BundleUpdate.clearBundle();
    await this.reset();
  }

  fetchAppChangeLog = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{
        code: number;
        data: {
          changeLog: string;
        };
      }>('/utility/v1/app-update/version-info');
      const { code, data } = response.data;
      return code === 0 ? data?.changeLog : undefined;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
      promise: true,
    },
  );

  @backgroundMethod()
  public async fetchChangeLog() {
    const changeLog = await this.fetchAppChangeLog();
    return changeLog;
  }

  @backgroundMethod()
  public async fetchAppUpdateInfo(forceUpdate = false) {
    const traceId = generateUUID();
    const requestSeq = await this.nextRequestSeq();
    this.logUpdateEvent('app_update_fetch_start', {
      traceId,
      requestSeq,
      forceUpdate,
      taskId: null,
      revision: null,
      action: null,
    });

    await this.cleanupUpdateControlState();
    await this.refreshUpdateStatus();
    // downloading app or ready to update via local package
    const isNeedSync = await this.isNeedSyncAppUpdateInfo(forceUpdate);
    defaultLogger.app.appUpdate.isNeedSyncAppUpdateInfo(isNeedSync);
    if (!isNeedSync) {
      const latest = await appUpdatePersistAtom.get();
      this.logUpdateEvent('app_update_fetch_result', {
        traceId,
        requestSeq,
        hasReleaseInfo: null,
        httpStatus: null,
        reason: 'skip_sync',
        finalStatus: latest.status,
      });
      return latest;
    }

    const releaseInfo = await this.getAppLatestInfo(forceUpdate);
    defaultLogger.app.appUpdate.fetchConfig(releaseInfo);
    this.logUpdateEvent(
      'app_update_fetch_result',
      {
        traceId,
        requestSeq,
        hasReleaseInfo: !!releaseInfo,
        httpStatus: null,
      },
      releaseInfo ? 'info' : 'warn',
    );
    await this.syncPendingInstallTaskWithReleaseInfo(
      releaseInfo,
      requestSeq,
      traceId,
    );

    if (releaseInfo?.version || releaseInfo?.jsBundleVersion) {
      const decision = resolveUpdateDecision({
        currentAppVersion: platformEnv.version,
        currentBundleVersion: platformEnv.bundleVersion,
        remoteAppVersion: releaseInfo.version,
        remoteBundleVersion: releaseInfo.jsBundleVersion,
        allowRollback: true,
      });
      this.logUpdateEvent(
        'app_update_decision_resolved',
        {
          traceId,
          requestSeq,
          decision: decision.decision,
          reason: decision.reason,
          allowRollback: true,
          currentAppVersion: platformEnv.version || '',
          currentBundleVersion: String(platformEnv.bundleVersion || ''),
          targetAppVersion: releaseInfo.version ?? null,
          targetBundleVersion: releaseInfo.jsBundleVersion ?? null,
          ...this.buildTaskLogFields(null),
        },
        decision.isValid ? 'info' : 'warn',
      );

      let shouldUpdate = this.shouldUpdateFromReleaseInfo(releaseInfo);
      if (
        (decision.decision === 'jsBundleUpgrade' ||
          decision.decision === 'jsBundleRollback') &&
        releaseInfo.version &&
        releaseInfo.jsBundleVersion
      ) {
        const targetKey = getTargetVersionKey(
          releaseInfo.version,
          releaseInfo.jsBundleVersion,
        );
        const blockedByControl = await this.shouldSkipTargetByControl(
          targetKey,
          traceId,
          requestSeq,
          false,
        );
        if (blockedByControl) {
          shouldUpdate = false;
          this.logUpdateEvent('pending_task_upsert_decision', {
            traceId,
            requestSeq,
            upsertAction: 'drop',
            reason: 'frozen_or_ignored_target_for_notify',
            target: targetKey,
          });
        }
      }

      await appUpdatePersistAtom.set((prev) => {
        const isUpdating = prev.status !== EAppUpdateStatus.done;

        // Check if the current state is a failed state and the server has
        // a newer version than the one we were trying to update to.
        // In that case, reset to notify so the user gets the new version
        // instead of retrying a stale download.
        const failedStatuses: EAppUpdateStatus[] = [
          EAppUpdateStatus.downloadPackageFailed,
          EAppUpdateStatus.downloadASCFailed,
          EAppUpdateStatus.verifyASCFailed,
          EAppUpdateStatus.verifyPackageFailed,
        ];
        const isFailed = failedStatuses.includes(prev.status);
        let isNewerThanAttempted = false;
        if (isFailed && releaseInfo.version && prev.latestVersion) {
          try {
            isNewerThanAttempted = semver.gt(
              releaseInfo.version,
              prev.latestVersion,
            );
          } catch (error) {
            defaultLogger.app.appUpdate.log(
              `fetchAppUpdateInfo: semver compare failed, releaseVersion=${
                releaseInfo.version ?? 'nil'
              }, prevVersion=${prev.latestVersion ?? 'nil'}, error=${
                (error as Error)?.message ?? 'unknown'
              }`,
            );
          }
        }
        if (
          isFailed &&
          !isNewerThanAttempted &&
          releaseInfo.jsBundleVersion &&
          prev.jsBundleVersion
        ) {
          isNewerThanAttempted =
            Number(releaseInfo.jsBundleVersion) !==
            Number(prev.jsBundleVersion);
        }
        const shouldResetFailed = isFailed && isNewerThanAttempted;
        // Corrupted/tampered packages must be re-downloaded
        const isVerifyFailure =
          shouldResetFailed &&
          ServiceAppUpdate.VERIFY_FAILED_STATUSES.includes(prev.status);

        const shouldTransitionToNotify =
          shouldUpdate && (!isUpdating || shouldResetFailed);
        const nextStatus = shouldTransitionToNotify
          ? EAppUpdateStatus.notify
          : prev.status;

        this.logUpdateEvent('pending_task_upsert_decision', {
          traceId,
          requestSeq,
          upsertAction: shouldTransitionToNotify ? 'update' : 'noop',
          reason: shouldTransitionToNotify
            ? 'status_transition_to_notify'
            : 'status_kept',
          decision: shouldUpdate ? 'should_update' : 'no_update',
          prevStatus: prev.status,
          nextStatus,
          prevLatestVersion: prev.latestVersion ?? null,
          nextVersion: releaseInfo.version || prev.latestVersion || null,
          prevBundleVersion: prev.jsBundleVersion ?? null,
          nextBundleVersion:
            releaseInfo.jsBundleVersion || prev.jsBundleVersion || null,
        });

        return {
          ...prev,
          ...releaseInfo,
          // Explicitly clear stale URLs when server no longer returns them
          // (e.g. switch from App Store update to jsBundle update).
          storeUrl: releaseInfo.storeUrl || undefined,
          downloadUrl: releaseInfo.downloadUrl || undefined,
          changeLog: releaseInfo.changeLog || undefined,
          fileSize: releaseInfo.fileSize,
          jsBundleVersion: releaseInfo.jsBundleVersion || undefined,
          jsBundle: releaseInfo.jsBundle || undefined,
          summary: releaseInfo?.summary || '',
          latestVersion: releaseInfo.version || prev.latestVersion,
          updateAt: Date.now(),
          errorText: shouldResetFailed ? undefined : prev.errorText,
          downloadedEvent: isVerifyFailure ? undefined : prev.downloadedEvent,
          status: nextStatus,
          previousAppVersion: shouldTransitionToNotify
            ? platformEnv.version
            : prev.previousAppVersion,
        };
      });
    } else {
      this.logUpdateEvent(
        'app_update_decision_resolved',
        {
          traceId,
          requestSeq,
          decision: 'invalidRemote',
          reason: 'missing_release_versions',
          allowRollback: true,
          currentAppVersion: platformEnv.version || '',
          currentBundleVersion: String(platformEnv.bundleVersion || ''),
          targetAppVersion: releaseInfo?.version ?? null,
          targetBundleVersion: releaseInfo?.jsBundleVersion ?? null,
          ...this.buildTaskLogFields(null),
        },
        'warn',
      );
    }
    const latest = await appUpdatePersistAtom.get();
    this.logUpdateEvent('app_update_fetch_result', {
      traceId,
      requestSeq,
      hasReleaseInfo: !!releaseInfo,
      httpStatus: null,
      finalStatus: latest.status,
      latestVersion: latest.latestVersion ?? null,
      latestBundleVersion: latest.jsBundleVersion ?? null,
    });
    return latest;
  }

  // ---- Dev Bundle Switcher ----

  private getDevBundleSwitcherClient = memoizee(
    async () =>
      appApiClient.getBasicClient({
        name: EServiceEndpointEnum.Utility,
        endpoint: buildServiceEndpoint({
          serviceName: EServiceEndpointEnum.Utility,
          env: 'test',
        }),
      }),
    { promise: true },
  );

  @backgroundMethod()
  async devFetchBundleVersions(): Promise<
    { version: string; bundleCount: number }[]
  > {
    try {
      const client = await this.getDevBundleSwitcherClient();
      const response = await client.get<{
        code: number;
        data: { version: string; bundleCount: number }[];
      }>('/utility/v1/app-update/bundle-versions');
      const { code, data } = response.data;
      if (code === 0 && data) {
        defaultLogger.app.jsBundleDev.fetchBundleVersions({
          resultCount: data.length,
          versions: data,
        });
        return data;
      }
      defaultLogger.app.jsBundleDev.fetchBundleVersionsError(
        `Unexpected response code: ${code}`,
      );
      return [];
    } catch (e) {
      defaultLogger.app.jsBundleDev.fetchBundleVersionsError(
        (e as Error)?.message || 'Unknown error',
      );
      return [];
    }
  }

  @backgroundMethod()
  async devFetchBundlesForVersion(version: string): Promise<
    {
      bundleVersion: string;
      downloadUrl: string;
      sha256: string;
      signature?: string;
      fileSize: number;
      commitHash?: string;
      changeLog?: string;
    }[]
  > {
    try {
      const client = await this.getDevBundleSwitcherClient();
      const response = await client.get<{
        code: number;
        data: {
          bundleVersion: string;
          downloadUrl: string;
          sha256: string;
          signature?: string;
          fileSize: number;
          commitHash?: string;
          branch?: string;
        }[];
      }>('/utility/v1/app-update/bundles', {
        params: { version },
      });
      const { code, data } = response.data;
      if (code === 0 && data) {
        defaultLogger.app.jsBundleDev.fetchBundles({
          version,
          resultCount: data.length,
          bundles: data.map((item) => ({
            bundleVersion: item.bundleVersion,
            downloadUrl: item.downloadUrl,
            sha256: item.sha256,
            fileSize: item.fileSize,
          })),
        });
        return data.map((item) => ({
          bundleVersion: item.bundleVersion,
          downloadUrl: item.downloadUrl,
          sha256: item.sha256,
          signature: item.signature || PLACEHOLDER_SIGNATURE,
          fileSize: item.fileSize,
          commitHash: item.commitHash,
          changeLog: item.commitHash
            ? `${item.branch || ''} ${item.commitHash.slice(0, 8)}`.trim()
            : undefined,
        }));
      }
      defaultLogger.app.jsBundleDev.fetchBundlesError({
        version,
        error: `Unexpected response code: ${code}`,
      });
      return [];
    } catch (e) {
      defaultLogger.app.jsBundleDev.fetchBundlesError({
        version,
        error: (e as Error)?.message || 'Unknown error',
      });
      return [];
    }
  }
}

export default ServiceAppUpdate;
