import {
  firmwareUpdateCapabilityVersions,
  getFirmwareUpdateCapabilityGate,
  isCompatibleFirmwareArtifactCapabilities,
  isCompatibleFirmwareSdkCapabilities,
} from './firmwareUpdateCapabilities';

const sdkCapabilities = {
  planSchemaVersion: 1,
  preparedPlanSchemaVersion: 1,
  hostBindingProtocolVersion: 1,
  checkpointSchemaVersion: 1,
  manifestModes: ['external-only', 'sdk-managed'],
  supportsArtifactReader: true,
  supportsAwaitableCheckpoint: true,
  supportsResume: true,
  supportsReconciliation: true,
};

const artifactCapabilities = {
  firmwareArtifactProtocolVersion: 1,
  supportedRouteTypes: ['domain', 'pinnedIp'],
  supportsArchiveMaterialization: true,
  maxReadBytes: 256 * 1024,
};

describe('firmwareUpdateCapabilities', () => {
  it('enables the transaction engine only when every protocol matches', () => {
    expect(
      getFirmwareUpdateCapabilityGate({
        deploymentTarget: 'native',
        sdkCapabilities,
        artifactCapabilities,
        hasActiveJournal: false,
      }),
    ).toEqual({
      ready: true,
      engine: 'transaction',
      ...firmwareUpdateCapabilityVersions,
    });
  });

  it.each([
    ['planSchemaVersion', 2],
    ['preparedPlanSchemaVersion', 2],
    ['hostBindingProtocolVersion', 2],
    ['checkpointSchemaVersion', 2],
    ['supportsArtifactReader', false],
    ['supportsAwaitableCheckpoint', false],
    ['supportsResume', false],
    ['supportsReconciliation', false],
  ] as const)('rejects an incompatible SDK %s', (key, value) => {
    expect(
      isCompatibleFirmwareSdkCapabilities({
        ...sdkCapabilities,
        [key]: value,
      }),
    ).toBe(false);
  });

  it('rejects reordered, missing, or extended SDK manifest modes', () => {
    expect(
      isCompatibleFirmwareSdkCapabilities({
        ...sdkCapabilities,
        manifestModes: ['sdk-managed', 'external-only'],
      }),
    ).toBe(false);
    expect(
      isCompatibleFirmwareSdkCapabilities({
        ...sdkCapabilities,
        manifestModes: ['external-only'],
      }),
    ).toBe(false);
    expect(
      isCompatibleFirmwareSdkCapabilities({
        ...sdkCapabilities,
        manifestModes: ['external-only', 'sdk-managed', 'future-mode'],
      }),
    ).toBe(false);
  });

  it('rejects unknown SDK capability fields to prevent partial version mixing', () => {
    expect(
      isCompatibleFirmwareSdkCapabilities({
        ...sdkCapabilities,
        futureCapability: true,
      }),
    ).toBe(false);
  });

  it.each([
    ['firmwareArtifactProtocolVersion', 2],
    ['supportedRouteTypes', ['domain']],
    ['supportedRouteTypes', ['domain', 'pinnedIp', 'future-route']],
    ['supportsArchiveMaterialization', false],
    ['maxReadBytes', 512 * 1024],
  ] as const)('rejects an incompatible Artifact %s', (key, value) => {
    expect(
      isCompatibleFirmwareArtifactCapabilities({
        ...artifactCapabilities,
        [key]: value,
      }),
    ).toBe(false);
  });

  it('accepts the native route set independent of ordering', () => {
    expect(
      isCompatibleFirmwareArtifactCapabilities({
        ...artifactCapabilities,
        supportedRouteTypes: ['pinnedIp', 'domain'],
      }),
    ).toBe(true);
  });

  it('falls back to the complete legacy engine when no journal is active', () => {
    expect(
      getFirmwareUpdateCapabilityGate({
        deploymentTarget: 'desktop',
        sdkCapabilities: undefined,
        artifactCapabilities,
        hasActiveJournal: false,
      }),
    ).toEqual({
      ready: false,
      engine: 'legacy',
      failure: 'sdk_capabilities_unavailable',
    });
  });

  it('preserves an active journal when a capability is missing', () => {
    expect(
      getFirmwareUpdateCapabilityGate({
        deploymentTarget: 'native',
        sdkCapabilities,
        artifactCapabilities: undefined,
        hasActiveJournal: true,
      }),
    ).toEqual({
      ready: false,
      engine: 'recovery_unsupported',
      failure: 'artifact_capabilities_unavailable',
    });
  });

  it('keeps Web and Extension on the SDK-managed legacy engine', () => {
    expect(
      getFirmwareUpdateCapabilityGate({
        deploymentTarget: 'sdk-managed',
        sdkCapabilities,
        artifactCapabilities,
        hasActiveJournal: false,
      }),
    ).toEqual({
      ready: false,
      engine: 'legacy',
      failure: 'sdk_managed_platform',
    });
  });
});
