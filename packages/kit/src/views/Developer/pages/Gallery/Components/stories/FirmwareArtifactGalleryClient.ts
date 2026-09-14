import type {
  IFirmwareArtifactSelfTestScenario,
  IFirmwareArtifactSelfTestState,
} from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/FirmwareArtifactSelfTest';
import type { IBackgroundMethodWithDevOnlyPassword } from '@onekeyhq/shared/src/background/backgroundDecorators';

type IFirmwareArtifactSelfTestService = {
  startFirmwareArtifactSelfTest(
    params: IBackgroundMethodWithDevOnlyPassword & {
      scenario: IFirmwareArtifactSelfTestScenario;
    },
  ): Promise<IFirmwareArtifactSelfTestState>;
  getFirmwareArtifactSelfTestState(
    params: IBackgroundMethodWithDevOnlyPassword,
  ): Promise<IFirmwareArtifactSelfTestState | undefined>;
};

export function createFirmwareArtifactGalleryClient(
  service: IFirmwareArtifactSelfTestService,
  devOnlyParams: IBackgroundMethodWithDevOnlyPassword,
) {
  return {
    start(scenario: IFirmwareArtifactSelfTestScenario) {
      return service.startFirmwareArtifactSelfTest({
        ...devOnlyParams,
        scenario,
      });
    },
    getState() {
      return service.getFirmwareArtifactSelfTestState(devOnlyParams);
    },
  };
}

export type IFirmwareArtifactGalleryClient = ReturnType<
  typeof createFirmwareArtifactGalleryClient
>;
