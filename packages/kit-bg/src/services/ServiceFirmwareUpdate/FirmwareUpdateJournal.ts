// cspell:ignore fwtx

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  SimpleDbEntityFirmwareUpdateJournal,
  isFirmwareUpdateJournalStorageCorruptionError,
} from '../../dbs/simple/entity/SimpleDbEntityFirmwareUpdateJournal';

import { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';

import type { IFirmwareArtifactAdapter } from './FirmwareArtifactAdapter.types';
import type { IPreparedFirmwareArtifacts } from './FirmwareArtifactPreflight';
import type { IFirmwareUpdateRolloutDecision } from './FirmwareUpdateRolloutPolicy';
import type {
  FirmwareCheckpoint,
  FirmwareUpdatePlan,
  FirmwareUpdatePreparedPlan,
} from '@onekeyfe/hd-core';

export type EFirmwareUpdateJournalPhase =
  | 'PREPARING'
  | 'PREPARED'
  | 'EXECUTING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABANDONED';

export type IFirmwareUpdateJournalPrepared = FirmwareUpdatePreparedPlan;

type IFirmwareUpdateRolloutSnapshot = {
  source: IFirmwareUpdateRolloutDecision['source'];
  policyVersion: number;
  cohortBucket: number;
  percentageBps: number;
};

export type IFirmwareUpdateJournalEnvelope = {
  schemaVersion: 1;
  transactionId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  phase: EFirmwareUpdateJournalPhase;
  executionStarted: boolean;
  destructiveStarted: boolean;
  planDigest: string;
  stableDeviceId: string;
  deviceModel: string;
  leaseRef: string;
  rollout: IFirmwareUpdateRolloutSnapshot;
  confirmations: {
    backuped: boolean;
    usbConnected: boolean;
  };
  prepared?: IFirmwareUpdateJournalPrepared;
  sdkCheckpoint?: FirmwareCheckpoint;
  recoveryReason?:
    | 'interrupted_during_execution'
    | 'reconciliation_required'
    | 'recovery_unsupported'
    | 'awaiting_correct_device'
    | 'reconciliation_unavailable';
  sanitizedError?: {
    code?: string;
    stage: 'preparing' | 'executing';
  };
  completedAt?: number;
};

export type IFirmwareUpdateJournalBeginResult = {
  transactionId: string;
  leaseRef: string;
  prepared?: IFirmwareUpdateJournalPrepared;
  checkpointSequenceStart: number;
  resumeCheckpoint?: FirmwareCheckpoint;
};

type IFirmwareUpdateJournalRecoveryIdentity = {
  transactionId: string;
  leaseRef: string;
};

const entity = new SimpleDbEntityFirmwareUpdateJournal();
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const LEASE_REF_PATTERN = /^fwlease:[a-f0-9-]{36}$/u;
const TRANSACTION_ID_PATTERN = /^fwtx:[a-f0-9-]{36}$/u;
const ERROR_CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/u;
const MAX_JOURNAL_BYTES = 512 * 1024;
const MAX_JOURNAL_NODES = 12_000;
const MAX_JOURNAL_DEPTH = 8;

const isTerminal = (phase: EFirmwareUpdateJournalPhase): boolean =>
  phase === 'COMPLETED' || phase === 'FAILED' || phase === 'ABANDONED';

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readUnsafeRecoveryIdentity = (
  value: unknown,
): IFirmwareUpdateJournalRecoveryIdentity | undefined => {
  if (!isObject(value)) return undefined;
  if (
    value.phase === 'COMPLETED' ||
    value.phase === 'FAILED' ||
    value.phase === 'ABANDONED'
  ) {
    return undefined;
  }
  const checkpoint = isObject(value.sdkCheckpoint)
    ? value.sdkCheckpoint
    : undefined;
  const hasUnsafeRecoveryEvidence =
    value.destructiveStarted === true ||
    value.phase === 'EXECUTING' ||
    value.phase === 'PAUSED' ||
    checkpoint?.destructiveActionStarted === true;
  if (
    !hasUnsafeRecoveryEvidence ||
    typeof value.transactionId !== 'string' ||
    !TRANSACTION_ID_PATTERN.test(value.transactionId) ||
    typeof value.leaseRef !== 'string' ||
    !LEASE_REF_PATTERN.test(value.leaseRef)
  ) {
    return undefined;
  }
  return {
    transactionId: value.transactionId,
    leaseRef: value.leaseRef,
  };
};

const assertExactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) => {
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal contains unexpected fields',
    );
  }
};

const assertBoundedJson = (
  value: unknown,
  state = { nodes: 0 },
  depth = 0,
): void => {
  state.nodes += 1;
  if (state.nodes > MAX_JOURNAL_NODES || depth > MAX_JOURNAL_DEPTH) {
    throw new OneKeyLocalError('Firmware update journal exceeds safe limits');
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isSafeInteger(value))
  ) {
    return;
  }
  if (typeof value === 'string') {
    if (
      value.length > 512 ||
      /(?:https?|file):\/\//iu.test(value) ||
      /^(?:\/|[A-Za-z]:[\\/])/u.test(value)
    ) {
      throw new OneKeyLocalError(
        'Firmware update journal contains forbidden data',
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 4096) {
      throw new OneKeyLocalError('Firmware update journal array is too large');
    }
    value.forEach((item) => assertBoundedJson(item, state, depth + 1));
    return;
  }
  if (!isObject(value) || Object.keys(value).length > 64) {
    throw new OneKeyLocalError('Firmware update journal value is invalid');
  }
  for (const [key, item] of Object.entries(value)) {
    if (
      /^(?:url|path|readerId|fd|messagePort|buffer)$/iu.test(key) ||
      key.length > 64
    ) {
      throw new OneKeyLocalError(
        'Firmware update journal contains a forbidden field',
      );
    }
    assertBoundedJson(item, state, depth + 1);
  }
};

const assertString: (
  value: unknown,
  label: string,
  pattern?: RegExp,
) => asserts value is string = (value, label, pattern) => {
  if (
    typeof value !== 'string' ||
    !value ||
    (pattern && !pattern.test(value))
  ) {
    throw new OneKeyLocalError(`Firmware update journal ${label} is invalid`);
  }
};

const assertCheckpointProjection: (
  value: unknown,
) => asserts value is FirmwareCheckpoint = (value) => {
  if (!isObject(value)) {
    throw new OneKeyLocalError('Firmware update SDK checkpoint is invalid');
  }
  assertExactKeys(
    value,
    ['schemaVersion', 'sequence', 'stage', 'destructiveActionStarted'],
    ['target', 'epoch'],
  );
  if (
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 1 ||
    typeof value.stage !== 'string' ||
    !value.stage ||
    typeof value.destructiveActionStarted !== 'boolean' ||
    (value.target !== undefined &&
      (typeof value.target !== 'string' || !value.target)) ||
    (value.epoch !== undefined &&
      (!Number.isSafeInteger(value.epoch) || (value.epoch as number) < 0))
  ) {
    throw new OneKeyLocalError(
      'Firmware update SDK checkpoint fields are invalid',
    );
  }
};

const validateEnvelope = (value: unknown): IFirmwareUpdateJournalEnvelope => {
  const serialized = JSON.stringify(value);
  if (
    typeof serialized !== 'string' ||
    serialized.length > MAX_JOURNAL_BYTES ||
    !isObject(value)
  ) {
    throw new OneKeyLocalError('Firmware update journal is invalid');
  }
  assertBoundedJson(value);
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'transactionId',
      'revision',
      'createdAt',
      'updatedAt',
      'phase',
      'executionStarted',
      'destructiveStarted',
      'planDigest',
      'stableDeviceId',
      'deviceModel',
      'leaseRef',
      'rollout',
      'confirmations',
    ],
    [
      'prepared',
      'sdkCheckpoint',
      'recoveryReason',
      'sanitizedError',
      'completedAt',
    ],
  );
  if (
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    !Number.isSafeInteger(value.createdAt) ||
    !Number.isSafeInteger(value.updatedAt) ||
    typeof value.executionStarted !== 'boolean' ||
    typeof value.destructiveStarted !== 'boolean'
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal version fields are invalid',
    );
  }
  assertString(value.transactionId, 'transactionId', TRANSACTION_ID_PATTERN);
  assertString(value.planDigest, 'planDigest', SHA256_PATTERN);
  assertString(value.stableDeviceId, 'stableDeviceId');
  assertString(value.deviceModel, 'deviceModel');
  assertString(value.leaseRef, 'leaseRef', LEASE_REF_PATTERN);
  if (
    ![
      'PREPARING',
      'PREPARED',
      'EXECUTING',
      'PAUSED',
      'COMPLETED',
      'FAILED',
      'ABANDONED',
    ].includes(value.phase as string) ||
    !isObject(value.confirmations) ||
    !isObject(value.rollout)
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal discriminant is invalid',
    );
  }
  assertExactKeys(value.confirmations, ['backuped', 'usbConnected']);
  if (
    typeof value.confirmations.backuped !== 'boolean' ||
    typeof value.confirmations.usbConnected !== 'boolean'
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal confirmation is invalid',
    );
  }
  assertExactKeys(value.rollout, [
    'source',
    'policyVersion',
    'cohortBucket',
    'percentageBps',
  ]);
  if (
    (value.rollout.source !== 'bundled' &&
      value.rollout.source !== 'signed-remote') ||
    !Number.isSafeInteger(value.rollout.policyVersion) ||
    (value.rollout.policyVersion as number) < 0 ||
    !Number.isSafeInteger(value.rollout.cohortBucket) ||
    (value.rollout.cohortBucket as number) < 0 ||
    (value.rollout.cohortBucket as number) >= 10_000 ||
    !Number.isSafeInteger(value.rollout.percentageBps) ||
    (value.rollout.percentageBps as number) < 1 ||
    (value.rollout.percentageBps as number) > 10_000 ||
    (value.rollout.cohortBucket as number) >=
      (value.rollout.percentageBps as number)
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal rollout rule is invalid',
    );
  }
  if (value.prepared !== undefined) {
    if (!isObject(value.prepared)) {
      throw new OneKeyLocalError('Firmware update prepared plan is invalid');
    }
    if (
      value.prepared.schemaVersion !== 1 ||
      value.prepared.networkPolicy !== 'forbid' ||
      value.prepared.planDigest !== value.planDigest ||
      value.prepared.deviceIdentity !== value.stableDeviceId ||
      value.prepared.deviceModel !== value.deviceModel ||
      value.prepared.leaseRef !== value.leaseRef
    ) {
      throw new OneKeyLocalError(
        'Firmware update prepared plan is not bound to the journal',
      );
    }
  }
  if (value.sdkCheckpoint !== undefined) {
    assertCheckpointProjection(value.sdkCheckpoint);
  }
  if (
    value.recoveryReason !== undefined &&
    ![
      'interrupted_during_execution',
      'reconciliation_required',
      'recovery_unsupported',
      'awaiting_correct_device',
      'reconciliation_unavailable',
    ].includes(value.recoveryReason as string)
  ) {
    throw new OneKeyLocalError('Firmware update journal checkpoint is invalid');
  }
  if (value.sanitizedError !== undefined) {
    if (!isObject(value.sanitizedError)) {
      throw new OneKeyLocalError('Firmware update journal error is invalid');
    }
    assertExactKeys(value.sanitizedError, ['stage'], ['code']);
    if (
      (value.sanitizedError.stage !== 'preparing' &&
        value.sanitizedError.stage !== 'executing') ||
      (value.sanitizedError.code !== undefined &&
        (typeof value.sanitizedError.code !== 'string' ||
          !ERROR_CODE_PATTERN.test(value.sanitizedError.code)))
    ) {
      throw new OneKeyLocalError(
        'Firmware update journal error fields are invalid',
      );
    }
  }
  const terminal = isTerminal(value.phase as EFirmwareUpdateJournalPhase);
  if (
    ((value.phase === 'PREPARED' ||
      value.phase === 'EXECUTING' ||
      value.phase === 'PAUSED' ||
      value.phase === 'COMPLETED') &&
      value.prepared === undefined) ||
    (terminal && !Number.isSafeInteger(value.completedAt)) ||
    (!terminal && value.completedAt !== undefined) ||
    (value.sdkCheckpoint !== undefined && !value.executionStarted) ||
    (value.phase === 'PREPARING' &&
      (value.executionStarted ||
        value.destructiveStarted ||
        value.prepared !== undefined)) ||
    ((value.phase === 'EXECUTING' || value.phase === 'PAUSED') &&
      !value.executionStarted) ||
    (value.phase === 'COMPLETED' && !value.executionStarted)
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal phase data is inconsistent',
    );
  }
  if (
    value.sdkCheckpoint?.destructiveActionStarted === true &&
    value.destructiveStarted !== true
  ) {
    throw new OneKeyLocalError(
      'Firmware update checkpoint destructive state is inconsistent',
    );
  }
  if (
    value.destructiveStarted &&
    (!value.executionStarted ||
      (value.phase !== 'EXECUTING' &&
        value.phase !== 'PAUSED' &&
        value.phase !== 'COMPLETED'))
  ) {
    throw new OneKeyLocalError(
      'Firmware update journal destructive phase is invalid',
    );
  }
  return value as IFirmwareUpdateJournalEnvelope;
};

export const validateFirmwareUpdateJournalEnvelope = validateEnvelope;

const toPreparedJournal = (
  prepared: IPreparedFirmwareArtifacts,
): IFirmwareUpdateJournalPrepared => prepared.preparedPlan;

export class FirmwareUpdateJournal {
  private bootstrapLeaseReconciliationCompleted = false;

  constructor(
    private readonly journalEntity: Pick<
      SimpleDbEntityFirmwareUpdateJournal,
      'quarantinePersistedEnvelope' | 'readPersistedEnvelope' | 'setRawData'
    > = entity,
    private readonly artifactAdapter: IFirmwareArtifactAdapter = firmwareArtifactAdapter,
    private readonly bootstrapRecoveryEnabled = platformEnv.isNative ||
      platformEnv.isDesktop,
  ) {}

  async read(): Promise<IFirmwareUpdateJournalEnvelope | undefined> {
    let persisted: Awaited<
      ReturnType<SimpleDbEntityFirmwareUpdateJournal['readPersistedEnvelope']>
    >;
    try {
      persisted = await this.journalEntity.readPersistedEnvelope();
    } catch (error) {
      if (!isFirmwareUpdateJournalStorageCorruptionError(error)) {
        throw error;
      }
      await this.journalEntity.quarantinePersistedEnvelope();
      return undefined;
    }
    if (!persisted.exists) return undefined;
    try {
      return validateEnvelope(persisted.data);
    } catch (error) {
      if (readUnsafeRecoveryIdentity(persisted.data)) throw error;
      await this.journalEntity.quarantinePersistedEnvelope();
      return undefined;
    }
  }

  async begin({
    plan,
    backuped,
    usbConnected,
    rollout,
  }: {
    plan: FirmwareUpdatePlan;
    backuped: boolean;
    usbConnected: boolean;
    rollout?: IFirmwareUpdateRolloutDecision;
  }): Promise<IFirmwareUpdateJournalBeginResult | undefined> {
    const current = await this.read();
    if (current && !isTerminal(current.phase)) {
      if (
        current.planDigest === plan.planDigest &&
        !current.destructiveStarted &&
        (current.phase === 'PREPARING' || current.phase === 'PREPARED')
      ) {
        return {
          transactionId: current.transactionId,
          leaseRef: current.leaseRef,
          prepared: current.prepared,
          checkpointSequenceStart: current.sdkCheckpoint?.sequence ?? 0,
        };
      }
      if (
        current.planDigest === plan.planDigest &&
        current.phase === 'PAUSED' &&
        current.destructiveStarted &&
        current.prepared &&
        current.sdkCheckpoint
      ) {
        return {
          transactionId: current.transactionId,
          leaseRef: current.leaseRef,
          prepared: current.prepared,
          checkpointSequenceStart: current.sdkCheckpoint.sequence,
          resumeCheckpoint: current.sdkCheckpoint,
        };
      }
      if (current.destructiveStarted) {
        throw new OneKeyLocalError(
          'An interrupted firmware update requires device reconciliation',
        );
      }
      if (!rollout?.allowed) return undefined;
      await this.artifactAdapter.releaseLease({
        leaseRef: current.leaseRef,
        disposition: 'safeAbandoned',
      });
    }
    if (!rollout?.allowed) return undefined;

    const transactionId = `fwtx:${generateUUID().toLowerCase()}`;
    const { leaseRef } = await this.artifactAdapter.createLease(transactionId);
    const now = Date.now();
    const journal: IFirmwareUpdateJournalEnvelope = {
      schemaVersion: 1,
      transactionId,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      phase: 'PREPARING',
      executionStarted: false,
      destructiveStarted: false,
      planDigest: plan.planDigest,
      stableDeviceId: plan.deviceIdentity,
      deviceModel: plan.deviceModel,
      leaseRef,
      rollout: {
        source: rollout.source,
        policyVersion: rollout.policyVersion,
        cohortBucket: rollout.cohortBucket,
        percentageBps: rollout.rule.percentageBps,
      },
      confirmations: { backuped, usbConnected },
    };
    try {
      await this.journalEntity.setRawData(journal);
    } catch (error) {
      await this.artifactAdapter
        .releaseLease({ leaseRef, disposition: 'safeCancelled' })
        .catch(() => undefined);
      throw error;
    }
    return { transactionId, leaseRef, checkpointSequenceStart: 0 };
  }

  async markPrepared(
    transactionId: string,
    prepared: IPreparedFirmwareArtifacts,
  ): Promise<void> {
    await this.update(transactionId, (current) => {
      if (current.destructiveStarted || current.phase !== 'PREPARING') {
        throw new OneKeyLocalError(
          'Firmware update cannot replace prepared artifacts',
        );
      }
      return {
        ...current,
        phase: 'PREPARED',
        prepared: toPreparedJournal(prepared),
      };
    });
  }

  async markExecuting(transactionId: string): Promise<void> {
    await this.update(transactionId, (current) => {
      if (current.phase === 'EXECUTING') return current;
      const isPreparedStart =
        current.phase === 'PREPARED' && !current.destructiveStarted;
      const isPausedResume =
        current.phase === 'PAUSED' &&
        current.destructiveStarted &&
        current.sdkCheckpoint !== undefined;
      if ((!isPreparedStart && !isPausedResume) || !current.prepared) {
        throw new OneKeyLocalError(
          'Firmware update artifacts are not durably prepared',
        );
      }
      const {
        recoveryReason: _recoveryReason,
        sanitizedError: _sanitizedError,
        ...resuming
      } = current;
      return {
        ...resuming,
        phase: 'EXECUTING',
        executionStarted: true,
        destructiveStarted: current.destructiveStarted,
      };
    });
  }

  async commitSdkCheckpoint(
    transactionId: string,
    checkpoint: FirmwareCheckpoint,
  ): Promise<void> {
    assertCheckpointProjection(checkpoint);
    await this.update(transactionId, (current) => {
      if (current.phase !== 'EXECUTING' || !current.prepared) {
        throw new OneKeyLocalError(
          'Firmware update checkpoint writer is not executing',
        );
      }
      const expectedSequence = (current.sdkCheckpoint?.sequence ?? 0) + 1;
      if (
        checkpoint.sequence !== expectedSequence ||
        (current.destructiveStarted && !checkpoint.destructiveActionStarted)
      ) {
        throw new OneKeyLocalError(
          'Firmware update checkpoint sequence is stale',
        );
      }
      return {
        ...current,
        destructiveStarted:
          current.destructiveStarted || checkpoint.destructiveActionStarted,
        sdkCheckpoint: checkpoint,
      };
    });
  }

  async markCompleted(transactionId: string): Promise<void> {
    const completed = await this.update(transactionId, (current) => {
      if (
        current.phase !== 'EXECUTING' ||
        current.sdkCheckpoint?.stage !== 'FINAL_VERIFIED'
      ) {
        throw new OneKeyLocalError(
          'Firmware update cannot complete before final verification',
        );
      }
      const {
        recoveryReason: _recoveryReason,
        sanitizedError: _sanitizedError,
        ...terminal
      } = current;
      return {
        ...terminal,
        phase: 'COMPLETED',
        completedAt: Date.now(),
      };
    });
    await this.artifactAdapter
      .releaseLease({
        leaseRef: completed.leaseRef,
        disposition: 'completed',
      })
      .catch(() => undefined);
  }

  async markFailure(transactionId: string, error: unknown): Promise<void> {
    const current = await this.read();
    if (!current || current.transactionId !== transactionId) return;
    const code =
      isObject(error) &&
      typeof error.code === 'string' &&
      ERROR_CODE_PATTERN.test(error.code)
        ? error.code
        : undefined;
    if (current.destructiveStarted) {
      await this.update(transactionId, (latest) => ({
        ...latest,
        phase: 'PAUSED',
        recoveryReason: 'reconciliation_required',
        sanitizedError: {
          ...(code ? { code } : {}),
          stage: 'executing',
        },
      }));
      return;
    }
    const failed = await this.update(transactionId, (latest) => ({
      ...latest,
      phase: 'FAILED',
      sanitizedError: {
        ...(code ? { code } : {}),
        stage: latest.executionStarted ? 'executing' : 'preparing',
      },
      completedAt: Date.now(),
    }));
    await this.artifactAdapter
      .releaseLease({
        leaseRef: failed.leaseRef,
        disposition: 'safeCancelled',
      })
      .catch(() => undefined);
  }

  async markRecoveryWaiting(
    transactionId: string,
    recoveryReason:
      | 'recovery_unsupported'
      | 'awaiting_correct_device'
      | 'reconciliation_unavailable',
  ): Promise<void> {
    await this.update(transactionId, (current) => {
      if (isTerminal(current.phase) || !current.prepared) return current;
      return {
        ...current,
        phase: current.destructiveStarted ? 'PAUSED' : 'PREPARED',
        recoveryReason,
      };
    });
  }

  async bootstrapRecover(): Promise<void> {
    if (!this.bootstrapRecoveryEnabled) return;
    this.bootstrapLeaseReconciliationCompleted = false;
    let current: IFirmwareUpdateJournalEnvelope | undefined;
    try {
      current = await this.read();
    } catch (error) {
      const persisted = await this.journalEntity.readPersistedEnvelope();
      const recoveryIdentity = readUnsafeRecoveryIdentity(persisted.data);
      if (!recoveryIdentity) throw error;
      await this.artifactAdapter.reconcileLeases([recoveryIdentity.leaseRef]);
      this.bootstrapLeaseReconciliationCompleted = true;
      return;
    }
    if (!current || isTerminal(current.phase)) {
      await this.artifactAdapter.reconcileLeases([]);
      this.bootstrapLeaseReconciliationCompleted = true;
      return;
    }
    if (current.phase === 'PREPARING') {
      const abandoned = await this.update(current.transactionId, (latest) => ({
        ...latest,
        phase: 'ABANDONED',
        completedAt: Date.now(),
      }));
      await this.artifactAdapter
        .releaseLease({
          leaseRef: abandoned.leaseRef,
          disposition: 'safeAbandoned',
        })
        .catch(() => undefined);
      await this.artifactAdapter.reconcileLeases([]);
      this.bootstrapLeaseReconciliationCompleted = true;
      return;
    }
    let active = current;
    if (current.phase === 'EXECUTING') {
      active = await this.update(current.transactionId, (latest) =>
        latest.destructiveStarted
          ? {
              ...latest,
              phase: 'PAUSED',
              recoveryReason: 'interrupted_during_execution',
            }
          : {
              ...latest,
              phase: 'PREPARED',
              recoveryReason: 'interrupted_during_execution',
            },
      );
    }
    await this.artifactAdapter.reconcileLeases([active.leaseRef]);
    this.bootstrapLeaseReconciliationCompleted = true;
  }

  async sweepOrphansAfterRecovery(): Promise<void> {
    if (
      !this.bootstrapRecoveryEnabled ||
      !this.bootstrapLeaseReconciliationCompleted
    ) {
      return;
    }
    await this.artifactAdapter.sweepOrphans();
  }

  private async update(
    transactionId: string,
    builder: (
      current: IFirmwareUpdateJournalEnvelope,
    ) => IFirmwareUpdateJournalEnvelope,
  ): Promise<IFirmwareUpdateJournalEnvelope> {
    let result: IFirmwareUpdateJournalEnvelope | undefined;
    await this.journalEntity.setRawData((raw) => {
      const current = validateEnvelope(raw);
      if (
        current.transactionId !== transactionId ||
        isTerminal(current.phase)
      ) {
        throw new OneKeyLocalError('Firmware update journal writer is stale');
      }
      const next = builder(current);
      result = validateEnvelope({
        ...next,
        revision: current.revision + 1,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      });
      return result;
    });
    if (!result) {
      throw new OneKeyLocalError('Firmware update journal write failed');
    }
    return result;
  }
}

export const firmwareUpdateJournal = new FirmwareUpdateJournal();
