import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IFirmwareUpdateCapabilityGate } from '@onekeyhq/shared/src/hardware/firmwareUpdateCapabilities';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  type FirmwareArtifactProvider,
  type IFirmwareArtifactLifecycleTelemetry,
  getFirmwareArtifactFailureCode,
} from './FirmwareArtifactProvider';
import {
  type FirmwareArtifactStore,
  type IFirmwareStoredArtifact,
} from './FirmwareArtifactStore';
import {
  type FirmwareUpdateJournal,
  sanitizeFirmwareUpdateJournalError,
} from './FirmwareUpdateJournal';

import type {
  EFirmwareUpdateCoordinatorPhase,
  IFirmwareCheckpoint,
  IFirmwarePreparedPlan,
  IFirmwareUpdateCoordinatorProjection,
  IFirmwareUpdateJournalArtifact,
  IFirmwareUpdateJournalEnvelope,
  IFirmwareUpdateJournalPendingAction,
  IFirmwareUpdateJournalUserAttestation,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';
import type { FirmwareUpdateEligibility } from './FirmwareUpdateEligibility';
import type { IFirmwareUpdateRolloutDecision } from './FirmwareUpdateRolloutPolicy';
import type {
  FirmwareUpdateRuntimeBinding,
  IFirmwareUpdateHostBinding,
} from './FirmwareUpdateRuntimeBinding';

type IFirmwareProgressEvent = Parameters<
  NonNullable<IFirmwareUpdateHostBinding['progressSink']>['report']
>[0];

type IReadyCapabilityGate = Extract<
  IFirmwareUpdateCapabilityGate,
  { ready: true }
>;

const FIRMWARE_DEVICE_STATE_CONFLICT_ERROR_CODE = 433;
const FIRMWARE_RECONCILIATION_UNAVAILABLE_ERROR_CODE = 434;

export type IFirmwareUpdateCoordinatorStartInput<TEligibilityContext> = {
  transactionId: string;
  plan: unknown;
  deviceSnapshotDigest: string;
  capabilityGate: IReadyCapabilityGate;
  rolloutDecision: IFirmwareUpdateRolloutDecision;
  confirmations: unknown;
  eligibilityContext: TEligibilityContext;
};

export type IFirmwareUpdateCoordinatorExecutionInput<TEligibilityContext> = {
  sessionId: string;
  eligibilityContext: TEligibilityContext;
};

export type IFirmwareUpdateCoordinatorExecutor<TEligibilityContext> = (input: {
  transactionId: string;
  preparedPlan: IFirmwarePreparedPlan;
  checkpoint?: IFirmwareCheckpoint;
  eligibilityContext: TEligibilityContext;
}) => Promise<unknown>;

export type IFirmwareUpdateCoordinatorDependencies<TEligibilityContext> = {
  journal: Pick<
    FirmwareUpdateJournal,
    | 'clearTerminal'
    | 'commit'
    | 'commitCheckpoint'
    | 'create'
    | 'markFailed'
    | 'markPrepared'
    | 'markTerminal'
    | 'read'
  >;
  artifactProvider: Pick<
    FirmwareArtifactProvider,
    'prepareArtifacts' | 'resumeArtifacts'
  >;
  artifactStore: Pick<
    FirmwareArtifactStore,
    'createArtifactReader' | 'releaseLease' | 'restorePreparedPlan'
  >;
  eligibility: Pick<
    FirmwareUpdateEligibility<TEligibilityContext>,
    | 'assertBeforeAcquisition'
    | 'assertBeforeDeviceMutation'
    | 'createUserAttestation'
  >;
  runtimeBinding: Pick<
    FirmwareUpdateRuntimeBinding,
    'bind' | 'clear' | 'getSnapshot'
  >;
  validatePlan: (value: unknown) => Promise<IFirmwareUpdatePlan>;
  validatePreparedPlan: (value: unknown) => Promise<IFirmwarePreparedPlan>;
  executePreparedPlan: IFirmwareUpdateCoordinatorExecutor<TEligibilityContext>;
  cancelExecution: (sessionId: string) => Promise<void>;
  publishProjection: (
    projection: IFirmwareUpdateCoordinatorProjection,
  ) => Promise<void>;
  onPhaseCommitted: (journal: IFirmwareUpdateJournalEnvelope) => Promise<void>;
  onArtifactAcquired: (input: {
    transactionId: string;
    artifactId: string;
    artifactBytes: number;
    telemetry: IFirmwareArtifactLifecycleTelemetry;
  }) => Promise<void>;
};

const NOOP_ASYNC = async () => undefined;

const defaultValidatePlan = async (value: unknown) => {
  const sdk = await CoreSDKLoader();
  return sdk.validateFirmwareUpdatePlan(value);
};

const defaultValidatePreparedPlan = async (value: unknown) => {
  const sdk = await CoreSDKLoader();
  return sdk.validatePreparedPlan(value);
};

const coordinatorError = (code: string, message: string): OneKeyLocalError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareUpdateCoordinatorCode: code,
  });

const assertBackgroundRuntime = () => {
  if (
    !platformEnv.isJest &&
    (platformEnv.isWeb ||
      platformEnv.isExtension ||
      (platformEnv.isNative && platformEnv.isNativeMainThread))
  ) {
    throw coordinatorError(
      'RUNTIME_NOT_SUPPORTED',
      'Firmware update coordinator is available only in the background runtime',
    );
  }
};

const assertStartInput = ({
  transactionId,
  deviceSnapshotDigest,
  rolloutDecision,
}: Pick<
  IFirmwareUpdateCoordinatorStartInput<unknown>,
  'deviceSnapshotDigest' | 'rolloutDecision' | 'transactionId'
>) => {
  if (
    typeof transactionId !== 'string' ||
    transactionId.length === 0 ||
    transactionId.length > 256
  ) {
    throw coordinatorError(
      'INVALID_TRANSACTION',
      'Firmware transaction id is invalid',
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(deviceSnapshotDigest)) {
    throw coordinatorError(
      'INVALID_DEVICE_SNAPSHOT',
      'Firmware device snapshot digest is invalid',
    );
  }
  if (!rolloutDecision.allowed) {
    throw coordinatorError(
      'ROLLOUT_NOT_ALLOWED',
      `Firmware transaction rollout denied: ${rolloutDecision.reason}`,
    );
  }
};

const mapCheckpointPhase = (
  checkpoint: IFirmwareCheckpoint,
): EFirmwareUpdateCoordinatorPhase => {
  switch (checkpoint.state) {
    case 'ENTERING_LOADER':
      return 'ENTERING_LOADER';
    case 'SYNCING_OR_TRANSFERRING':
    case 'STAGED':
    case 'AWAITING_CONFIRMATION':
      return 'TRANSFERRING';
    case 'INSTALL_REQUESTED':
    case 'INSTALLING':
    case 'REBOOTING_BETWEEN_EPOCHS':
      return 'INSTALLING';
    case 'FINAL_VERIFYING':
    case 'COMPLETED':
      return 'VERIFYING';
    case 'PAUSED':
    case 'ABANDONED':
    case 'FAILED':
      return 'PAUSED';
    default:
      return 'PREPARED';
  }
};

const mapPendingAction = (
  checkpoint: IFirmwareCheckpoint,
): IFirmwareUpdateJournalPendingAction | undefined => {
  if (!checkpoint.destructiveActionStarted) return undefined;
  const common = {
    checkpointSeq: checkpoint.sequence,
    ...(checkpoint.epochId ? { epochId: checkpoint.epochId } : {}),
    ...(checkpoint.artifactId ? { artifactId: checkpoint.artifactId } : {}),
    ...(checkpoint.target ? { target: checkpoint.target } : {}),
  };
  switch (checkpoint.state) {
    case 'ENTERING_LOADER':
      return {
        ...common,
        kind: 'enter-loader',
      };
    case 'INSTALL_REQUESTED':
    case 'INSTALLING':
      return {
        ...common,
        kind: 'install',
      };
    case 'REBOOTING_BETWEEN_EPOCHS':
      return {
        ...common,
        kind: 'reboot-between-epochs',
      };
    default:
      return {
        ...common,
        kind: 'transfer',
      };
  }
};

const toJournalArtifact = ({
  stored,
  leaseRef,
}: {
  stored: IFirmwareStoredArtifact;
  leaseRef: string;
}): IFirmwareUpdateJournalArtifact => ({
  artifactId: stored.requirement.artifactId,
  state:
    stored.requirement.container.kind === 'archive-entry'
      ? 'materialized'
      : 'verified',
  leaseRef,
  artifactRef: stored.adapterReceipt.artifactRef,
  expectedSize: stored.adapterReceipt.size,
  downloadedBytes: stored.adapterReceipt.size,
  sha256: stored.adapterReceipt.sha256.toLowerCase(),
});

const upsertJournalArtifact = (
  artifacts: readonly IFirmwareUpdateJournalArtifact[],
  artifact: IFirmwareUpdateJournalArtifact,
): IFirmwareUpdateJournalArtifact[] => {
  const index = artifacts.findIndex(
    (candidate) => candidate.artifactId === artifact.artifactId,
  );
  if (index < 0) return [...artifacts, artifact];
  return artifacts.map((candidate, candidateIndex) =>
    candidateIndex === index ? artifact : candidate,
  );
};

const isCancellationError = (error: unknown) =>
  error instanceof OneKeyLocalError &&
  'firmwareUpdateCoordinatorCode' in error &&
  error.firmwareUpdateCoordinatorCode === 'CANCELLED';

const getErrorCode = (error: unknown): string | number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = error as Record<string, unknown>;
  if (
    typeof value.errorCode === 'string' ||
    Number.isSafeInteger(value.errorCode)
  ) {
    return value.errorCode as string | number;
  }
  if (typeof value.code === 'string' || Number.isSafeInteger(value.code)) {
    return value.code as string | number;
  }
  return undefined;
};

const getRecoveryReason = (error: unknown): string | undefined => {
  const code = getErrorCode(error);
  if (
    code === FIRMWARE_DEVICE_STATE_CONFLICT_ERROR_CODE ||
    code === 'DEVICE_IDENTITY_CHANGED' ||
    code === 'DEVICE_IDENTITY_UNAVAILABLE'
  ) {
    return 'awaiting_correct_device';
  }
  if (
    code === FIRMWARE_RECONCILIATION_UNAVAILABLE_ERROR_CODE ||
    code === 'TRANSPORT_UNAVAILABLE'
  ) {
    return 'reconciliation_unavailable';
  }
  return undefined;
};

const getProjectionAction = (
  recoveryReason: string | undefined,
): IFirmwareUpdateCoordinatorProjection['action'] => {
  if (recoveryReason === 'awaiting_correct_device') return 'awaiting-device';
  if (recoveryReason === 'reconciliation_unavailable') return 'retry';
  return 'none';
};

export class FirmwareUpdateCoordinator<TEligibilityContext> {
  private readonly mutex = new Mutex();

  private readonly dependencies: IFirmwareUpdateCoordinatorDependencies<TEligibilityContext>;

  private projection: IFirmwareUpdateCoordinatorProjection | undefined;

  private executionPromise:
    | Promise<IFirmwareUpdateCoordinatorProjection>
    | undefined;

  private readonly cancelRequestedSessions = new Set<string>();

  constructor(
    dependencies: Omit<
      IFirmwareUpdateCoordinatorDependencies<TEligibilityContext>,
      | 'cancelExecution'
      | 'onArtifactAcquired'
      | 'onPhaseCommitted'
      | 'publishProjection'
      | 'validatePlan'
      | 'validatePreparedPlan'
    > &
      Partial<
        Pick<
          IFirmwareUpdateCoordinatorDependencies<TEligibilityContext>,
          | 'cancelExecution'
          | 'onArtifactAcquired'
          | 'onPhaseCommitted'
          | 'publishProjection'
          | 'validatePlan'
          | 'validatePreparedPlan'
        >
      >,
  ) {
    assertBackgroundRuntime();
    this.dependencies = {
      validatePlan: defaultValidatePlan,
      validatePreparedPlan: defaultValidatePreparedPlan,
      cancelExecution: NOOP_ASYNC,
      publishProjection: NOOP_ASYNC,
      onPhaseCommitted: NOOP_ASYNC,
      onArtifactAcquired: NOOP_ASYNC,
      ...dependencies,
    };
  }

  async beginDiscovery(
    sessionId: string,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      const projection: IFirmwareUpdateCoordinatorProjection = Object.freeze({
        sessionId,
        revision: 0,
        phase: 'DISCOVERING',
        engine: 'transaction',
        action: 'none',
        cancelDisposition: 'none',
      });
      this.projection = projection;
      await this.dependencies.publishProjection(projection);
      return projection;
    });
  }

  async failDiscovery({
    sessionId,
    error,
  }: {
    sessionId: string;
    error: unknown;
  }): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      if (
        this.projection?.sessionId === sessionId &&
        this.projection.phase === 'ABANDONED'
      ) {
        return this.projection;
      }
      const projection: IFirmwareUpdateCoordinatorProjection = Object.freeze({
        sessionId,
        revision: 0,
        phase: 'FAILED',
        engine: 'transaction',
        action: 'retry',
        cancelDisposition: 'none',
        error: sanitizeFirmwareUpdateJournalError(error),
      });
      this.projection = projection;
      await this.dependencies.publishProjection(projection);
      return projection;
    });
  }

  private assertSession(
    journal: IFirmwareUpdateJournalEnvelope | undefined,
    sessionId: string,
  ): asserts journal is IFirmwareUpdateJournalEnvelope {
    if (!journal || journal.transactionId !== sessionId) {
      throw coordinatorError(
        'SESSION_NOT_FOUND',
        'Firmware update session does not exist',
      );
    }
  }

  private assertNotCancelled(sessionId: string) {
    if (this.cancelRequestedSessions.has(sessionId)) {
      throw coordinatorError(
        'CANCELLED',
        'Firmware update was cancelled before device mutation',
      );
    }
  }

  private async publishJournal(
    journal: IFirmwareUpdateJournalEnvelope,
    progress?: IFirmwareUpdateCoordinatorProjection['progress'],
  ) {
    const projection: IFirmwareUpdateCoordinatorProjection = Object.freeze({
      sessionId: journal.transactionId,
      revision: journal.revision,
      phase: journal.phase,
      engine: 'transaction',
      action: getProjectionAction(journal.recoveryReason),
      cancelDisposition: journal.cancelDisposition,
      ...(journal.sanitizedError ? { error: journal.sanitizedError } : {}),
      ...(progress ? { progress } : {}),
    });
    this.projection = projection;
    await this.dependencies.onPhaseCommitted(journal);
    await this.dependencies.publishProjection(projection);
    return projection;
  }

  private async publishRecoveryUnsupported({
    journal,
    unavailableReason,
    recoveryReason,
  }: {
    journal: IFirmwareUpdateJournalEnvelope;
    unavailableReason: IFirmwareUpdateCoordinatorProjection['unavailableReason'];
    recoveryReason: string;
  }) {
    const projection: IFirmwareUpdateCoordinatorProjection = Object.freeze({
      sessionId: journal.transactionId,
      revision: journal.revision,
      phase: 'RECOVERY_UNSUPPORTED',
      engine: 'recovery_unsupported',
      unavailableReason,
      action: 'retry',
      cancelDisposition: journal.cancelDisposition,
      error: {
        name: 'FirmwareRecoveryUnsupported',
        message: recoveryReason,
        code: 'RECOVERY_UNSUPPORTED',
        retryable: true,
      },
    });
    this.projection = projection;
    await this.dependencies.publishProjection(projection);
    return projection;
  }

  async initializeFromJournal({
    journal,
    unavailableReason,
    recoveryReason,
  }: {
    journal: IFirmwareUpdateJournalEnvelope | undefined;
    unavailableReason?: IFirmwareUpdateCoordinatorProjection['unavailableReason'];
    recoveryReason?: string;
  }): Promise<IFirmwareUpdateCoordinatorProjection | undefined> {
    return this.mutex.runExclusive(async () => {
      if (!journal) {
        this.projection = undefined;
        return undefined;
      }
      if (unavailableReason) {
        return this.publishRecoveryUnsupported({
          journal,
          unavailableReason,
          recoveryReason:
            recoveryReason ?? 'Firmware recovery capabilities are unavailable',
        });
      }
      return this.publishJournal(journal);
    });
  }

  private async publishProgress(
    journal: IFirmwareUpdateJournalEnvelope,
    event: IFirmwareProgressEvent,
  ) {
    const phase = mapCheckpointPhase({
      schemaVersion: 1,
      transactionId: journal.transactionId,
      planDigest: journal.planDigest ?? '',
      sequence: journal.checkpointSeq,
      state: event.phase,
      timestampMs: journal.updatedAt,
    });
    let stage: NonNullable<
      IFirmwareUpdateCoordinatorProjection['progress']
    >['stage'] = 'acquisition';
    if (phase === 'INSTALLING') {
      stage = 'install';
    } else if (phase === 'TRANSFERRING') {
      stage = 'transfer';
    }
    const progress: IFirmwareUpdateCoordinatorProjection['progress'] = {
      stage,
      completed: event.completed,
      total: event.total,
      ...(event.artifactId ? { artifactId: event.artifactId } : {}),
      ...(event.target ? { target: event.target } : {}),
    };
    const projection: IFirmwareUpdateCoordinatorProjection = Object.freeze({
      ...(this.projection ?? {
        sessionId: journal.transactionId,
        revision: journal.revision,
        phase: journal.phase,
        engine: 'transaction' as const,
      }),
      progress,
    });
    this.projection = projection;
    await this.dependencies.publishProjection(projection);
  }

  private async commitPatch({
    current,
    patch,
    progress,
  }: {
    current: IFirmwareUpdateJournalEnvelope;
    patch: Parameters<FirmwareUpdateJournal['commit']>[0]['patch'];
    progress?: IFirmwareUpdateCoordinatorProjection['progress'];
  }) {
    const committed = await this.dependencies.journal.commit({
      expectedRevision: current.revision,
      patch,
    });
    await this.publishJournal(committed, progress);
    return committed;
  }

  async createAndPrepare(
    input: IFirmwareUpdateCoordinatorStartInput<TEligibilityContext>,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      assertStartInput(input);
      this.assertNotCancelled(input.transactionId);
      const plan = await this.dependencies.validatePlan(input.plan);
      if (plan.device.identity.length === 0 || plan.device.model.length === 0) {
        throw coordinatorError(
          'INVALID_PLAN_DEVICE',
          'Firmware plan has no stable device identity',
        );
      }
      const attestation =
        await this.dependencies.eligibility.createUserAttestation(
          input.confirmations,
        );
      let current = await this.dependencies.journal.create({
        transactionId: input.transactionId,
        phase: 'PLAN_CREATED',
        cancelDisposition: 'none',
        capabilities: {
          appJournalSchemaVersion: 1,
          sdkPlanSchemaVersion: input.capabilityGate.planSchemaVersion,
          sdkPreparedPlanSchemaVersion:
            input.capabilityGate.preparedPlanSchemaVersion,
          sdkHostBindingProtocolVersion:
            input.capabilityGate.hostBindingProtocolVersion,
          sdkCheckpointSchemaVersion:
            input.capabilityGate.checkpointSchemaVersion,
          artifactRuntime: platformEnv.isNative ? 'native' : 'desktop',
          artifactProtocolVersion: input.capabilityGate.artifactProtocolVersion,
          maxReadBytes: input.capabilityGate.maxReadBytes,
        },
        stableDeviceId: plan.device.identity,
        model: plan.device.model,
        deviceSnapshotDigest: input.deviceSnapshotDigest,
        planId: plan.planId,
        planDigest: plan.planDigest,
        manifestDigest: plan.manifestSnapshotDigest,
        catalogEpoch: plan.catalogEpoch,
        updatePlan: plan,
        artifacts: [],
        checkpointSeq: -1,
        rollout: {
          policyVersion: input.rolloutDecision.policyVersion,
          cohortBucket: input.rolloutDecision.cohortBucket,
          engine: input.rolloutDecision.engine,
          eligibilityAttestationDigest: attestation.attestationDigest,
        },
        userAttestation: attestation,
      });
      await this.publishJournal(current);

      try {
        current = await this.commitPatch({
          current,
          patch: {
            phase: 'ELIGIBILITY_CHECKING',
          },
        });
        await this.dependencies.eligibility.assertBeforeAcquisition({
          context: input.eligibilityContext,
          attestation,
        });
        this.assertNotCancelled(input.transactionId);
      } catch (error) {
        if (isCancellationError(error)) {
          throw error;
        }
        const failed = await this.dependencies.journal.markFailed({
          expectedRevision: current.revision,
          error,
        });
        await this.publishJournal(failed);
        throw error;
      }

      current = await this.commitPatch({
        current,
        patch: {
          phase: 'ACQUIRING',
        },
      });
      let leaseRef: string | undefined;
      try {
        const prepared =
          await this.dependencies.artifactProvider.prepareArtifacts({
            transactionId: input.transactionId,
            plan,
            lifecycle: {
              onLeaseCreated: async (value) => {
                this.assertNotCancelled(input.transactionId);
                leaseRef = value;
                current = await this.commitPatch({
                  current,
                  patch: {
                    leaseRef: value,
                    artifacts: plan.artifacts.map((requirement) => ({
                      artifactId: requirement.artifactId,
                      state: 'pending',
                      leaseRef: value,
                      downloadedBytes: 0,
                      ...(requirement.expectedSize === undefined
                        ? {}
                        : { expectedSize: requirement.expectedSize }),
                      ...(requirement.expectedSha256 === undefined
                        ? {}
                        : {
                            sha256: requirement.expectedSha256.toLowerCase(),
                          }),
                    })),
                  },
                });
              },
              onArtifactReady: async (stored, telemetry) => {
                this.assertNotCancelled(input.transactionId);
                if (!leaseRef) {
                  throw coordinatorError(
                    'LEASE_NOT_READY',
                    'Firmware artifact arrived before its lease was committed',
                  );
                }
                const effectiveTelemetry = telemetry ?? {
                  phase:
                    current.phase === 'MATERIALIZING'
                      ? ('materialization' as const)
                      : ('acquisition' as const),
                  routeType: stored.acquisition?.routeType ?? 'domain',
                  candidateIndex: 0,
                  durationMs: 0,
                  bytesReused: stored.acquisition?.bytesReused ?? 0,
                  resumeKind: stored.acquisition?.resumeKind ?? 'none',
                  resumeCount: stored.acquisition?.resumeCount ?? 0,
                };
                const artifact = toJournalArtifact({ stored, leaseRef });
                current = await this.commitPatch({
                  current,
                  patch: {
                    artifacts: upsertJournalArtifact(
                      current.artifacts,
                      artifact,
                    ),
                  },
                  progress: {
                    stage: effectiveTelemetry.phase,
                    completed: artifact.downloadedBytes,
                    total: artifact.expectedSize ?? artifact.downloadedBytes,
                    artifactId: artifact.artifactId,
                    target: stored.requirement.target,
                  },
                });
                await this.dependencies.onArtifactAcquired({
                  transactionId: input.transactionId,
                  artifactId: artifact.artifactId,
                  artifactBytes: artifact.downloadedBytes,
                  telemetry: effectiveTelemetry,
                });
              },
              onMaterializationStarted: async () => {
                this.assertNotCancelled(input.transactionId);
                current = await this.commitPatch({
                  current,
                  patch: {
                    phase: 'MATERIALIZING',
                  },
                });
              },
            },
          });
        this.assertNotCancelled(input.transactionId);
        const validatedPreparedPlan =
          await this.dependencies.validatePreparedPlan(prepared.preparedPlan);
        if (prepared.leaseRef !== leaseRef) {
          throw coordinatorError(
            'LEASE_MISMATCH',
            'Firmware preparation returned a different artifact lease',
          );
        }
        current = await this.dependencies.journal.markPrepared({
          expectedRevision: current.revision,
          preparedPlan: validatedPreparedPlan,
          artifacts: prepared.storedArtifacts.map((stored) =>
            toJournalArtifact({
              stored,
              leaseRef: prepared.leaseRef,
            }),
          ),
          leaseRef: prepared.leaseRef,
        });
        return this.publishJournal(current);
      } catch (error) {
        if (leaseRef && isCancellationError(error)) {
          const cancelled = await this.dependencies.journal.markTerminal({
            expectedRevision: current.revision,
            state: 'ABANDONED',
            leaseDisposition: 'safeCancelled',
            abandonSafety: 'before-destructive-checkpoint',
            cancelDisposition: 'cancelled-before-mutation',
          });
          await this.publishJournal(cancelled);
          await this.dependencies.artifactStore.releaseLease(
            leaseRef,
            'safeCancelled',
          );
        } else if (leaseRef) {
          current = await this.commitPatch({
            current,
            patch: {
              phase: 'PAUSED',
              cancelDisposition: 'paused',
              sanitizedError: sanitizeFirmwareUpdateJournalError(error),
            },
          });
        } else {
          const failed = await this.dependencies.journal.markFailed({
            expectedRevision: current.revision,
            error,
          });
          await this.publishJournal(failed);
        }
        throw error;
      } finally {
        this.cancelRequestedSessions.delete(input.transactionId);
      }
    });
  }

  async resumePreparation({
    sessionId,
    eligibilityContext,
  }: {
    sessionId: string;
    eligibilityContext?: TEligibilityContext;
  }): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      const loaded = await this.dependencies.journal.read();
      this.assertSession(loaded, sessionId);
      let current: IFirmwareUpdateJournalEnvelope = loaded;
      if (current.terminalTombstone || !current.updatePlan) {
        throw coordinatorError(
          'PREPARATION_RECOVERY_UNAVAILABLE',
          'Firmware transaction has no resumable acquisition state',
        );
      }
      const plan = await this.dependencies.validatePlan(current.updatePlan);
      if (
        current.phase === 'PLAN_CREATED' ||
        current.phase === 'ELIGIBILITY_CHECKING'
      ) {
        const attestation = current.userAttestation;
        if (!eligibilityContext || !attestation) {
          throw coordinatorError(
            'RECOVERY_ELIGIBILITY_CONTEXT_REQUIRED',
            'Firmware recovery requires the original device eligibility context',
          );
        }
        current = await this.commitPatch({
          current,
          patch: {
            phase: 'ELIGIBILITY_CHECKING',
          },
        });
        await this.dependencies.eligibility.assertBeforeAcquisition({
          context: eligibilityContext,
          attestation,
        });
      }
      let leaseRef = current.leaseRef;
      current = await this.commitPatch({
        current,
        patch: {
          phase: 'ACQUIRING',
          cancelDisposition: 'none',
          recoveryReason: undefined,
          sanitizedError: undefined,
        },
      });
      try {
        const lifecycle = {
          onLeaseCreated: async (value: string) => {
            leaseRef = value;
            current = await this.commitPatch({
              current,
              patch: {
                leaseRef: value,
                artifacts: plan.artifacts.map((requirement) => ({
                  artifactId: requirement.artifactId,
                  state: 'pending' as const,
                  leaseRef: value,
                  downloadedBytes: 0,
                  ...(requirement.expectedSize === undefined
                    ? {}
                    : { expectedSize: requirement.expectedSize }),
                  ...(requirement.expectedSha256 === undefined
                    ? {}
                    : {
                        sha256: requirement.expectedSha256.toLowerCase(),
                      }),
                })),
              },
            });
          },
          onArtifactReady: async (
            stored: IFirmwareStoredArtifact,
            telemetry?: IFirmwareArtifactLifecycleTelemetry,
          ) => {
            if (!leaseRef) {
              throw coordinatorError(
                'LEASE_NOT_READY',
                'Firmware recovery artifact arrived before its lease was committed',
              );
            }
            const effectiveTelemetry = telemetry ?? {
              phase:
                current.phase === 'MATERIALIZING'
                  ? ('materialization' as const)
                  : ('acquisition' as const),
              routeType: stored.acquisition?.routeType ?? 'domain',
              candidateIndex: 0,
              durationMs: 0,
              bytesReused: stored.acquisition?.bytesReused ?? 0,
              resumeKind: stored.acquisition?.resumeKind ?? 'none',
              resumeCount: stored.acquisition?.resumeCount ?? 0,
            };
            const artifact = toJournalArtifact({ stored, leaseRef });
            current = await this.commitPatch({
              current,
              patch: {
                artifacts: upsertJournalArtifact(current.artifacts, artifact),
              },
              progress: {
                stage: effectiveTelemetry.phase,
                completed: artifact.downloadedBytes,
                total: artifact.expectedSize ?? artifact.downloadedBytes,
                artifactId: artifact.artifactId,
                target: stored.requirement.target,
              },
            });
            await this.dependencies.onArtifactAcquired({
              transactionId: sessionId,
              artifactId: artifact.artifactId,
              artifactBytes: artifact.downloadedBytes,
              telemetry: effectiveTelemetry,
            });
          },
          onMaterializationStarted: async () => {
            current = await this.commitPatch({
              current,
              patch: {
                phase: 'MATERIALIZING',
              },
            });
          },
        };
        const prepared = leaseRef
          ? await this.dependencies.artifactProvider.resumeArtifacts({
              plan,
              leaseRef,
              lifecycle,
            })
          : await this.dependencies.artifactProvider.prepareArtifacts({
              transactionId: sessionId,
              plan,
              lifecycle,
            });
        const validatedPreparedPlan =
          await this.dependencies.validatePreparedPlan(prepared.preparedPlan);
        const preparedLeaseRef = leaseRef;
        if (!preparedLeaseRef || prepared.leaseRef !== preparedLeaseRef) {
          throw coordinatorError(
            'LEASE_MISMATCH',
            'Firmware recovery returned a different artifact lease',
          );
        }
        current = await this.dependencies.journal.markPrepared({
          expectedRevision: current.revision,
          preparedPlan: validatedPreparedPlan,
          artifacts: prepared.storedArtifacts.map((stored) =>
            toJournalArtifact({ stored, leaseRef: preparedLeaseRef }),
          ),
          leaseRef: preparedLeaseRef,
        });
        return this.publishJournal(current);
      } catch (error) {
        current = await this.commitPatch({
          current,
          patch: {
            phase: 'PAUSED',
            cancelDisposition: 'paused',
            recoveryReason: 'artifact_recovery_unavailable',
            sanitizedError: sanitizeFirmwareUpdateJournalError(error),
          },
        });
        throw error;
      }
    });
  }

  async restorePreparedArtifacts(
    sessionId: string,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (
        current.terminalTombstone ||
        !current.preparedPlan ||
        !current.leaseRef
      ) {
        throw coordinatorError(
          'PREPARED_RECOVERY_UNAVAILABLE',
          'Firmware transaction has no PreparedPlan to restore',
        );
      }
      await this.dependencies.artifactStore.restorePreparedPlan(
        current.preparedPlan,
      );
      return this.publishJournal(current);
    });
  }

  async markRecoveryWaiting({
    sessionId,
    reason,
    error,
  }: {
    sessionId: string;
    reason: 'awaiting_correct_device' | 'reconciliation_unavailable';
    error?: unknown;
  }): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (current.terminalTombstone) return this.publishJournal(current);
      const paused = await this.dependencies.journal.commit({
        expectedRevision: current.revision,
        patch: {
          phase: 'PAUSED',
          cancelDisposition: 'paused',
          recoveryReason: reason,
          ...(error === undefined
            ? {}
            : {
                sanitizedError: sanitizeFirmwareUpdateJournalError(error),
              }),
        },
      });
      return this.publishJournal(paused);
    });
  }

  async abandonExpiredPreparation(
    sessionId: string,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (current.terminalTombstone) return this.publishJournal(current);
      if (
        current.pendingDestructiveAction ||
        current.lastCommittedCheckpoint?.destructiveActionStarted
      ) {
        throw coordinatorError(
          'UNSAFE_ABANDON',
          'Expired firmware transaction has already mutated the device',
        );
      }
      const abandoned = await this.dependencies.journal.markTerminal({
        expectedRevision: current.revision,
        state: 'ABANDONED',
        leaseDisposition: 'safeAbandoned',
        abandonSafety: 'before-destructive-checkpoint',
        cancelDisposition: 'paused',
      });
      if (abandoned.leaseRef) {
        await this.dependencies.artifactStore.releaseLease(
          abandoned.leaseRef,
          'safeAbandoned',
        );
      }
      return this.publishJournal(abandoned);
    });
  }

  private async commitCheckpoint(
    sessionId: string,
    checkpoint: IFirmwareCheckpoint,
  ) {
    await this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (current.terminalTombstone) return;
      const committed = await this.dependencies.journal.commitCheckpoint({
        expectedRevision: current.revision,
        checkpoint,
        phase: mapCheckpointPhase(checkpoint),
        pendingDestructiveAction: mapPendingAction(checkpoint),
      });
      await this.publishJournal(committed);
    });
  }

  private async reportProgress(
    sessionId: string,
    event: IFirmwareProgressEvent,
  ) {
    await this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (!current.terminalTombstone) {
        await this.publishProgress(current, event);
      }
    });
  }

  private async pauseForRuntimeReset(sessionId: string, reason: string) {
    await this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (
        current.terminalTombstone ||
        current.phase === 'PAUSED' ||
        current.phase === 'PREPARED'
      ) {
        return;
      }
      const paused = await this.dependencies.journal.commit({
        expectedRevision: current.revision,
        patch: {
          phase: 'PAUSED',
          cancelDisposition: 'paused',
          recoveryReason: reason,
        },
      });
      await this.publishJournal(paused);
    });
  }

  private async finishExecution(
    sessionId: string,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    return this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (current.terminalTombstone) {
        return this.publishJournal(current);
      }
      const completed = await this.dependencies.journal.markTerminal({
        expectedRevision: current.revision,
        state: 'COMPLETED',
        leaseDisposition: 'completed',
      });
      const projection = await this.publishJournal(completed);
      if (completed.leaseRef) {
        await this.dependencies.artifactStore.releaseLease(
          completed.leaseRef,
          'completed',
        );
      }
      return projection;
    });
  }

  private async failExecution(
    sessionId: string,
    error: unknown,
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      this.assertSession(current, sessionId);
      if (current.terminalTombstone) return;
      const destructive =
        current.pendingDestructiveAction !== undefined ||
        current.lastCommittedCheckpoint?.destructiveActionStarted === true;
      if (destructive) {
        const recoveryReason = getRecoveryReason(error);
        const paused = await this.dependencies.journal.commit({
          expectedRevision: current.revision,
          patch: {
            phase: 'PAUSED',
            cancelDisposition: 'paused',
            ...(recoveryReason ? { recoveryReason } : {}),
            sanitizedError: sanitizeFirmwareUpdateJournalError(error),
          },
        });
        await this.publishJournal(paused);
        return;
      }
      const abandoned = await this.dependencies.journal.markTerminal({
        expectedRevision: current.revision,
        state: 'ABANDONED',
        leaseDisposition: 'safeAbandoned',
        abandonSafety: 'before-destructive-checkpoint',
        sanitizedError: sanitizeFirmwareUpdateJournalError(error),
      });
      await this.publishJournal(abandoned);
      if (abandoned.leaseRef) {
        await this.dependencies.artifactStore.releaseLease(
          abandoned.leaseRef,
          'safeAbandoned',
        );
      }
    });
  }

  private async runExecution({
    journal,
    eligibilityContext,
  }: {
    journal: IFirmwareUpdateJournalEnvelope;
    eligibilityContext: TEligibilityContext;
  }): Promise<IFirmwareUpdateCoordinatorProjection> {
    try {
      await this.dependencies.executePreparedPlan({
        transactionId: journal.transactionId,
        preparedPlan:
          journal.preparedPlan ??
          (() => {
            throw coordinatorError(
              'NOT_PREPARED',
              'Firmware transaction has no PreparedPlan',
            );
          })(),
        checkpoint: journal.lastCommittedCheckpoint,
        eligibilityContext,
      });
      return await this.finishExecution(journal.transactionId);
    } catch (error) {
      await this.failExecution(journal.transactionId, error);
      throw error;
    } finally {
      await this.dependencies.runtimeBinding.clear().catch(() => undefined);
      await this.mutex.runExclusive(async () => {
        this.executionPromise = undefined;
      });
    }
  }

  async execute(
    input: IFirmwareUpdateCoordinatorExecutionInput<TEligibilityContext>,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    const setup = await this.mutex.runExclusive(async () => {
      if (this.executionPromise) {
        throw coordinatorError(
          'EXECUTION_IN_PROGRESS',
          'A firmware transaction is already executing',
        );
      }
      let current = await this.dependencies.journal.read();
      this.assertSession(current, input.sessionId);
      if (
        current.terminalTombstone ||
        !current.preparedPlan ||
        !current.leaseRef ||
        !current.userAttestation
      ) {
        throw coordinatorError(
          'NOT_PREPARED',
          'Firmware transaction is not ready for device mutation',
        );
      }
      const attestation: IFirmwareUpdateJournalUserAttestation =
        current.userAttestation;
      await this.dependencies.eligibility.assertBeforeDeviceMutation({
        context: input.eligibilityContext,
        attestation,
      });
      await this.dependencies.runtimeBinding.bind({
        binding: {
          artifactReader:
            this.dependencies.artifactStore.createArtifactReader(),
          checkpointSink: {
            commit: (checkpoint) =>
              this.commitCheckpoint(input.sessionId, checkpoint),
          },
          progressSink: {
            report: (event) => this.reportProgress(input.sessionId, event),
          },
        },
        onBeforeGenerationChange: (reason) =>
          this.pauseForRuntimeReset(input.sessionId, reason),
      });
      current = await this.commitPatch({
        current,
        patch: {
          phase: 'ENTERING_LOADER',
          cancelDisposition: 'none',
          recoveryReason: undefined,
          sanitizedError: undefined,
        },
      });
      const execution = this.runExecution({
        journal: current,
        eligibilityContext: input.eligibilityContext,
      });
      this.executionPromise = execution;
      return {
        execution,
      };
    });
    return setup.execution;
  }

  async cancel(
    sessionId: string,
  ): Promise<IFirmwareUpdateCoordinatorProjection> {
    this.cancelRequestedSessions.add(sessionId);
    return this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      if (
        !current &&
        this.projection?.sessionId === sessionId &&
        this.projection.phase === 'DISCOVERING'
      ) {
        const cancelled: IFirmwareUpdateCoordinatorProjection = Object.freeze({
          ...this.projection,
          phase: 'ABANDONED',
          cancelDisposition: 'cancelled-before-mutation',
        });
        this.projection = cancelled;
        await this.dependencies.publishProjection(cancelled);
        return cancelled;
      }
      this.assertSession(current, sessionId);
      if (current.terminalTombstone) {
        return this.publishJournal(current);
      }
      if (
        [
          'DISCOVERING',
          'PLAN_CREATED',
          'ELIGIBILITY_CHECKING',
          'ACQUIRING',
          'MATERIALIZING',
          'PREPARED',
        ].includes(current.phase)
      ) {
        const cancelled = await this.dependencies.journal.markTerminal({
          expectedRevision: current.revision,
          state: 'ABANDONED',
          leaseDisposition: 'safeCancelled',
          abandonSafety: 'before-destructive-checkpoint',
          cancelDisposition: 'cancelled-before-mutation',
        });
        if (cancelled.leaseRef) {
          await this.dependencies.artifactStore.releaseLease(
            cancelled.leaseRef,
            'safeCancelled',
          );
        }
        return this.publishJournal(cancelled);
      }
      if (current.phase === 'INSTALLING' || current.phase === 'VERIFYING') {
        const detached = await this.dependencies.journal.commit({
          expectedRevision: current.revision,
          patch: {
            cancelDisposition: 'stop-waiting',
          },
        });
        return this.publishJournal(detached);
      }
      await this.dependencies.cancelExecution(sessionId);
      const paused = await this.dependencies.journal.commit({
        expectedRevision: current.revision,
        patch: {
          phase: 'PAUSED',
          cancelDisposition: 'paused',
        },
      });
      return this.publishJournal(paused);
    });
  }

  async getProjection({
    broadcast = false,
  }: {
    broadcast?: boolean;
  } = {}): Promise<IFirmwareUpdateCoordinatorProjection | undefined> {
    return this.mutex.runExclusive(async () => {
      const current = await this.dependencies.journal.read();
      if (!current) return undefined;
      if (
        !this.projection ||
        this.projection.sessionId !== current.transactionId ||
        this.projection.revision !== current.revision
      ) {
        return this.publishJournal(current);
      }
      if (broadcast) {
        await this.dependencies.publishProjection(this.projection);
      }
      return this.projection;
    });
  }
}

export const getFirmwareCoordinatorFailureCode = (
  error: unknown,
): string | undefined => {
  if (
    error instanceof OneKeyLocalError &&
    'firmwareUpdateCoordinatorCode' in error &&
    typeof error.firmwareUpdateCoordinatorCode === 'string'
  ) {
    return error.firmwareUpdateCoordinatorCode;
  }
  return getFirmwareArtifactFailureCode(error);
};
