import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { firmwareUpdateJournalEntity } from '../../dbs/simple/entity/SimpleDbEntityFirmwareUpdateJournal';

import type {
  EFirmwareUpdateCoordinatorPhase,
  IFirmwareCheckpoint,
  IFirmwarePreparedPlan,
  IFirmwareUpdateJournalArtifact,
  IFirmwareUpdateJournalCapabilityVersions,
  IFirmwareUpdateJournalEnvelope,
  IFirmwareUpdateJournalPendingAction,
  IFirmwareUpdateJournalRollout,
  IFirmwareUpdateJournalSanitizedError,
  IFirmwareUpdateJournalTerminalTombstone,
  IFirmwareUpdateJournalUserAttestation,
  IFirmwareUpdatePlan,
} from './firmwareUpdateCoordinatorTypes';
import type { SimpleDbEntityFirmwareUpdateJournal } from '../../dbs/simple/entity/SimpleDbEntityFirmwareUpdateJournal';

export const FIRMWARE_UPDATE_JOURNAL_SCHEMA_VERSION = 1 as const;

const MAX_JOURNAL_DEPTH = 16;
const MAX_JOURNAL_NODES = 20_000;
const MAX_JOURNAL_ARRAY_LENGTH = 4096;
const MAX_JOURNAL_OBJECT_KEYS = 256;
const MAX_JOURNAL_STRING_LENGTH = 16_384;
const MAX_JOURNAL_TOTAL_STRING_LENGTH = 1_048_576;
const MAX_JOURNAL_JSON_LENGTH = 2_097_152;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const OPAQUE_REF_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/iu;
const URL_PATTERN = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/iu;
const ABSOLUTE_PATH_PATTERN =
  /(?:^|[\s"'(])(?:\/(?:Users|home|var|tmp|private|data|storage)\/|[a-z]:[\\/]|\\\\)/iu;
const URL_REDACTION_PATTERN = /\b(?:https?|file):\/\/[^\s)>\]}]+/giu;
const PATH_REDACTION_PATTERN =
  /(?:\/(?:Users|home|var|tmp|private|data|storage)\/|[a-z]:[\\/]|\\\\)[^\s)>\]}]+/giu;

const JOURNAL_PHASES = new Set<EFirmwareUpdateCoordinatorPhase>([
  'DISCOVERING',
  'PLAN_CREATED',
  'ELIGIBILITY_CHECKING',
  'ACQUIRING',
  'MATERIALIZING',
  'PREPARED',
  'ENTERING_LOADER',
  'TRANSFERRING',
  'INSTALLING',
  'VERIFYING',
  'COMPLETED',
  'PAUSED',
  'FAILED',
  'ABANDONED',
  'RECOVERY_UNSUPPORTED',
]);
const PREPARED_REQUIRED_PHASES = new Set<EFirmwareUpdateCoordinatorPhase>([
  'PREPARED',
  'ENTERING_LOADER',
  'TRANSFERRING',
  'INSTALLING',
  'VERIFYING',
  'COMPLETED',
]);
const TERMINAL_PHASES = new Set<EFirmwareUpdateCoordinatorPhase>([
  'COMPLETED',
  'FAILED',
  'ABANDONED',
]);
const CANCEL_DISPOSITIONS = new Set([
  'none',
  'cancelled-before-mutation',
  'paused',
  'stop-waiting',
]);
const ARTIFACT_STATES = new Set([
  'pending',
  'partial',
  'verified',
  'materialized',
  'quarantined',
]);
const PENDING_ACTION_KINDS = new Set([
  'enter-loader',
  'transfer',
  'install',
  'reboot-between-epochs',
]);
const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'ABANDONED']);
const LEASE_DISPOSITIONS = new Set([
  'completed',
  'safeCancelled',
  'safeAbandoned',
  'retained',
]);
const FORBIDDEN_KEYS = new Set([
  'absolutepath',
  'arraybuffer',
  'buffer',
  'fd',
  'filedescriptor',
  'filepath',
  'messageport',
  'path',
  'readerid',
]);

export type EFirmwareUpdateJournalErrorCode =
  | 'INVALID_JOURNAL'
  | 'JOURNAL_ALREADY_EXISTS'
  | 'JOURNAL_NOT_FOUND'
  | 'STALE_REVISION'
  | 'CHECKPOINT_REGRESSION'
  | 'TERMINAL_JOURNAL'
  | 'UNSAFE_ABANDON'
  | 'RUNTIME_NOT_SUPPORTED'
  | 'STORAGE_FAILED';

export type IFirmwareUpdateJournalError = OneKeyLocalError & {
  firmwareUpdateJournalCode: EFirmwareUpdateJournalErrorCode;
};

type IFirmwareUpdateJournalStorage = Pick<
  SimpleDbEntityFirmwareUpdateJournal,
  'clearRawData' | 'getRawData' | 'setRawData'
>;

export type IFirmwareUpdateJournalContractValidators = {
  validateUpdatePlan: (value: unknown) => IFirmwareUpdatePlan;
  validatePreparedPlan: (value: unknown) => IFirmwarePreparedPlan;
  validateCheckpoint: (value: unknown) => IFirmwareCheckpoint;
};

type IFirmwareUpdateJournalDependencies = {
  storage: IFirmwareUpdateJournalStorage;
  now: () => number;
  loadContractValidators: () => Promise<IFirmwareUpdateJournalContractValidators>;
};

type IFirmwareUpdateJournalCreateInput = Omit<
  IFirmwareUpdateJournalEnvelope,
  'createdAt' | 'revision' | 'schemaVersion' | 'updatedAt'
>;

type IFirmwareUpdateJournalPatch = Partial<
  Omit<
    IFirmwareUpdateJournalEnvelope,
    'createdAt' | 'revision' | 'schemaVersion' | 'transactionId' | 'updatedAt'
  >
>;

const createJournalError = (
  code: EFirmwareUpdateJournalErrorCode,
  message: string,
): IFirmwareUpdateJournalError =>
  Object.assign(new OneKeyLocalError(message), {
    firmwareUpdateJournalCode: code,
  });

const fail = (
  code: EFirmwareUpdateJournalErrorCode,
  message: string,
): never => {
  throw createJournalError(code, message);
};

const isJournalError = (error: unknown): error is IFirmwareUpdateJournalError =>
  error instanceof OneKeyLocalError && 'firmwareUpdateJournalCode' in error;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const assertExactKeys = ({
  value,
  required,
  optional = [],
  field,
}: {
  value: Record<string, unknown>;
  required: readonly string[];
  optional?: readonly string[];
  field: string;
}) => {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  const unknown = keys.find((key) => !allowed.has(key));
  const missing = required.find((key) => !(key in value));
  if (unknown || missing) {
    fail(
      'INVALID_JOURNAL',
      `${field} has ${unknown ? `unknown field ${unknown}` : `missing field ${missing}`}`,
    );
  }
};

const assertSafeInteger = (
  value: unknown,
  field: string,
  minimum = 0,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    return fail(
      'INVALID_JOURNAL',
      `${field} must be a safe integer greater than or equal to ${minimum}`,
    );
  }
  return value as number;
};

const assertString = (
  value: unknown,
  field: string,
  maxLength = 256,
): string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    return fail('INVALID_JOURNAL', `${field} must be a bounded string`);
  }
  return value;
};

const assertDigest = (value: unknown, field: string): string => {
  const digest = assertString(value, field, 64);
  if (!SHA256_PATTERN.test(digest)) {
    return fail('INVALID_JOURNAL', `${field} must be a SHA-256 digest`);
  }
  return digest;
};

const assertOpaqueRef = (value: unknown, field: string): string => {
  const reference = assertString(value, field, 160);
  if (!OPAQUE_REF_PATTERN.test(reference)) {
    return fail(
      'INVALID_JOURNAL',
      `${field} must be an opaque reference without a path or URL`,
    );
  }
  return reference;
};

const isAllowedPlanUrl = (path: readonly string[]) =>
  path[0] === 'updatePlan' && path.includes('sourceUrls');

const assertJournalJsonSafe = (value: unknown) => {
  const counters = {
    nodes: 0,
    stringLength: 0,
  };

  const visit = (
    current: unknown,
    path: readonly string[],
    depth: number,
  ): void => {
    counters.nodes += 1;
    if (depth > MAX_JOURNAL_DEPTH || counters.nodes > MAX_JOURNAL_NODES) {
      fail('INVALID_JOURNAL', 'Firmware journal exceeds structural limits');
    }
    if (
      current === null ||
      typeof current === 'boolean' ||
      typeof current === 'number'
    ) {
      if (
        typeof current === 'number' &&
        (!Number.isFinite(current) || !Number.isSafeInteger(current))
      ) {
        fail(
          'INVALID_JOURNAL',
          `Firmware journal contains an unsafe number at ${path.join('.')}`,
        );
      }
      return;
    }
    if (typeof current === 'string') {
      counters.stringLength += current.length;
      if (
        current.length > MAX_JOURNAL_STRING_LENGTH ||
        counters.stringLength > MAX_JOURNAL_TOTAL_STRING_LENGTH
      ) {
        fail('INVALID_JOURNAL', 'Firmware journal exceeds string limits');
      }
      if (
        !isAllowedPlanUrl(path) &&
        (URL_PATTERN.test(current) || ABSOLUTE_PATH_PATTERN.test(current))
      ) {
        fail(
          'INVALID_JOURNAL',
          `Firmware journal contains a URL or real path at ${path.join('.')}`,
        );
      }
      return;
    }
    if (Array.isArray(current)) {
      if (current.length > MAX_JOURNAL_ARRAY_LENGTH) {
        fail('INVALID_JOURNAL', 'Firmware journal array is too large');
      }
      current.forEach((entry, index) =>
        visit(entry, [...path, String(index)], depth + 1),
      );
      return;
    }
    if (!isPlainRecord(current)) {
      return fail(
        'INVALID_JOURNAL',
        `Firmware journal contains a non-JSON value at ${path.join('.')}`,
      );
    }
    const keys = Object.keys(current);
    if (keys.length > MAX_JOURNAL_OBJECT_KEYS) {
      fail('INVALID_JOURNAL', 'Firmware journal object has too many fields');
    }
    keys.forEach((key) => {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        fail(
          'INVALID_JOURNAL',
          `Firmware journal contains forbidden field ${key}`,
        );
      }
      visit(current[key], [...path, key], depth + 1);
    });
  };

  visit(value, [], 0);
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length > MAX_JOURNAL_JSON_LENGTH) {
    fail('INVALID_JOURNAL', 'Firmware journal exceeds serialized size limits');
  }
};

const validateCapabilities = (
  value: unknown,
): IFirmwareUpdateJournalCapabilityVersions => {
  if (!isPlainRecord(value)) {
    return fail('INVALID_JOURNAL', 'Firmware journal capabilities are invalid');
  }
  assertExactKeys({
    value,
    required: [
      'appJournalSchemaVersion',
      'sdkPlanSchemaVersion',
      'sdkPreparedPlanSchemaVersion',
      'sdkHostBindingProtocolVersion',
      'sdkCheckpointSchemaVersion',
      'artifactRuntime',
      'artifactProtocolVersion',
      'maxReadBytes',
    ],
    field: 'capabilities',
  });
  if (
    value.appJournalSchemaVersion !== FIRMWARE_UPDATE_JOURNAL_SCHEMA_VERSION ||
    (value.artifactRuntime !== 'native' && value.artifactRuntime !== 'desktop')
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal capability discriminant is invalid',
    );
  }
  [
    'sdkPlanSchemaVersion',
    'sdkPreparedPlanSchemaVersion',
    'sdkHostBindingProtocolVersion',
    'sdkCheckpointSchemaVersion',
    'artifactProtocolVersion',
    'maxReadBytes',
  ].forEach((field) =>
    assertSafeInteger(value[field], `capabilities.${field}`, 1),
  );
  return value as IFirmwareUpdateJournalCapabilityVersions;
};

const validateRollout = (value: unknown): IFirmwareUpdateJournalRollout => {
  if (!isPlainRecord(value)) {
    return fail('INVALID_JOURNAL', 'Firmware journal rollout is invalid');
  }
  assertExactKeys({
    value,
    required: [
      'policyVersion',
      'cohortBucket',
      'engine',
      'eligibilityAttestationDigest',
    ],
    field: 'rollout',
  });
  assertSafeInteger(value.policyVersion, 'rollout.policyVersion');
  const bucket = assertSafeInteger(value.cohortBucket, 'rollout.cohortBucket');
  if (bucket >= 10_000 || value.engine !== 'fnv1a32-v1') {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal rollout discriminant is invalid',
    );
  }
  assertDigest(
    value.eligibilityAttestationDigest,
    'rollout.eligibilityAttestationDigest',
  );
  return value as IFirmwareUpdateJournalRollout;
};

const validateArtifact = (
  value: unknown,
  index: number,
): IFirmwareUpdateJournalArtifact => {
  if (!isPlainRecord(value)) {
    return fail('INVALID_JOURNAL', `artifacts.${index} is invalid`);
  }
  assertExactKeys({
    value,
    required: ['artifactId', 'state', 'leaseRef', 'downloadedBytes'],
    optional: ['artifactRef', 'partialRef', 'expectedSize', 'sha256'],
    field: `artifacts.${index}`,
  });
  assertString(value.artifactId, `artifacts.${index}.artifactId`);
  assertOpaqueRef(value.leaseRef, `artifacts.${index}.leaseRef`);
  if (!ARTIFACT_STATES.has(value.state as string)) {
    return fail(
      'INVALID_JOURNAL',
      `artifacts.${index}.state has an invalid discriminant`,
    );
  }
  const downloadedBytes = assertSafeInteger(
    value.downloadedBytes,
    `artifacts.${index}.downloadedBytes`,
  );
  if (value.expectedSize !== undefined) {
    const expectedSize = assertSafeInteger(
      value.expectedSize,
      `artifacts.${index}.expectedSize`,
      1,
    );
    if (downloadedBytes > expectedSize) {
      return fail(
        'INVALID_JOURNAL',
        `artifacts.${index}.downloadedBytes exceeds expectedSize`,
      );
    }
  }
  if (value.artifactRef !== undefined) {
    assertOpaqueRef(value.artifactRef, `artifacts.${index}.artifactRef`);
  }
  if (value.partialRef !== undefined) {
    assertOpaqueRef(value.partialRef, `artifacts.${index}.partialRef`);
  }
  if (value.sha256 !== undefined) {
    assertDigest(value.sha256, `artifacts.${index}.sha256`);
  }
  if (
    (value.state === 'verified' || value.state === 'materialized') &&
    value.artifactRef === undefined
  ) {
    return fail(
      'INVALID_JOURNAL',
      `artifacts.${index} requires an artifactRef`,
    );
  }
  if (value.state === 'partial' && value.partialRef === undefined) {
    return fail('INVALID_JOURNAL', `artifacts.${index} requires a partialRef`);
  }
  return value as IFirmwareUpdateJournalArtifact;
};

const validatePendingAction = (
  value: unknown,
): IFirmwareUpdateJournalPendingAction => {
  if (!isPlainRecord(value)) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal pending action is invalid',
    );
  }
  assertExactKeys({
    value,
    required: ['kind', 'checkpointSeq'],
    optional: ['epochId', 'artifactId', 'target'],
    field: 'pendingDestructiveAction',
  });
  if (!PENDING_ACTION_KINDS.has(value.kind as string)) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal pending action discriminant is invalid',
    );
  }
  assertSafeInteger(
    value.checkpointSeq,
    'pendingDestructiveAction.checkpointSeq',
  );
  ['epochId', 'artifactId', 'target'].forEach((field) => {
    if (value[field] !== undefined) {
      assertString(value[field], `pendingDestructiveAction.${field}`);
    }
  });
  return value as IFirmwareUpdateJournalPendingAction;
};

const validateUserAttestation = (
  value: unknown,
): IFirmwareUpdateJournalUserAttestation => {
  if (!isPlainRecord(value)) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal user attestation is invalid',
    );
  }
  assertExactKeys({
    value,
    required: ['backuped', 'usbConnected', 'confirmedAt', 'attestationDigest'],
    field: 'userAttestation',
  });
  if (value.backuped !== true || value.usbConnected !== true) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal user confirmations are incomplete',
    );
  }
  assertSafeInteger(value.confirmedAt, 'userAttestation.confirmedAt', 1);
  assertDigest(value.attestationDigest, 'userAttestation.attestationDigest');
  return value as IFirmwareUpdateJournalUserAttestation;
};

const validateSanitizedError = (
  value: unknown,
): IFirmwareUpdateJournalSanitizedError => {
  if (!isPlainRecord(value)) {
    return fail('INVALID_JOURNAL', 'Firmware journal error is invalid');
  }
  assertExactKeys({
    value,
    required: ['name', 'message'],
    optional: ['code', 'retryable'],
    field: 'sanitizedError',
  });
  assertString(value.name, 'sanitizedError.name', 128);
  assertString(value.message, 'sanitizedError.message', 512);
  if (
    value.code !== undefined &&
    typeof value.code !== 'string' &&
    !Number.isSafeInteger(value.code)
  ) {
    return fail('INVALID_JOURNAL', 'sanitizedError.code is invalid');
  }
  if (typeof value.code === 'string') {
    assertString(value.code, 'sanitizedError.code', 128);
  }
  if (value.retryable !== undefined && typeof value.retryable !== 'boolean') {
    return fail('INVALID_JOURNAL', 'sanitizedError.retryable is invalid');
  }
  return value as IFirmwareUpdateJournalSanitizedError;
};

const validateTombstone = (
  value: unknown,
): IFirmwareUpdateJournalTerminalTombstone => {
  if (!isPlainRecord(value)) {
    return fail('INVALID_JOURNAL', 'Firmware journal tombstone is invalid');
  }
  assertExactKeys({
    value,
    required: ['state', 'createdAt', 'checkpointSeq', 'leaseDisposition'],
    optional: ['abandonSafety'],
    field: 'terminalTombstone',
  });
  if (
    !TERMINAL_STATES.has(value.state as string) ||
    !LEASE_DISPOSITIONS.has(value.leaseDisposition as string)
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal tombstone discriminant is invalid',
    );
  }
  assertSafeInteger(value.createdAt, 'terminalTombstone.createdAt', 1);
  assertSafeInteger(value.checkpointSeq, 'terminalTombstone.checkpointSeq', -1);
  if (
    value.abandonSafety !== undefined &&
    value.abandonSafety !== 'before-destructive-checkpoint' &&
    value.abandonSafety !== 'device-proven-safe'
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal abandon safety is invalid',
    );
  }
  if (value.state === 'ABANDONED' && value.abandonSafety === undefined) {
    return fail(
      'INVALID_JOURNAL',
      'Abandoned firmware journal requires a safety proof',
    );
  }
  if (
    (value.state === 'COMPLETED' && value.leaseDisposition !== 'completed') ||
    (value.state === 'FAILED' && value.leaseDisposition !== 'retained') ||
    (value.state === 'ABANDONED' &&
      value.leaseDisposition !== 'safeAbandoned' &&
      value.leaseDisposition !== 'safeCancelled')
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal state and lease disposition do not match',
    );
  }
  if (value.state !== 'ABANDONED' && value.abandonSafety !== undefined) {
    return fail(
      'INVALID_JOURNAL',
      'Only an abandoned firmware journal may contain an abandon safety proof',
    );
  }
  return value as IFirmwareUpdateJournalTerminalTombstone;
};

const PHASES_REQUIRING_PLAN = new Set<EFirmwareUpdateCoordinatorPhase>([
  'PLAN_CREATED',
  'ELIGIBILITY_CHECKING',
  'ACQUIRING',
  'MATERIALIZING',
  ...PREPARED_REQUIRED_PHASES,
]);

export const validateFirmwareUpdateJournalEnvelope = ({
  value,
  validators,
}: {
  value: unknown;
  validators: IFirmwareUpdateJournalContractValidators;
}): IFirmwareUpdateJournalEnvelope => {
  assertJournalJsonSafe(value);
  if (!isPlainRecord(value)) {
    return fail('INVALID_JOURNAL', 'Firmware journal must be an object');
  }
  assertExactKeys({
    value,
    required: [
      'schemaVersion',
      'transactionId',
      'revision',
      'createdAt',
      'updatedAt',
      'phase',
      'cancelDisposition',
      'capabilities',
      'stableDeviceId',
      'model',
      'deviceSnapshotDigest',
      'artifacts',
      'checkpointSeq',
      'rollout',
    ],
    optional: [
      'recoveryReason',
      'planId',
      'planDigest',
      'manifestDigest',
      'catalogEpoch',
      'updatePlan',
      'preparedPlan',
      'leaseRef',
      'lastCommittedCheckpoint',
      'pendingDestructiveAction',
      'userAttestation',
      'sanitizedError',
      'terminalTombstone',
    ],
    field: 'journal',
  });
  if (value.schemaVersion !== FIRMWARE_UPDATE_JOURNAL_SCHEMA_VERSION) {
    return fail('INVALID_JOURNAL', 'Firmware journal schema is unsupported');
  }
  assertString(value.transactionId, 'transactionId');
  assertSafeInteger(value.revision, 'revision');
  const createdAt = assertSafeInteger(value.createdAt, 'createdAt', 1);
  const updatedAt = assertSafeInteger(value.updatedAt, 'updatedAt', 1);
  if (updatedAt < createdAt) {
    return fail('INVALID_JOURNAL', 'Firmware journal timestamps regress');
  }
  if (!JOURNAL_PHASES.has(value.phase as EFirmwareUpdateCoordinatorPhase)) {
    return fail('INVALID_JOURNAL', 'Firmware journal phase is invalid');
  }
  if (!CANCEL_DISPOSITIONS.has(value.cancelDisposition as string)) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal cancel disposition is invalid',
    );
  }
  if (value.recoveryReason !== undefined) {
    assertString(value.recoveryReason, 'recoveryReason');
  }
  validateCapabilities(value.capabilities);
  assertString(value.stableDeviceId, 'stableDeviceId');
  assertString(value.model, 'model', 128);
  assertDigest(value.deviceSnapshotDigest, 'deviceSnapshotDigest');
  validateRollout(value.rollout);

  const phase = value.phase as EFirmwareUpdateCoordinatorPhase;
  const hasPlanFields = [
    value.planId,
    value.planDigest,
    value.manifestDigest,
    value.catalogEpoch,
  ].every((entry) => entry !== undefined);
  if (PHASES_REQUIRING_PLAN.has(phase) && !hasPlanFields) {
    return fail(
      'INVALID_JOURNAL',
      `Firmware journal phase ${phase} requires plan identity`,
    );
  }
  const hasPartialPlanFields = [
    value.planId,
    value.planDigest,
    value.manifestDigest,
    value.catalogEpoch,
  ].some((entry) => entry !== undefined);
  if (hasPartialPlanFields && !hasPlanFields) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal plan identity must be written atomically',
    );
  }
  if (hasPlanFields) {
    assertString(value.planId, 'planId');
    assertDigest(value.planDigest, 'planDigest');
    assertDigest(value.manifestDigest, 'manifestDigest');
    assertSafeInteger(value.catalogEpoch, 'catalogEpoch', 1);
  }

  const updatePlan =
    value.updatePlan === undefined
      ? undefined
      : validators.validateUpdatePlan(value.updatePlan);
  const preparedPlan =
    value.preparedPlan === undefined
      ? undefined
      : validators.validatePreparedPlan(value.preparedPlan);
  if (preparedPlan && updatePlan) {
    return fail(
      'INVALID_JOURNAL',
      'Prepared firmware journal must not retain the URL-bearing UpdatePlan',
    );
  }
  if (PREPARED_REQUIRED_PHASES.has(phase) && !preparedPlan) {
    return fail(
      'INVALID_JOURNAL',
      `Firmware journal phase ${phase} requires PreparedPlan`,
    );
  }
  [updatePlan, preparedPlan].forEach((plan) => {
    if (!plan) return;
    if (
      plan.planId !== value.planId ||
      plan.planDigest !== value.planDigest ||
      plan.manifestSnapshotDigest !== value.manifestDigest ||
      plan.catalogEpoch !== value.catalogEpoch
    ) {
      fail(
        'INVALID_JOURNAL',
        'Firmware journal plan identity does not match the embedded plan',
      );
    }
  });

  if (!Array.isArray(value.artifacts)) {
    return fail('INVALID_JOURNAL', 'Firmware journal artifacts are invalid');
  }
  const artifacts = value.artifacts.map(validateArtifact);
  const artifactIds = new Set<string>();
  artifacts.forEach((artifact) => {
    if (artifactIds.has(artifact.artifactId)) {
      fail(
        'INVALID_JOURNAL',
        `Firmware journal duplicates artifact ${artifact.artifactId}`,
      );
    }
    artifactIds.add(artifact.artifactId);
  });
  if (value.leaseRef !== undefined) {
    assertOpaqueRef(value.leaseRef, 'leaseRef');
    if (artifacts.some((artifact) => artifact.leaseRef !== value.leaseRef)) {
      return fail(
        'INVALID_JOURNAL',
        'Firmware journal artifacts do not belong to the active lease',
      );
    }
  }
  if (preparedPlan) {
    if (value.leaseRef === undefined) {
      return fail(
        'INVALID_JOURNAL',
        'Prepared firmware journal requires an active lease reference',
      );
    }
    preparedPlan.artifactReceipts.forEach((receipt) => {
      assertOpaqueRef(receipt.artifactRef, 'preparedPlan.artifactRef');
      assertOpaqueRef(receipt.leaseId, 'preparedPlan.leaseId');
      if (receipt.leaseId !== value.leaseRef) {
        fail(
          'INVALID_JOURNAL',
          `PreparedPlan artifact ${receipt.artifactId} belongs to a different lease`,
        );
      }
      if (
        !artifacts.some(
          (artifact) =>
            artifact.artifactId === receipt.artifactId &&
            artifact.artifactRef === receipt.artifactRef &&
            (artifact.state === 'verified' ||
              artifact.state === 'materialized'),
        )
      ) {
        fail(
          'INVALID_JOURNAL',
          `PreparedPlan artifact ${receipt.artifactId} is not durably materialized`,
        );
      }
    });
  }

  const checkpointSeq = assertSafeInteger(
    value.checkpointSeq,
    'checkpointSeq',
    -1,
  );
  const lastCommittedCheckpoint =
    value.lastCommittedCheckpoint === undefined
      ? undefined
      : validators.validateCheckpoint(value.lastCommittedCheckpoint);
  if (
    (lastCommittedCheckpoint &&
      lastCommittedCheckpoint.sequence !== checkpointSeq) ||
    (!lastCommittedCheckpoint && checkpointSeq !== -1)
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal checkpoint sequence does not match its checkpoint',
    );
  }
  if (
    lastCommittedCheckpoint &&
    (lastCommittedCheckpoint.transactionId !== value.transactionId ||
      lastCommittedCheckpoint.planDigest !== value.planDigest)
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal checkpoint identity is invalid',
    );
  }
  const pendingDestructiveAction =
    value.pendingDestructiveAction === undefined
      ? undefined
      : validatePendingAction(value.pendingDestructiveAction);
  if (
    pendingDestructiveAction &&
    pendingDestructiveAction.checkpointSeq !== checkpointSeq
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Pending firmware action is not bound to the committed checkpoint',
    );
  }
  const userAttestation =
    value.userAttestation === undefined
      ? undefined
      : validateUserAttestation(value.userAttestation);
  const sanitizedError =
    value.sanitizedError === undefined
      ? undefined
      : validateSanitizedError(value.sanitizedError);
  const terminalTombstone =
    value.terminalTombstone === undefined
      ? undefined
      : validateTombstone(value.terminalTombstone);
  if (
    (TERMINAL_PHASES.has(phase) && !terminalTombstone) ||
    (terminalTombstone && terminalTombstone.state !== phase) ||
    (terminalTombstone && terminalTombstone.checkpointSeq !== checkpointSeq)
  ) {
    return fail(
      'INVALID_JOURNAL',
      'Firmware journal terminal phase and tombstone do not match',
    );
  }

  return {
    ...(value as IFirmwareUpdateJournalEnvelope),
    artifacts,
    ...(updatePlan ? { updatePlan } : {}),
    ...(preparedPlan ? { preparedPlan } : {}),
    ...(lastCommittedCheckpoint ? { lastCommittedCheckpoint } : {}),
    ...(pendingDestructiveAction ? { pendingDestructiveAction } : {}),
    ...(userAttestation ? { userAttestation } : {}),
    ...(sanitizedError ? { sanitizedError } : {}),
    ...(terminalTombstone ? { terminalTombstone } : {}),
  };
};

const cloneJournal = (
  value: IFirmwareUpdateJournalEnvelope,
): IFirmwareUpdateJournalEnvelope =>
  JSON.parse(JSON.stringify(value)) as IFirmwareUpdateJournalEnvelope;

const mergeJournalPatch = (
  current: IFirmwareUpdateJournalEnvelope,
  patch: IFirmwareUpdateJournalPatch,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...current, ...patch };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) {
      delete next[key];
    }
  });
  return next;
};

const assertImmutableField = (
  current: IFirmwareUpdateJournalEnvelope,
  next: IFirmwareUpdateJournalEnvelope,
  field: 'catalogEpoch' | 'manifestDigest' | 'planDigest' | 'planId',
) => {
  if (current[field] !== undefined && current[field] !== next[field]) {
    fail('INVALID_JOURNAL', `Firmware journal ${field} is immutable`);
  }
};

const assertJournalTransition = (
  current: IFirmwareUpdateJournalEnvelope,
  next: IFirmwareUpdateJournalEnvelope,
) => {
  if (current.terminalTombstone) {
    fail('TERMINAL_JOURNAL', 'Firmware journal is already terminal');
  }
  if (
    next.transactionId !== current.transactionId ||
    next.createdAt !== current.createdAt ||
    next.revision !== current.revision + 1 ||
    next.updatedAt <= current.updatedAt
  ) {
    fail('STALE_REVISION', 'Firmware journal revision or identity is stale');
  }
  ['planId', 'planDigest', 'manifestDigest', 'catalogEpoch'].forEach((field) =>
    assertImmutableField(
      current,
      next,
      field as 'catalogEpoch' | 'manifestDigest' | 'planDigest' | 'planId',
    ),
  );
  if (next.checkpointSeq < current.checkpointSeq) {
    fail(
      'CHECKPOINT_REGRESSION',
      'Firmware journal checkpoint sequence regressed',
    );
  }
  if (
    next.checkpointSeq === current.checkpointSeq &&
    next.lastCommittedCheckpoint?.timestampMs !==
      current.lastCommittedCheckpoint?.timestampMs
  ) {
    fail(
      'CHECKPOINT_REGRESSION',
      'Firmware journal checkpoint changed without a new sequence',
    );
  }
  if (current.preparedPlan && !next.preparedPlan) {
    fail('INVALID_JOURNAL', 'Firmware journal cannot discard PreparedPlan');
  }
  if (current.preparedPlan && next.updatePlan) {
    fail(
      'INVALID_JOURNAL',
      'Firmware journal cannot restore UpdatePlan after PREPARED',
    );
  }
};

const assertBackgroundRuntime = () => {
  if (
    !platformEnv.isJest &&
    (platformEnv.isWeb ||
      platformEnv.isExtension ||
      (platformEnv.isNative && platformEnv.isNativeMainThread))
  ) {
    fail(
      'RUNTIME_NOT_SUPPORTED',
      'Firmware update journal is available only in the background runtime',
    );
  }
};

const defaultLoadContractValidators =
  async (): Promise<IFirmwareUpdateJournalContractValidators> => {
    const sdk = await CoreSDKLoader();
    return {
      validateUpdatePlan: sdk.validateFirmwareUpdatePlan,
      validatePreparedPlan: sdk.validatePreparedPlan,
      validateCheckpoint: sdk.validateFirmwareCheckpoint,
    };
  };

export const sanitizeFirmwareUpdateJournalError = (
  error: unknown,
): IFirmwareUpdateJournalSanitizedError => {
  const value =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const sanitize = (text: string) =>
    text
      .replace(URL_REDACTION_PATTERN, '[redacted-url]')
      .replace(PATH_REDACTION_PATTERN, '[redacted-path]')
      .slice(0, 512);
  let errorMessage = 'Firmware update failed';
  if (typeof value.message === 'string') {
    errorMessage = value.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  const message = sanitize(errorMessage);
  const name = sanitize(
    typeof value.name === 'string' ? value.name : 'FirmwareUpdateError',
  ).slice(0, 128);
  const code =
    typeof value.code === 'string' || Number.isSafeInteger(value.code)
      ? (value.code as string | number)
      : undefined;
  return {
    name: name || 'FirmwareUpdateError',
    message: message || 'Firmware update failed',
    ...(code === undefined ? {} : { code }),
    ...(typeof value.retryable === 'boolean'
      ? { retryable: value.retryable }
      : {}),
  };
};

export class FirmwareUpdateJournal {
  private readonly dependencies: IFirmwareUpdateJournalDependencies;

  private validatorsPromise:
    | Promise<IFirmwareUpdateJournalContractValidators>
    | undefined;

  constructor(dependencies: Partial<IFirmwareUpdateJournalDependencies> = {}) {
    this.dependencies = {
      storage: firmwareUpdateJournalEntity,
      now: Date.now,
      loadContractValidators: defaultLoadContractValidators,
      ...dependencies,
    };
  }

  private loadValidators() {
    this.validatorsPromise ??= this.dependencies.loadContractValidators();
    return this.validatorsPromise;
  }

  private async validate(value: unknown) {
    return validateFirmwareUpdateJournalEnvelope({
      value,
      validators: await this.loadValidators(),
    });
  }

  async read(): Promise<IFirmwareUpdateJournalEnvelope | undefined> {
    assertBackgroundRuntime();
    let raw: unknown;
    try {
      raw = await this.dependencies.storage.getRawData();
    } catch {
      throw createJournalError(
        'STORAGE_FAILED',
        'Firmware journal could not be read from durable storage',
      );
    }
    if (raw === undefined || raw === null) return undefined;
    return cloneJournal(await this.validate(raw));
  }

  async create(
    input: IFirmwareUpdateJournalCreateInput,
  ): Promise<IFirmwareUpdateJournalEnvelope> {
    assertBackgroundRuntime();
    const timestamp = this.dependencies.now();
    let committed: IFirmwareUpdateJournalEnvelope | undefined;
    try {
      await this.dependencies.storage.setRawData(async (rawData: unknown) => {
        if (rawData !== undefined && rawData !== null) {
          await this.validate(rawData);
          return fail(
            'JOURNAL_ALREADY_EXISTS',
            'Firmware update journal already exists',
          );
        }
        committed = await this.validate({
          ...input,
          schemaVersion: FIRMWARE_UPDATE_JOURNAL_SCHEMA_VERSION,
          revision: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return cloneJournal(committed);
      });
    } catch (error) {
      if (isJournalError(error)) throw error;
      throw createJournalError(
        'STORAGE_FAILED',
        'Firmware journal create was not durably stored',
      );
    }
    if (!committed) {
      return fail('STORAGE_FAILED', 'Firmware journal create did not commit');
    }
    return cloneJournal(committed);
  }

  async commit({
    expectedRevision,
    patch,
  }: {
    expectedRevision: number;
    patch: IFirmwareUpdateJournalPatch;
  }): Promise<IFirmwareUpdateJournalEnvelope> {
    assertBackgroundRuntime();
    assertSafeInteger(expectedRevision, 'expectedRevision');
    let committed: IFirmwareUpdateJournalEnvelope | undefined;
    try {
      await this.dependencies.storage.setRawData(async (rawData: unknown) => {
        if (rawData === undefined || rawData === null) {
          return fail(
            'JOURNAL_NOT_FOUND',
            'Firmware update journal does not exist',
          );
        }
        const current = await this.validate(rawData);
        if (current.revision !== expectedRevision) {
          return fail(
            'STALE_REVISION',
            `Firmware journal expected revision ${expectedRevision}, current revision is ${current.revision}`,
          );
        }
        const now = this.dependencies.now();
        const next = await this.validate({
          ...mergeJournalPatch(current, patch),
          schemaVersion: FIRMWARE_UPDATE_JOURNAL_SCHEMA_VERSION,
          transactionId: current.transactionId,
          revision: current.revision + 1,
          createdAt: current.createdAt,
          updatedAt: Math.max(now, current.updatedAt + 1),
        });
        assertJournalTransition(current, next);
        committed = next;
        return cloneJournal(next);
      });
    } catch (error) {
      if (isJournalError(error)) throw error;
      throw createJournalError(
        'STORAGE_FAILED',
        'Firmware journal update was not durably stored',
      );
    }
    if (!committed) {
      return fail('STORAGE_FAILED', 'Firmware journal update did not commit');
    }
    return cloneJournal(committed);
  }

  async commitCheckpoint({
    expectedRevision,
    checkpoint,
    phase,
    pendingDestructiveAction,
  }: {
    expectedRevision: number;
    checkpoint: IFirmwareCheckpoint;
    phase?: EFirmwareUpdateCoordinatorPhase;
    pendingDestructiveAction?: IFirmwareUpdateJournalPendingAction;
  }) {
    return this.commit({
      expectedRevision,
      patch: {
        ...(phase ? { phase } : {}),
        checkpointSeq: checkpoint.sequence,
        lastCommittedCheckpoint: checkpoint,
        ...(pendingDestructiveAction
          ? { pendingDestructiveAction }
          : { pendingDestructiveAction: undefined }),
      },
    });
  }

  async markPrepared({
    expectedRevision,
    preparedPlan,
    artifacts,
    leaseRef,
  }: {
    expectedRevision: number;
    preparedPlan: IFirmwarePreparedPlan;
    artifacts: readonly IFirmwareUpdateJournalArtifact[];
    leaseRef: string;
  }) {
    return this.commit({
      expectedRevision,
      patch: {
        phase: 'PREPARED',
        updatePlan: undefined,
        preparedPlan,
        artifacts,
        leaseRef,
      },
    });
  }

  async markFailed({
    expectedRevision,
    error,
  }: {
    expectedRevision: number;
    error: unknown;
  }) {
    return this.markTerminal({
      expectedRevision,
      state: 'FAILED',
      leaseDisposition: 'retained',
      sanitizedError: sanitizeFirmwareUpdateJournalError(error),
    });
  }

  async markTerminal({
    expectedRevision,
    state,
    leaseDisposition,
    abandonSafety,
    cancelDisposition,
    sanitizedError,
  }: {
    expectedRevision: number;
    state: IFirmwareUpdateJournalTerminalTombstone['state'];
    leaseDisposition: IFirmwareUpdateJournalTerminalTombstone['leaseDisposition'];
    abandonSafety?: IFirmwareUpdateJournalTerminalTombstone['abandonSafety'];
    cancelDisposition?: IFirmwareUpdateJournalEnvelope['cancelDisposition'];
    sanitizedError?: IFirmwareUpdateJournalSanitizedError;
  }) {
    const current = await this.read();
    if (!current) {
      return fail(
        'JOURNAL_NOT_FOUND',
        'Firmware update journal does not exist',
      );
    }
    if (current.revision !== expectedRevision) {
      return fail(
        'STALE_REVISION',
        `Firmware journal expected revision ${expectedRevision}, current revision is ${current.revision}`,
      );
    }
    if (state === 'ABANDONED') {
      const destructiveCheckpoint =
        current.lastCommittedCheckpoint?.destructiveActionStarted === true ||
        current.pendingDestructiveAction !== undefined;
      if (
        !abandonSafety ||
        (destructiveCheckpoint && abandonSafety !== 'device-proven-safe')
      ) {
        return fail(
          'UNSAFE_ABANDON',
          'Firmware journal cannot be abandoned after a destructive checkpoint without device proof',
        );
      }
    }
    const expectedLeaseDispositions = {
      ABANDONED: ['safeAbandoned', 'safeCancelled'],
      COMPLETED: ['completed'],
      FAILED: ['retained'],
    }[
      state
    ] as readonly IFirmwareUpdateJournalTerminalTombstone['leaseDisposition'][];
    if (!expectedLeaseDispositions.includes(leaseDisposition)) {
      return fail(
        'INVALID_JOURNAL',
        `Firmware journal ${state} lease disposition is invalid`,
      );
    }
    if (state !== 'ABANDONED' && abandonSafety !== undefined) {
      return fail(
        'INVALID_JOURNAL',
        'Only an abandoned firmware journal accepts an abandon safety proof',
      );
    }
    const tombstone: IFirmwareUpdateJournalTerminalTombstone = {
      state,
      createdAt: this.dependencies.now(),
      checkpointSeq: current.checkpointSeq,
      leaseDisposition,
      ...(abandonSafety ? { abandonSafety } : {}),
    };
    return this.commit({
      expectedRevision,
      patch: {
        phase: state,
        ...(cancelDisposition ? { cancelDisposition } : {}),
        pendingDestructiveAction: undefined,
        terminalTombstone: tombstone,
        ...(sanitizedError ? { sanitizedError } : {}),
      },
    });
  }

  async clearTerminal(): Promise<void> {
    assertBackgroundRuntime();
    const current = await this.read();
    if (current && !current.terminalTombstone) {
      return fail(
        'TERMINAL_JOURNAL',
        'Active firmware journal cannot be cleared',
      );
    }
    try {
      await this.dependencies.storage.clearRawData();
    } catch {
      throw createJournalError(
        'STORAGE_FAILED',
        'Firmware journal could not be cleared from durable storage',
      );
    }
  }
}

export const firmwareUpdateJournal = new FirmwareUpdateJournal();
