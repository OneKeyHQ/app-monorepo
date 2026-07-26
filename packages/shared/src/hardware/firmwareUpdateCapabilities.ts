const EXPECTED_PLAN_SCHEMA_VERSION = 1;
const EXPECTED_PREPARED_PLAN_SCHEMA_VERSION = 1;
const EXPECTED_HOST_BINDING_PROTOCOL_VERSION = 1;
const EXPECTED_CHECKPOINT_SCHEMA_VERSION = 1;
const EXPECTED_ARTIFACT_PROTOCOL_VERSION = 1;
const EXPECTED_MAX_READ_BYTES = 256 * 1024;

const EXPECTED_MANIFEST_MODES = ['external-only', 'sdk-managed'] as const;
const EXPECTED_ARTIFACT_ROUTE_TYPES = ['domain', 'pinnedIp'] as const;

export type IFirmwareUpdateDeploymentTarget =
  | 'native'
  | 'desktop'
  | 'sdk-managed';

export type IFirmwareUpdateCapabilityFailure =
  | 'sdk_capabilities_unavailable'
  | 'sdk_capabilities_incompatible'
  | 'artifact_capabilities_unavailable'
  | 'artifact_capabilities_incompatible'
  | 'sdk_managed_platform';

export type IFirmwareUpdateCapabilityGate =
  | {
      ready: true;
      engine: 'transaction';
      planSchemaVersion: typeof EXPECTED_PLAN_SCHEMA_VERSION;
      preparedPlanSchemaVersion: typeof EXPECTED_PREPARED_PLAN_SCHEMA_VERSION;
      hostBindingProtocolVersion: typeof EXPECTED_HOST_BINDING_PROTOCOL_VERSION;
      checkpointSchemaVersion: typeof EXPECTED_CHECKPOINT_SCHEMA_VERSION;
      artifactProtocolVersion: typeof EXPECTED_ARTIFACT_PROTOCOL_VERSION;
      maxReadBytes: typeof EXPECTED_MAX_READ_BYTES;
    }
  | {
      ready: false;
      engine: 'legacy' | 'recovery_unsupported';
      failure: IFirmwareUpdateCapabilityFailure;
    };

type IFirmwareUpdateCapabilityGateInput = {
  deploymentTarget: IFirmwareUpdateDeploymentTarget;
  sdkCapabilities: unknown;
  artifactCapabilities?: unknown;
  hasActiveJournal: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
) => {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  );
};

const isExactStringTuple = (
  value: unknown,
  expected: readonly string[],
): boolean =>
  Array.isArray(value) &&
  value.length === expected.length &&
  value.every((entry, index) => entry === expected[index]);

const isExactStringSet = (
  value: unknown,
  expected: readonly string[],
): boolean =>
  Array.isArray(value) &&
  value.length === expected.length &&
  expected.every((entry) => value.includes(entry)) &&
  value.every((entry) => typeof entry === 'string' && expected.includes(entry));

const SDK_CAPABILITY_KEYS = [
  'planSchemaVersion',
  'preparedPlanSchemaVersion',
  'hostBindingProtocolVersion',
  'checkpointSchemaVersion',
  'manifestModes',
  'supportsArtifactReader',
  'supportsAwaitableCheckpoint',
  'supportsResume',
  'supportsReconciliation',
] as const;

const ARTIFACT_CAPABILITY_KEYS = [
  'firmwareArtifactProtocolVersion',
  'supportedRouteTypes',
  'supportsArchiveMaterialization',
  'maxReadBytes',
] as const;

export const isCompatibleFirmwareSdkCapabilities = (
  value: unknown,
): boolean => {
  if (!isRecord(value) || !hasExactKeys(value, SDK_CAPABILITY_KEYS)) {
    return false;
  }

  return (
    value.planSchemaVersion === EXPECTED_PLAN_SCHEMA_VERSION &&
    value.preparedPlanSchemaVersion === EXPECTED_PREPARED_PLAN_SCHEMA_VERSION &&
    value.hostBindingProtocolVersion ===
      EXPECTED_HOST_BINDING_PROTOCOL_VERSION &&
    value.checkpointSchemaVersion === EXPECTED_CHECKPOINT_SCHEMA_VERSION &&
    isExactStringTuple(value.manifestModes, EXPECTED_MANIFEST_MODES) &&
    value.supportsArtifactReader === true &&
    value.supportsAwaitableCheckpoint === true &&
    value.supportsResume === true &&
    value.supportsReconciliation === true
  );
};

export const isCompatibleFirmwareArtifactCapabilities = (
  value: unknown,
): boolean => {
  if (!isRecord(value) || !hasExactKeys(value, ARTIFACT_CAPABILITY_KEYS)) {
    return false;
  }

  return (
    value.firmwareArtifactProtocolVersion ===
      EXPECTED_ARTIFACT_PROTOCOL_VERSION &&
    isExactStringSet(
      value.supportedRouteTypes,
      EXPECTED_ARTIFACT_ROUTE_TYPES,
    ) &&
    value.supportsArchiveMaterialization === true &&
    value.maxReadBytes === EXPECTED_MAX_READ_BYTES
  );
};

const createUnsupportedGate = ({
  failure,
  hasActiveJournal,
}: {
  failure: IFirmwareUpdateCapabilityFailure;
  hasActiveJournal: boolean;
}): IFirmwareUpdateCapabilityGate => ({
  ready: false,
  engine: hasActiveJournal ? 'recovery_unsupported' : 'legacy',
  failure,
});

export const getFirmwareUpdateCapabilityGate = ({
  deploymentTarget,
  sdkCapabilities,
  artifactCapabilities,
  hasActiveJournal,
}: IFirmwareUpdateCapabilityGateInput): IFirmwareUpdateCapabilityGate => {
  if (deploymentTarget === 'sdk-managed') {
    return createUnsupportedGate({
      failure: 'sdk_managed_platform',
      hasActiveJournal,
    });
  }

  if (sdkCapabilities === undefined || sdkCapabilities === null) {
    return createUnsupportedGate({
      failure: 'sdk_capabilities_unavailable',
      hasActiveJournal,
    });
  }

  if (!isCompatibleFirmwareSdkCapabilities(sdkCapabilities)) {
    return createUnsupportedGate({
      failure: 'sdk_capabilities_incompatible',
      hasActiveJournal,
    });
  }

  if (artifactCapabilities === undefined || artifactCapabilities === null) {
    return createUnsupportedGate({
      failure: 'artifact_capabilities_unavailable',
      hasActiveJournal,
    });
  }

  if (!isCompatibleFirmwareArtifactCapabilities(artifactCapabilities)) {
    return createUnsupportedGate({
      failure: 'artifact_capabilities_incompatible',
      hasActiveJournal,
    });
  }

  return {
    ready: true,
    engine: 'transaction',
    planSchemaVersion: EXPECTED_PLAN_SCHEMA_VERSION,
    preparedPlanSchemaVersion: EXPECTED_PREPARED_PLAN_SCHEMA_VERSION,
    hostBindingProtocolVersion: EXPECTED_HOST_BINDING_PROTOCOL_VERSION,
    checkpointSchemaVersion: EXPECTED_CHECKPOINT_SCHEMA_VERSION,
    artifactProtocolVersion: EXPECTED_ARTIFACT_PROTOCOL_VERSION,
    maxReadBytes: EXPECTED_MAX_READ_BYTES,
  };
};

export const firmwareUpdateCapabilityVersions = Object.freeze({
  planSchemaVersion: EXPECTED_PLAN_SCHEMA_VERSION,
  preparedPlanSchemaVersion: EXPECTED_PREPARED_PLAN_SCHEMA_VERSION,
  hostBindingProtocolVersion: EXPECTED_HOST_BINDING_PROTOCOL_VERSION,
  checkpointSchemaVersion: EXPECTED_CHECKPOINT_SCHEMA_VERSION,
  artifactProtocolVersion: EXPECTED_ARTIFACT_PROTOCOL_VERSION,
  maxReadBytes: EXPECTED_MAX_READ_BYTES,
});
