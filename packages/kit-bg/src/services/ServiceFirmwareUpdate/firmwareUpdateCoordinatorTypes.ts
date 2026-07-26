import type {
  IFirmwareUpdateCapabilityFailure,
  IFirmwareUpdateCapabilityGate,
  IFirmwareUpdateDeploymentTarget,
} from '@onekeyhq/shared/src/hardware/firmwareUpdateCapabilities';
import type { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';

type IHardwareCoreSdkModule = Awaited<ReturnType<typeof CoreSDKLoader>>;

export type IFirmwareUpdatePlan = ReturnType<
  IHardwareCoreSdkModule['validateFirmwareUpdatePlan']
>;

export type IFirmwareArtifactRequirement =
  IFirmwareUpdatePlan['artifacts'][number];

export type IFirmwareArtifactReader = Parameters<
  IHardwareCoreSdkModule['registerFirmwareHostBinding']
>[0]['artifactReader'];

export type IFirmwareCheckpoint = Parameters<
  Parameters<
    IHardwareCoreSdkModule['registerFirmwareHostBinding']
  >[0]['checkpointSink']['commit']
>[0];

export type IFirmwarePreparedPlan = ReturnType<
  IHardwareCoreSdkModule['prepareFirmwareUpdate']
>;

export type IFirmwarePreparationCoreSdk = Pick<
  IHardwareCoreSdkModule,
  'prepareFirmwareUpdate'
>;

export type IFirmwareManifestCoreSdk = Pick<
  IHardwareCoreSdkModule,
  | 'computeFirmwareManifestSnapshotDigest'
  | 'deepFreezeFirmwareValue'
  | 'sha256CanonicalFirmwareJson'
  | 'validateFirmwareManifestSnapshot'
>;

export type IFirmwareManifestSnapshot = ReturnType<
  IHardwareCoreSdkModule['validateFirmwareManifestSnapshot']
>;

export type IFirmwareManifestChannel = 'stable' | 'pre-release';

export type IFirmwareManifestField =
  | 'firmware'
  | 'firmware-v1'
  | 'firmware-v2'
  | 'firmware-v8'
  | 'firmware-btc-v8'
  | 'ble';

export type IFirmwareManifestFirmwareType = 'universal' | 'bitcoinonly';

export type IFirmwareManifestSelection = {
  channel: IFirmwareManifestChannel;
  deviceModel:
    | 'classic'
    | 'classic1s'
    | 'classicpure'
    | 'mini'
    | 'touch'
    | 'pro'
    | 'pro2';
  firmwareField: IFirmwareManifestField;
  firmwareType: IFirmwareManifestFirmwareType;
};

export type IFirmwareManifestLoadSource =
  | 'verified-remote'
  | 'last-good-cache'
  | 'app-bundled-catalog';

export type IFirmwareManifestLoadResult = {
  key: string;
  catalogEpoch: number;
  catalogLineage: string;
  projectionDigest: string;
  sourceSelectionDigest: string;
  snapshot: IFirmwareManifestSnapshot;
  snapshotDigest: string;
  source: IFirmwareManifestLoadSource;
};

export type EFirmwareUpdateCoordinatorPhase =
  | 'DISCOVERING'
  | 'PLAN_CREATED'
  | 'ELIGIBILITY_CHECKING'
  | 'ACQUIRING'
  | 'MATERIALIZING'
  | 'PREPARED'
  | 'ENTERING_LOADER'
  | 'TRANSFERRING'
  | 'INSTALLING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'FAILED'
  | 'ABANDONED'
  | 'RECOVERY_UNSUPPORTED';

export type IFirmwareUpdateEngine =
  | 'legacy'
  | 'transaction'
  | 'recovery_unsupported';

export type IFirmwareUpdateCapabilitySnapshot = {
  deploymentTarget: IFirmwareUpdateDeploymentTarget;
  gate: IFirmwareUpdateCapabilityGate;
  evaluatedAt: number;
};

export type IFirmwareUpdateCoordinatorUnavailableReason =
  IFirmwareUpdateCapabilityFailure;

export type IFirmwareUpdateCoordinatorProjection = {
  sessionId: string;
  revision: number;
  phase: EFirmwareUpdateCoordinatorPhase;
  engine: IFirmwareUpdateEngine;
  unavailableReason?: IFirmwareUpdateCoordinatorUnavailableReason;
  progress?: {
    stage: 'acquisition' | 'materialization' | 'transfer' | 'install';
    completed: number;
    total: number;
    artifactId?: string;
    target?: IFirmwareArtifactRequirement['target'];
  };
  action?:
    | 'none'
    | 'awaiting-device'
    | 'confirm-on-device'
    | 'reconnect'
    | 'retry';
  cancelDisposition?: EFirmwareUpdateJournalCancelDisposition;
  error?: IFirmwareUpdateJournalSanitizedError;
};

export type EFirmwareUpdateJournalCancelDisposition =
  | 'none'
  | 'cancelled-before-mutation'
  | 'paused'
  | 'stop-waiting';

export type EFirmwareUpdateJournalArtifactState =
  | 'pending'
  | 'partial'
  | 'verified'
  | 'materialized'
  | 'quarantined';

export type IFirmwareUpdateJournalArtifact = {
  artifactId: string;
  state: EFirmwareUpdateJournalArtifactState;
  leaseRef: string;
  artifactRef?: string;
  partialRef?: string;
  expectedSize?: number;
  downloadedBytes: number;
  sha256?: string;
};

export type IFirmwareUpdateJournalCapabilityVersions = {
  appJournalSchemaVersion: 1;
  sdkPlanSchemaVersion: number;
  sdkPreparedPlanSchemaVersion: number;
  sdkHostBindingProtocolVersion: number;
  sdkCheckpointSchemaVersion: number;
  artifactRuntime: 'native' | 'desktop';
  artifactProtocolVersion: number;
  maxReadBytes: number;
};

export type IFirmwareUpdateJournalRollout = {
  policyVersion: number;
  cohortBucket: number;
  engine: 'fnv1a32-v1';
  eligibilityAttestationDigest: string;
};

export type IFirmwareUpdateJournalUserAttestation = {
  backuped: true;
  usbConnected: true;
  confirmedAt: number;
  attestationDigest: string;
};

export type IFirmwareUpdateJournalPendingAction = {
  kind: 'enter-loader' | 'transfer' | 'install' | 'reboot-between-epochs';
  checkpointSeq: number;
  epochId?: string;
  artifactId?: string;
  target?: IFirmwareArtifactRequirement['target'];
};

export type IFirmwareUpdateJournalSanitizedError = {
  name: string;
  message: string;
  code?: string | number;
  retryable?: boolean;
};

export type IFirmwareUpdateJournalTerminalTombstone = {
  state: 'COMPLETED' | 'FAILED' | 'ABANDONED';
  createdAt: number;
  checkpointSeq: number;
  leaseDisposition:
    | 'completed'
    | 'safeCancelled'
    | 'safeAbandoned'
    | 'retained';
  abandonSafety?: 'before-destructive-checkpoint' | 'device-proven-safe';
};

export type IFirmwareUpdateJournalEnvelope = {
  schemaVersion: 1;
  transactionId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  phase: EFirmwareUpdateCoordinatorPhase;
  cancelDisposition: EFirmwareUpdateJournalCancelDisposition;
  recoveryReason?: string;
  capabilities: IFirmwareUpdateJournalCapabilityVersions;
  stableDeviceId: string;
  model: string;
  deviceSnapshotDigest: string;
  planId?: string;
  planDigest?: string;
  manifestDigest?: string;
  catalogEpoch?: number;
  updatePlan?: IFirmwareUpdatePlan;
  preparedPlan?: IFirmwarePreparedPlan;
  artifacts: readonly IFirmwareUpdateJournalArtifact[];
  leaseRef?: string;
  lastCommittedCheckpoint?: IFirmwareCheckpoint;
  checkpointSeq: number;
  pendingDestructiveAction?: IFirmwareUpdateJournalPendingAction;
  rollout: IFirmwareUpdateJournalRollout;
  userAttestation?: IFirmwareUpdateJournalUserAttestation;
  sanitizedError?: IFirmwareUpdateJournalSanitizedError;
  terminalTombstone?: IFirmwareUpdateJournalTerminalTombstone;
};
