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
} from './FirmwareArtifactPreflight';
export {
  executeFirmwareArtifactSelfTest,
  getFirmwareArtifactSelfTestArtifact,
  getFirmwareArtifactSelfTestErrorCode,
  getFirmwareArtifactSelfTestPlatform,
} from './FirmwareArtifactSelfTest';
export { getTrustedFirmwareConfig } from './trustedFirmwareCatalog';

export const createFirmwareUpdateRuntimeHost = (
  dependencies: ConstructorParameters<
    typeof FirmwareArtifactSelfTestController
  >[0] &
    ConstructorParameters<typeof FirmwarePreparedArtifactController>[0],
) => ({
  selfTest: new FirmwareArtifactSelfTestController(dependencies),
  artifacts: new FirmwarePreparedArtifactController(dependencies),
});

export type IFirmwareUpdateRuntimeHost = ReturnType<
  typeof createFirmwareUpdateRuntimeHost
>;
