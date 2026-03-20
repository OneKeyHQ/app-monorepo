import type {
  IAppUpdateInstallTaskPayload,
  IJsBundleSwitchTaskPayload,
  IPendingInstallTask,
  IResponseAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EPendingInstallTaskAction,
  EPendingInstallTaskStatus,
  EPendingInstallTaskType,
  EUpdateStrategy,
  resolveUpdateDecision,
} from '@onekeyhq/shared/src/appUpdate';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { appUpdatePersistAtom } from '../states/jotai/atoms';

export const PLACEHOLDER_SIGNATURE = 'dev-no-signature';
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
const PENDING_ACTION_SWITCH_BUNDLE = EPendingInstallTaskAction.switchBundle;
const PENDING_ACTION_INSTALL_APP = EPendingInstallTaskAction.installApp;

export async function getPendingInstallTask() {
  return appStorage.syncStorage.getObject<IPendingInstallTask>(
    EAppSyncStorageKeys.onekey_pending_install_task,
  );
}

export async function setPendingInstallTask(task: IPendingInstallTask) {
  await Promise.resolve(
    appStorage.syncStorage.setObject(
      EAppSyncStorageKeys.onekey_pending_install_task,
      task as Record<string, any>,
    ),
  );
}

export async function clearPendingInstallTask() {
  await Promise.resolve(
    appStorage.syncStorage.delete(
      EAppSyncStorageKeys.onekey_pending_install_task,
    ),
  );
}

@backgroundClass()
class ServicePendingInstallTask {
  constructor({
    backgroundApi,
    refreshUpdateStatus,
  }: {
    backgroundApi?: any;
    refreshUpdateStatus?: () => Promise<void>;
  } = {}) {
    this.backgroundApi = backgroundApi;
    this.refreshUpdateStatus =
      refreshUpdateStatus ??
      (async () => {
        const svc = this.backgroundApi?.serviceAppUpdate as
          | { refreshUpdateStatus?: () => Promise<void> }
          | undefined;
        await svc?.refreshUpdateStatus?.();
      });
  }

  private backgroundApi?: any;

  private refreshUpdateStatus: () => Promise<void>;

  private isProcessingPendingTask = false;

  private pendingTaskLockAcquiredAt = 0;

  private fallbackRequestSeqCounter = 0;

  public setRefreshUpdateStatus(refreshUpdateStatus: () => Promise<void>) {
    this.refreshUpdateStatus = refreshUpdateStatus;
  }

  @backgroundMethod()
  public async getPendingInstallTask() {
    return getPendingInstallTask();
  }

  @backgroundMethod()
  public async setPendingInstallTask(task: IPendingInstallTask) {
    await setPendingInstallTask(task);
  }

  @backgroundMethod()
  public async clearPendingInstallTask() {
    await clearPendingInstallTask();
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
    defaultLogger.app.appUpdate.pendingTaskCleared(
      {
        traceId,
        requestSeq: requestSeq ?? null,
        ...this.buildTaskLogFields(task),
        clearReason,
      },
      level,
    );
  }

  public getTargetKey(taskOrTarget: {
    targetAppVersion: string;
    targetBundleVersion: string;
  }) {
    return `${taskOrTarget.targetAppVersion}:${taskOrTarget.targetBundleVersion}`;
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

  private isTaskTargetAligned(task: IPendingInstallTask) {
    if (task.type === EPendingInstallTaskType.appInstall) {
      return task.targetAppVersion === (platformEnv.version || '');
    }
    return this.isTargetAligned(
      task.targetAppVersion,
      task.targetBundleVersion,
    );
  }

  private async isRunningBuiltinBundle(): Promise<boolean> {
    try {
      const builtinVersion = await BundleUpdate.getBuiltinBundleVersion();
      const currentVersion = String(platformEnv.bundleVersion || '');
      return !!builtinVersion && currentVersion === builtinVersion;
    } catch {
      return false;
    }
  }

  @backgroundMethod()
  public async nextRequestSeq() {
    this.fallbackRequestSeqCounter += 1;
    const fallbackSeq = this.fallbackRequestSeqCounter;
    let requestSeq = 0;
    await appUpdatePersistAtom.set((prev) => {
      const prevSeq = Number(prev.lastRequestSeq || 0);
      const nextSeq =
        Number.isSafeInteger(prevSeq) && prevSeq > 0
          ? prevSeq + 1
          : Date.now() * 1000 + fallbackSeq;
      requestSeq = nextSeq;
      return {
        ...prev,
        lastRequestSeq: nextSeq,
      };
    });
    return requestSeq || Date.now() * 1000 + fallbackSeq;
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

  @backgroundMethod()
  public async cleanupUpdateControlState() {
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
    defaultLogger.app.appUpdate.updateControlFrozenOrIgnored(
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
      ![PENDING_ACTION_SWITCH_BUNDLE, PENDING_ACTION_INSTALL_APP].includes(
        t.action,
      ) ||
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
    if (!Object.values(EPendingInstallTaskStatus).includes(t.status)) {
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

  private isValidAppShellInstallPayload(payload: unknown) {
    const p = payload as IAppUpdateInstallTaskPayload;
    if (!p?.latestVersion) {
      return false;
    }
    if (p.channel !== 'direct' && p.channel !== 'store') {
      return false;
    }
    if (p.channel === 'direct') {
      return !!p.downloadUrl;
    }
    return !!p.storeUrl;
  }

  private isValidPendingInstallTask(
    task: unknown,
  ): task is IPendingInstallTask {
    if (!this.isValidTaskBase(task)) {
      return false;
    }
    if (task.type === EPendingInstallTaskType.jsBundleSwitch) {
      return (
        task.action === PENDING_ACTION_SWITCH_BUNDLE &&
        this.isValidJsBundleSwitchPayload(task.payload)
      );
    }
    if (task.type === EPendingInstallTaskType.appInstall) {
      return (
        task.action === PENDING_ACTION_INSTALL_APP &&
        this.isValidAppShellInstallPayload(task.payload)
      );
    }
    return false;
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

  private async buildPendingJsBundleTask(
    releaseInfo: IResponseAppUpdateInfo,
    revision: number,
  ): Promise<IPendingInstallTask | undefined> {
    const appVersion = releaseInfo.version;
    const bundleVersion = releaseInfo.jsBundleVersion;
    if (!appVersion || !bundleVersion) {
      return undefined;
    }

    const [nativeAppVersion, nativeBuildNumber] = await Promise.all([
      BundleUpdate.getNativeAppVersion(),
      BundleUpdate.getNativeBuildNumber(),
    ]);
    const now = Date.now();
    return {
      taskId: `jsbundle:${appVersion}:${bundleVersion}`,
      revision,
      action: PENDING_ACTION_SWITCH_BUNDLE,
      type: EPendingInstallTaskType.jsBundleSwitch,
      targetAppVersion: appVersion,
      targetBundleVersion: bundleVersion,
      scheduledEnvAppVersion: nativeAppVersion || platformEnv.version || '',
      scheduledEnvBundleVersion: String(platformEnv.bundleVersion || ''),
      scheduledEnvBuildNumber: nativeBuildNumber || '',
      createdAt: now,
      expiresAt: now + timerUtils.getTimeDurationMs({ day: 7 }),
      retryCount: 0,
      status: EPendingInstallTaskStatus.pending,
      payload: {
        appVersion,
        bundleVersion,
        signature: releaseInfo.jsBundle?.signature ?? PLACEHOLDER_SIGNATURE,
      },
    };
  }

  private async buildPendingAppShellTask(
    appInfo: Awaited<ReturnType<typeof appUpdatePersistAtom.get>>,
    revision: number,
  ): Promise<IPendingInstallTask | undefined> {
    if (!appInfo.latestVersion) {
      return undefined;
    }
    const downloadUrl =
      appInfo.downloadedEvent?.downloadUrl || appInfo.downloadUrl;
    const downloadedFile = appInfo.downloadedEvent?.downloadedFile;
    if (!downloadUrl || !downloadedFile) {
      return undefined;
    }
    const [nativeAppVersion, nativeBuildNumber] = await Promise.all([
      BundleUpdate.getNativeAppVersion(),
      BundleUpdate.getNativeBuildNumber(),
    ]);
    const now = Date.now();
    return {
      taskId: `appShell:${appInfo.latestVersion}:direct`,
      revision,
      action: PENDING_ACTION_INSTALL_APP,
      type: EPendingInstallTaskType.appInstall,
      targetAppVersion: appInfo.latestVersion,
      targetBundleVersion:
        appInfo.jsBundleVersion || String(platformEnv.bundleVersion || ''),
      scheduledEnvAppVersion: nativeAppVersion || platformEnv.version || '',
      scheduledEnvBundleVersion: String(platformEnv.bundleVersion || ''),
      scheduledEnvBuildNumber: nativeBuildNumber || '',
      createdAt: now,
      expiresAt: now + timerUtils.getTimeDurationMs({ day: 7 }),
      retryCount: 0,
      status: EPendingInstallTaskStatus.pending,
      payload: {
        latestVersion: appInfo.latestVersion,
        updateStrategy: appInfo.updateStrategy,
        channel: 'direct',
        storeUrl: appInfo.storeUrl,
        downloadUrl,
        fileSize: appInfo.fileSize,
        sha256: appInfo.downloadedEvent?.sha256,
        signature: appInfo.downloadedEvent?.signature,
      },
    };
  }

  @backgroundMethod()
  public async shouldSkipTargetByControl(
    targetKey: string,
    traceId: string,
    requestSeq: number,
    emitLog = true,
  ) {
    const now = Date.now();
    const appInfo = await appUpdatePersistAtom.get();
    if ((appInfo.freezeUntil || 0) > now) {
      if (emitLog) {
        defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
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
        defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
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

  @backgroundMethod()
  public async syncPendingInstallTaskWithReleaseInfo({
    releaseInfo,
    requestSeq,
    traceId,
    stage,
    appInfo,
  }: {
    releaseInfo: IResponseAppUpdateInfo | undefined;
    requestSeq: number;
    traceId: string;
    stage: 'fetch' | 'ready_to_install';
    appInfo?: Awaited<ReturnType<typeof appUpdatePersistAtom.get>>;
  }) {
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
    defaultLogger.app.appUpdate.appUpdateDecisionResolved({
      traceId,
      requestSeq,
      decision: decision.decision,
      reason: decision.reason,
      allowRollback: true,
      currentAppVersion: platformEnv.version,
      currentBundleVersion: String(platformEnv.bundleVersion || ''),
      targetAppVersion: releaseInfo.version ?? null,
      targetBundleVersion: releaseInfo.jsBundleVersion ?? null,
      stage,
    });

    // jsBundleRollbackToBuiltin is handled by fetchAppUpdateInfo which
    // creates a pending task with targetBundleVersion="0".  On next cold
    // start, executeBundleSwitchTask detects the missing bundle and falls
    // back to builtin via resetToBuiltInBundle + restart.

    if (
      decision.decision !== 'appShellUpdate' &&
      decision.decision !== 'jsBundleUpgrade' &&
      decision.decision !== 'jsBundleRollback'
    ) {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        upsertAction: 'noop',
        reason: `decision_${decision.decision}`,
        stage,
      });
      return;
    }

    // Rollback always creates a pending task regardless of server strategy —
    // it is a corrective action that should not require user confirmation.
    if (
      decision.decision !== 'jsBundleRollback' &&
      releaseInfo.updateStrategy !== EUpdateStrategy.seamless
    ) {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        upsertAction: 'drop',
        reason: 'strategy_not_restart_install',
        updateStrategy: releaseInfo.updateStrategy ?? null,
        stage,
      });
      return;
    }

    if (stage !== 'ready_to_install') {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        upsertAction: 'drop',
        reason: 'resources_not_ready',
        stage,
      });
      return;
    }

    const runtimeAppInfo = appInfo || (await appUpdatePersistAtom.get());
    if (!runtimeAppInfo.downloadedEvent?.downloadedFile) {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        upsertAction: 'drop',
        reason: 'downloaded_event_missing',
        stage,
      });
      return;
    }

    const task =
      decision.decision === 'appShellUpdate'
        ? await this.buildPendingAppShellTask(runtimeAppInfo, requestSeq)
        : await this.buildPendingJsBundleTask(
            {
              ...releaseInfo,
              jsBundle: {
                ...releaseInfo.jsBundle,
                signature:
                  runtimeAppInfo.downloadedEvent?.signature ??
                  releaseInfo.jsBundle?.signature,
              },
            },
            requestSeq,
          );
    if (!task || !this.isValidPendingInstallTask(task)) {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision(
        {
          traceId,
          requestSeq,
          upsertAction: 'drop',
          reason: 'invalid_new_task',
          stage,
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
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'create',
        reason: 'no_existing_task',
        stage,
      });
      return;
    }

    if (!this.isValidPendingInstallTask(existingRaw)) {
      defaultLogger.app.appUpdate.pendingTaskUnknownTypeDropped(
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
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'create',
        reason: 'replace_invalid_task',
        stage,
      });
      return;
    }

    const existing = existingRaw;
    if (existing.revision > requestSeq) {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision(
        {
          traceId,
          requestSeq,
          taskId: existing.taskId,
          revision: existing.revision,
          action: existing.action,
          upsertAction: 'drop',
          reason: 'stale_request_seq',
          stage,
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
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'noop',
        reason: 'same_revision_same_target',
        stage,
      });
      return;
    }

    if (existing.taskId === task.taskId) {
      if (
        existing.status === EPendingInstallTaskStatus.running ||
        existing.status === EPendingInstallTaskStatus.appliedWaitingVerify
      ) {
        defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
          traceId,
          requestSeq,
          upsertAction: 'drop',
          reason: 'same_target_in_progress',
          existingStatus: existing.status,
          ...this.buildTaskLogFields(existing),
          stage,
        });
        return;
      }
      await setPendingInstallTask({
        ...task,
        retryCount: existing.retryCount,
        nextRetryAt: existing.nextRetryAt,
        status: existing.status,
        runningStartedAt: existing.runningStartedAt,
        lastError: existing.lastError,
      });
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        upsertAction: 'update',
        reason: 'same_target_keep_retry_state',
        stage,
      });
      return;
    }

    if (
      existing.status === EPendingInstallTaskStatus.running ||
      existing.status === EPendingInstallTaskStatus.appliedWaitingVerify
    ) {
      defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
        traceId,
        requestSeq,
        upsertAction: 'drop',
        reason: 'existing_task_in_progress',
        existingStatus: existing.status,
        ...this.buildTaskLogFields(existing),
        stage,
      });
      return;
    }

    await setPendingInstallTask(task);
    defaultLogger.app.appUpdate.pendingTaskUpsertDecision({
      traceId,
      requestSeq,
      taskId: task.taskId,
      revision: task.revision,
      action: task.action,
      upsertAction: 'update',
      reason: 'newer_revision_replace_target',
      stage,
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
      defaultLogger.app.appUpdate.fullFlowRetryTriggered(
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
      status: EPendingInstallTaskStatus.pending,
      runningStartedAt: undefined,
      lastError: message,
      nextRetryAt,
    });
    defaultLogger.app.appUpdate.pendingRetryScheduled(
      {
        traceId,
        requestSeq: requestSeq ?? null,
        taskId: task.taskId,
        revision: task.revision,
        action: task.action,
        retryCount: nextRetryCount,
        nextRetryAt,
        retryType: (() => {
          if (message === RETRY_TRIGGER_INTERRUPTED) return 'interrupted';
          if (task.action === PENDING_ACTION_INSTALL_APP) return 'install';
          return 'switch';
        })(),
      },
      'warn',
    );
  }

  private async executeBundleSwitchTask(
    task: Extract<
      IPendingInstallTask,
      { type: EPendingInstallTaskType.jsBundleSwitch }
    >,
  ) {
    const payload = task.payload;
    const { appVersion, bundleVersion, signature } = payload;
    const bundleExists = await BundleUpdate.isBundleExists(
      appVersion,
      bundleVersion,
    );
    if (!bundleExists) {
      // The target bundle is not extracted locally.  If this is a rollback
      // (target < current), fall back to the builtin bundle instead of
      // retrying the download — the builtin bundle is always available.
      const currentBundle = Number(platformEnv.bundleVersion || '0');
      const targetBundle = Number(bundleVersion || '0');
      if (
        Number.isFinite(currentBundle) &&
        Number.isFinite(targetBundle) &&
        targetBundle < currentBundle
      ) {
        // If native already rolled back to builtin (e.g. bundle validation
        // failed at native startup), we are already running the builtin
        // bundle.  Just clear native metadata and the pending task — no
        // restart needed.
        const alreadyBuiltin = await this.isRunningBuiltinBundle();
        if (alreadyBuiltin) {
          defaultLogger.app.appUpdate.log(
            `executeBundleSwitchTask: rollback target ${bundleVersion} not found locally, already on builtin — clearing without restart`,
          );
          await clearPendingInstallTask();
          await BundleUpdate.resetToBuiltInBundle();
          // Throw to skip the caller's success path which would re-persist
          // the cleared task as appliedWaitingVerify.
          throw new OneKeyLocalError('BUILTIN_ALREADY_ACTIVE');
        }

        defaultLogger.app.appUpdate.log(
          `executeBundleSwitchTask: rollback target ${bundleVersion} not found locally, falling back to builtin`,
        );
        // Clear the pending task before relaunch — the task targets the
        // missing bundle version, not builtin.  Without clearing, post-
        // relaunch verification would fail against the stale target.
        // We clear AND throw so the caller's success path (which would
        // re-persist the task as appliedWaitingVerify) is skipped.
        await clearPendingInstallTask();
        await BundleUpdate.resetToBuiltInBundle();
        BundleUpdate.restart();
        // restart schedules app relaunch after 2.5s on native / app.exit(0)
        // on desktop, so the throw below is a safety net for unexpected
        // survival.
        throw new OneKeyLocalError('BUILTIN_FALLBACK_RELAUNCH');
      }
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

    // NOTE: switchBundle no longer has its own version-downgrade guard.
    // Version-downgrade (rollback) is intentionally allowed ONLY through
    // this pending-task engine path.  UI-driven paths (installPackage /
    // manualInstallPackage) cannot trigger rollback because
    // isNeedUpdate.shouldUpdate excludes jsBundleRollback.

    // Persist appliedWaitingVerify BEFORE switchBundle because switchBundle
    // terminates the process (desktop: app.exit(0), native: RNRestart after
    // 2.5s).  Code after switchBundle never executes, so the caller's
    // post-execution status update is unreachable.  Without this, the task
    // stays stuck in "running" and blocks subsequent tasks for up to 5 min.
    await setPendingInstallTask({
      ...task,
      status: EPendingInstallTaskStatus.appliedWaitingVerify,
      lastError: undefined,
    });
    await BundleUpdate.switchBundle({
      appVersion,
      bundleVersion,
      signature,
    });
  }

  private async executeAppShellInstallTask(
    task: Extract<
      IPendingInstallTask,
      { type: EPendingInstallTaskType.appInstall }
    >,
  ) {
    const payload = task.payload;
    if (payload.channel !== 'direct') {
      throw new OneKeyLocalError('APP_INSTALL_CHANNEL_UNSUPPORTED');
    }
    const appInfo = await appUpdatePersistAtom.get();
    const downloadUrl =
      appInfo.downloadedEvent?.downloadUrl || payload.downloadUrl;
    if (!appInfo.downloadedEvent?.downloadedFile || !downloadUrl) {
      throw new OneKeyLocalError('APP_PACKAGE_MISSING');
    }
    await AppUpdate.installPackage({
      ...appInfo,
      latestVersion: payload.latestVersion,
      updateStrategy: payload.updateStrategy,
      storeUrl: payload.storeUrl || appInfo.storeUrl,
      downloadUrl: payload.downloadUrl || appInfo.downloadUrl,
      fileSize: payload.fileSize ?? appInfo.fileSize,
      downloadedEvent: {
        ...appInfo.downloadedEvent,
        downloadUrl,
      },
    });
  }

  private async executePendingInstallTask(task: IPendingInstallTask) {
    if (task.type === EPendingInstallTaskType.jsBundleSwitch) {
      await this.executeBundleSwitchTask(task);
      return;
    }
    if (task.type === EPendingInstallTaskType.appInstall) {
      await this.executeAppShellInstallTask(task);
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
    defaultLogger.app.appUpdate.pendingPostProcessRefreshStart({
      traceId,
      requestSeq,
      ...this.buildTaskLogFields(task),
    });
    try {
      await this.refreshUpdateStatus();
      defaultLogger.app.appUpdate.pendingPostProcessRefreshResult({
        traceId,
        requestSeq,
        result: 'success',
        durationMs: Date.now() - startedAt,
        ...this.buildTaskLogFields(task),
      });
    } catch (error) {
      const message = (error as Error)?.message ?? 'unknown';
      defaultLogger.app.appUpdate.pendingPostProcessRefreshResult(
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

  @backgroundMethod()
  public async processPendingInstallTask() {
    const traceId = generateUUID();
    const requestSeq = null;
    let shouldRunPostRefresh = false;
    let processedTaskSnapshot: Partial<IPendingInstallTask> | null = null;
    const lockNow = Date.now();
    if (this.isProcessingPendingTask) {
      const lockHeldMs = lockNow - this.pendingTaskLockAcquiredAt;
      if (lockHeldMs > PROCESS_LOCK_TIMEOUT_MS) {
        defaultLogger.app.appUpdate.pendingTaskLockState(
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
        defaultLogger.app.appUpdate.pendingTaskLockState({
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
    defaultLogger.app.appUpdate.pendingTaskLockState({
      traceId,
      requestSeq,
      lockState: 'acquired',
      lockTimeoutMs: PROCESS_LOCK_TIMEOUT_MS,
    });

    try {
      await this.cleanupUpdateControlState();

      const rawTask = await getPendingInstallTask();
      if (!rawTask) {
        defaultLogger.app.appUpdate.pendingTaskValidation({
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
        defaultLogger.app.appUpdate.pendingTaskUnknownTypeDropped(
          {
            traceId,
            requestSeq,
            taskType: (rawTask as { type?: string })?.type || 'unknown',
          },
          'warn',
        );
        defaultLogger.app.appUpdate.pendingTaskValidation(
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
      defaultLogger.app.appUpdate.pendingTaskValidation({
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
      if (task.status === EPendingInstallTaskStatus.failed) {
        await this.clearPendingTaskWithLog({
          traceId,
          task,
          clearReason: 'task_already_failed_self_heal',
          level: 'warn',
        });
        return;
      }

      if (task.status === EPendingInstallTaskStatus.appliedWaitingVerify) {
        const aligned = this.isTaskTargetAligned(task);
        // If target is already aligned, clear immediately — no grace period
        // needed.  This avoids blocking subsequent tasks (e.g. rollback) while
        // waiting for a grace period that serves no purpose when the switch has
        // clearly succeeded.
        if (aligned) {
          defaultLogger.app.appUpdate.pendingVerifyAfterRestart({
            traceId,
            requestSeq,
            aligned,
            currentAppVersion: platformEnv.version || '',
            currentBundleVersion: String(platformEnv.bundleVersion || ''),
            ...this.buildTaskLogFields(task),
          });
          await this.resetTargetControlState(targetKey);
          await this.clearPendingTaskWithLog({
            traceId,
            task,
            clearReason: 'applied_task_verified_success',
          });
          return;
        }
        // Target not aligned yet — apply grace period before marking failed,
        // because platformEnv may not be fully initialized right after restart.
        if (task.runningStartedAt) {
          const gracePeriodMs = timerUtils.getTimeDurationMs({ minute: 10 });
          if (now - task.runningStartedAt < gracePeriodMs) {
            defaultLogger.app.appUpdate.pendingTaskValidation({
              traceId,
              requestSeq,
              isValid: true,
              invalidReason: 'applied_verify_grace_period',
              ...this.buildTaskLogFields(task),
            });
            return;
          }
        }
        defaultLogger.app.appUpdate.pendingVerifyAfterRestart(
          {
            traceId,
            requestSeq,
            aligned,
            currentAppVersion: platformEnv.version || '',
            currentBundleVersion: String(platformEnv.bundleVersion || ''),
            ...this.buildTaskLogFields(task),
          },
          'error',
        );
        await this.markTaskFailed(
          task,
          'VERIFY_AFTER_RESTART_MISMATCH',
          traceId,
          undefined,
        );
        return;
      }

      if (task.status === EPendingInstallTaskStatus.running) {
        const runningStartedAt = task.runningStartedAt || task.createdAt;
        const runningDuration = now - runningStartedAt;
        if (runningDuration <= RUNNING_TASK_STALE_MS) {
          defaultLogger.app.appUpdate.pendingTaskLockState({
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
      const [nativeAppVersion, nativeBuildNumber] = await Promise.all([
        BundleUpdate.getNativeAppVersion(),
        BundleUpdate.getNativeBuildNumber(),
      ]);
      const targetMatch = this.isTaskTargetAligned(task);
      const scheduledAppVersionMatch =
        task.scheduledEnvAppVersion === currentAppVersion;
      const scheduledBundleVersionMatch =
        task.scheduledEnvBundleVersion === currentBundleVersion;
      // Compare against native values to detect same-version native rebuilds
      // (e.g. hotfix that keeps appVersion but bumps buildNumber).
      const nativeAppVersionMatch =
        !nativeAppVersion || task.scheduledEnvAppVersion === nativeAppVersion;
      const nativeBuildNumberMatch =
        !task.scheduledEnvBuildNumber ||
        !nativeBuildNumber ||
        task.scheduledEnvBuildNumber === nativeBuildNumber;
      const scheduledMatch =
        scheduledAppVersionMatch &&
        scheduledBundleVersionMatch &&
        nativeAppVersionMatch &&
        nativeBuildNumberMatch;
      let envMatch: 'target' | 'scheduled' | 'mismatch' = 'mismatch';
      if (targetMatch) {
        envMatch = 'target';
      } else if (scheduledMatch) {
        envMatch = 'scheduled';
      }

      defaultLogger.app.appUpdate.pendingTaskEnvCheck({
        traceId,
        requestSeq,
        envMatch,
        currentAppVersion,
        currentBundleVersion,
        nativeAppVersion: nativeAppVersion || null,
        nativeBuildNumber: nativeBuildNumber || null,
        scheduledEnvAppVersion: task.scheduledEnvAppVersion,
        scheduledEnvBundleVersion: task.scheduledEnvBundleVersion,
        scheduledEnvBuildNumber: task.scheduledEnvBuildNumber || null,
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
        defaultLogger.app.appUpdate.pendingTaskValidation({
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
        status: EPendingInstallTaskStatus.running,
        runningStartedAt: Date.now(),
      };
      await setPendingInstallTask(runningTask);
      const startedAt = Date.now();
      defaultLogger.app.appUpdate.pendingSwitchStart({
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
          status: EPendingInstallTaskStatus.appliedWaitingVerify,
          lastError: undefined,
        });
        defaultLogger.app.appUpdate.pendingSwitchResult({
          traceId,
          requestSeq,
          result: 'success',
          durationMs,
          ...this.buildTaskLogFields(runningTask),
        });
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = (error as Error)?.message ?? 'unknown';
        // Builtin fallback already cleared the task and triggered relaunch,
        // or native already rolled back so no restart is needed.
        // Do not re-persist or retry.
        if (
          message === 'BUILTIN_FALLBACK_RELAUNCH' ||
          message === 'BUILTIN_ALREADY_ACTIVE'
        ) {
          defaultLogger.app.appUpdate.pendingSwitchResult({
            traceId,
            requestSeq,
            result:
              message === 'BUILTIN_ALREADY_ACTIVE'
                ? 'builtin_already_active'
                : 'builtin_fallback',
            durationMs,
            ...this.buildTaskLogFields(runningTask),
          });
        } else {
          defaultLogger.app.appUpdate.pendingSwitchResult(
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
      defaultLogger.app.appUpdate.pendingTaskLockState({
        traceId,
        requestSeq,
        lockState: 'released',
        lockTimeoutMs: PROCESS_LOCK_TIMEOUT_MS,
      });
    }
  }
}

export { ServicePendingInstallTask };
export default ServicePendingInstallTask;
