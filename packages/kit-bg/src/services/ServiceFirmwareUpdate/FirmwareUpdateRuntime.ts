import { FirmwareArtifactSelfTestController } from './FirmwareArtifactSelfTestController';
import { FirmwarePreparedArtifactController } from './FirmwarePreparedArtifactController';

export { firmwareArtifactAdapter } from './FirmwareArtifactAdapter';
export { FirmwareArtifactSelfTestController };
export { FirmwarePreparedArtifactController };
export {
  assertFirmwareUpdateV4Artifacts,
  executePreparedDeviceUpdateBootloader,
  executePreparedFirmwareUpdateV2,
  executePreparedFirmwareUpdateV2Bootloader,
  executePreparedFirmwareUpdateV3,
  executePreparedFirmwareUpdateV4,
  getFirmwareUpdateV4Targets,
} from './FirmwarePreparedExecution';
export {
  cancelFirmwareArtifactPreparations,
  getBridgeFirmwareV3BinaryParams,
  getBridgeFirmwareV4BinaryParams,
  isExternalFirmwareCapabilityReady,
  isFirmwareArtifactCapabilityReady,
  prepareBridgeFirmwareBinaries,
  prepareFirmwareArtifacts,
  resolveFirmwarePlanArtifact,
} from './FirmwareArtifactPreflight';
export {
  executeFirmwareArtifactSelfTest,
  getFirmwareArtifactSelfTestArtifact,
  getFirmwareArtifactSelfTestErrorCode,
  getFirmwareArtifactSelfTestPlatform,
} from './FirmwareArtifactSelfTest';
export { getFirmwareManifestSnapshot } from './FirmwareManifestProvider';

export const createFirmwareUpdateRuntimeHost = (
  dependencies: ConstructorParameters<
    typeof FirmwareArtifactSelfTestController
  >[0] &
    ConstructorParameters<typeof FirmwarePreparedArtifactController>[0],
) => {
  const artifacts = new FirmwarePreparedArtifactController(dependencies);
  return {
    selfTest: new FirmwareArtifactSelfTestController(dependencies, artifacts),
    artifacts,
  };
};

export type IFirmwareUpdateRuntimeHost = ReturnType<
  typeof createFirmwareUpdateRuntimeHost
>;
