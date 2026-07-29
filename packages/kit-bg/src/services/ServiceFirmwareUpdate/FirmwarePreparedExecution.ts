import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isDirectFirmwareHostBindingTransport } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import {
  getBridgeFirmwareV3BinaryParams,
  getBridgeFirmwareV4BinaryParams,
} from './FirmwareArtifactPreflight';

import type { IFirmwareArtifactReference } from './FirmwareArtifactPreflight';
import type { IFirmwareExecutionArtifacts } from './FirmwarePreparedArtifactController';
import type {
  CoreApi,
  FirmwareUpdatePreparedPlan,
  FirmwareUpdateV4Target,
} from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

type IFirmwarePlatform = 'native' | 'desktop' | 'ext' | 'web' | 'web-embed';

const FIRMWARE_UPDATE_V4_TARGETS = new Set<FirmwareUpdateV4Target>([
  'boot',
  'app_v1',
  'app_v2',
  'coprocessor',
  'resource',
  'se01',
  'se02',
  'se03',
  'se04',
]);

export const getFirmwareUpdateV4Targets = (
  targets: readonly string[],
): FirmwareUpdateV4Target[] => {
  const supported = targets.filter((target): target is FirmwareUpdateV4Target =>
    FIRMWARE_UPDATE_V4_TARGETS.has(target as FirmwareUpdateV4Target),
  );
  if (supported.length !== targets.length) {
    throw new OneKeyLocalError(
      'Protocol V2 firmware update plan contains an invalid target',
    );
  }
  return supported;
};

export const assertFirmwareUpdateV4Artifacts = (
  { preparedArtifacts }: IFirmwareExecutionArtifacts,
  transportType?: EHardwareTransportType,
): void => {
  const directDesktopExecution =
    platformEnv.isDesktop &&
    transportType !== undefined &&
    isDirectFirmwareHostBindingTransport(transportType);
  if ((platformEnv.isNative || directDesktopExecution) && !preparedArtifacts) {
    throw new OneKeyLocalError(
      'Protocol V2 firmware artifacts are not prepared',
    );
  }
};

const requireHostBindingGeneration = (
  preparedArtifacts: IFirmwareExecutionArtifacts['preparedArtifacts'],
  hostBindingGeneration: number | undefined,
): number => {
  if (!preparedArtifacts || !hostBindingGeneration) {
    throw new OneKeyLocalError('Firmware host binding is unavailable');
  }
  return hostBindingGeneration;
};

export const executePreparedFirmwareUpdateV2Bootloader = ({
  sdk,
  connectId,
  preparedArtifacts,
  bridgeBinaries,
  hostBindingGeneration,
  platform,
}: {
  sdk: CoreApi;
  connectId: string | undefined;
  platform: IFirmwarePlatform;
} & IFirmwareExecutionArtifacts) => {
  const artifact = preparedArtifacts?.selected.bootloader;
  if (preparedArtifacts) {
    if (!artifact) {
      throw new OneKeyLocalError('Prepared bootloader artifact is unavailable');
    }
    return (
      sdk.firmwareUpdateV2 as unknown as (
        id: string | undefined,
        params: {
          preparedPlan: FirmwareUpdatePreparedPlan;
          updateType: 'firmware';
          platform: string;
          isUpdateBootloader: true;
          artifact: IFirmwareArtifactReference;
          hostBindingGeneration: number;
        },
      ) => ReturnType<CoreApi['firmwareUpdateV2']>
    )(connectId, {
      preparedPlan: preparedArtifacts.preparedPlan,
      updateType: 'firmware',
      platform,
      isUpdateBootloader: true,
      artifact,
      hostBindingGeneration: requireHostBindingGeneration(
        preparedArtifacts,
        hostBindingGeneration,
      ),
    });
  }
  const bridgeBinary = bridgeBinaries?.targetBinaries.bootloader;
  if (bridgeBinary) {
    return (
      sdk.firmwareUpdateV2 as unknown as (
        id: string | undefined,
        params: {
          binary: ArrayBuffer;
          updateType: 'firmware';
          platform: string;
          isUpdateBootloader: true;
        },
      ) => ReturnType<CoreApi['firmwareUpdateV2']>
    )(connectId, {
      binary: bridgeBinary,
      updateType: 'firmware',
      platform,
      isUpdateBootloader: true,
    });
  }
  return sdk.firmwareUpdateV2(connectId, {
    updateType: 'firmware',
    platform,
    isUpdateBootloader: true,
  });
};

export const executePreparedDeviceUpdateBootloader = ({
  sdk,
  connectId,
  preparedArtifacts,
  bridgeBinaries,
  hostBindingGeneration,
}: {
  sdk: CoreApi;
  connectId: string;
} & IFirmwareExecutionArtifacts) => {
  const artifact = preparedArtifacts?.selected.bootloader;
  if (preparedArtifacts) {
    if (!artifact) {
      throw new OneKeyLocalError('Prepared bootloader artifact is unavailable');
    }
    return (
      sdk.deviceUpdateBootloader as unknown as (
        id: string,
        params: {
          preparedPlan: FirmwareUpdatePreparedPlan;
          artifact: IFirmwareArtifactReference;
          hostBindingGeneration: number;
        },
      ) => ReturnType<CoreApi['deviceUpdateBootloader']>
    )(connectId, {
      preparedPlan: preparedArtifacts.preparedPlan,
      artifact,
      hostBindingGeneration: requireHostBindingGeneration(
        preparedArtifacts,
        hostBindingGeneration,
      ),
    });
  }
  const bridgeBinary = bridgeBinaries?.targetBinaries.bootloader;
  return sdk.deviceUpdateBootloader(
    connectId,
    bridgeBinary ? { binary: bridgeBinary } : {},
  );
};

export const executePreparedFirmwareUpdateV2 = ({
  sdk,
  connectId,
  preparedArtifacts,
  bridgeBinaries,
  hostBindingGeneration,
  updateType,
  forcedUpdateRes,
  platform,
  firmwareType,
  version,
}: {
  sdk: CoreApi;
  connectId: string | undefined;
  updateType: 'firmware' | 'ble';
  forcedUpdateRes: boolean;
  platform: IFirmwarePlatform;
  firmwareType: EFirmwareType | undefined;
  version: number[];
} & IFirmwareExecutionArtifacts) => {
  const artifact =
    updateType === 'ble'
      ? preparedArtifacts?.selected.ble
      : preparedArtifacts?.selected.firmware;
  if (preparedArtifacts) {
    if (!artifact) {
      throw new OneKeyLocalError(
        `Prepared ${updateType} artifact is unavailable`,
      );
    }
    return (
      sdk.firmwareUpdateV2 as unknown as (
        id: string | undefined,
        params: {
          preparedPlan: FirmwareUpdatePreparedPlan;
          updateType: 'firmware' | 'ble';
          forcedUpdateRes: boolean;
          platform: string;
          firmwareType: EFirmwareType | undefined;
          artifact: IFirmwareArtifactReference;
          resourceEntries?: readonly {
            entryName: string;
            artifact: IFirmwareArtifactReference;
          }[];
          hostBindingGeneration: number;
        },
      ) => ReturnType<CoreApi['firmwareUpdateV2']>
    )(connectId, {
      preparedPlan: preparedArtifacts.preparedPlan,
      updateType,
      forcedUpdateRes:
        preparedArtifacts.plan.targetsToUpdate.includes('resource'),
      platform,
      firmwareType,
      artifact,
      ...(updateType === 'firmware' &&
      preparedArtifacts.selected.resourceEntries
        ? { resourceEntries: preparedArtifacts.selected.resourceEntries }
        : {}),
      hostBindingGeneration: requireHostBindingGeneration(
        preparedArtifacts,
        hostBindingGeneration,
      ),
    });
  }
  const bridgeBinary =
    bridgeBinaries?.targetBinaries[updateType === 'ble' ? 'ble' : 'firmware'];
  if (bridgeBinary) {
    return (
      sdk.firmwareUpdateV2 as unknown as (
        id: string | undefined,
        params: {
          binary: ArrayBuffer;
          updateType: 'firmware' | 'ble';
          forcedUpdateRes: boolean;
          platform: string;
          firmwareType: EFirmwareType | undefined;
        },
      ) => ReturnType<CoreApi['firmwareUpdateV2']>
    )(connectId, {
      binary: bridgeBinary,
      updateType,
      forcedUpdateRes,
      platform,
      firmwareType,
    });
  }
  return sdk.firmwareUpdateV2(connectId, {
    updateType,
    forcedUpdateRes,
    version,
    platform,
    firmwareType,
  });
};

export const executePreparedFirmwareUpdateV4 = ({
  sdk,
  connectId,
  preparedArtifacts,
  bridgeBinaries,
  hostBindingGeneration,
  platform,
  firmwareType,
  targetsToUpdate,
}: {
  sdk: CoreApi;
  connectId: string | undefined;
  platform: IFirmwarePlatform;
  firmwareType: EFirmwareType | undefined;
  targetsToUpdate: FirmwareUpdateV4Target[];
} & IFirmwareExecutionArtifacts) =>
  sdk.firmwareUpdateV4(connectId, {
    platform,
    firmwareType,
    targetsToUpdate,
    ...getBridgeFirmwareV4BinaryParams(bridgeBinaries),
    ...(preparedArtifacts
      ? {
          preparedPlan: preparedArtifacts.preparedPlan,
          expectedDeviceId: preparedArtifacts.plan.deviceIdentity,
          expectedTargetVersions: Object.fromEntries(
            preparedArtifacts.plan.artifacts.flatMap((artifact) =>
              artifact.targetVersion &&
              FIRMWARE_UPDATE_V4_TARGETS.has(
                artifact.target as FirmwareUpdateV4Target,
              )
                ? [
                    [
                      artifact.target as FirmwareUpdateV4Target,
                      artifact.targetVersion,
                    ] as const,
                  ]
                : [],
            ),
          ),
          componentArtifacts: preparedArtifacts.selected.componentArtifacts,
          resourceBundleArtifacts:
            preparedArtifacts.selected.resourceBundleArtifacts,
          hostBindingGeneration: requireHostBindingGeneration(
            preparedArtifacts,
            hostBindingGeneration,
          ),
        }
      : {}),
  });

export const executePreparedFirmwareUpdateV3 = ({
  sdk,
  connectId,
  preparedArtifacts,
  bridgeBinaries,
  hostBindingGeneration,
  platform,
  firmwareType,
  bleVersion,
  firmwareVersion,
  bootloaderVersion,
}: {
  sdk: CoreApi;
  connectId: string | undefined;
  platform: IFirmwarePlatform;
  firmwareType: EFirmwareType | undefined;
  bleVersion: number[] | undefined;
  firmwareVersion: number[] | undefined;
  bootloaderVersion: number[] | undefined;
} & IFirmwareExecutionArtifacts) => {
  if (preparedArtifacts) {
    return (
      sdk.firmwareUpdateV3 as unknown as (
        id: string | undefined,
        params: {
          preparedPlan: FirmwareUpdatePreparedPlan;
          platform: string;
          bleVersion: number[] | undefined;
          firmwareVersion: number[] | undefined;
          bootloaderVersion: number[] | undefined;
          firmwareType: EFirmwareType | undefined;
          hostBindingGeneration: number;
          artifacts: {
            ble?: IFirmwareArtifactReference;
            firmware?: IFirmwareArtifactReference;
            bootloader?: IFirmwareArtifactReference;
            resourceEntries?: readonly {
              entryName: string;
              artifact: IFirmwareArtifactReference;
            }[];
          };
        },
      ) => ReturnType<CoreApi['firmwareUpdateV3']>
    )(connectId, {
      preparedPlan: preparedArtifacts.preparedPlan,
      platform,
      bleVersion,
      firmwareVersion,
      bootloaderVersion,
      firmwareType,
      hostBindingGeneration: requireHostBindingGeneration(
        preparedArtifacts,
        hostBindingGeneration,
      ),
      artifacts: {
        ...(preparedArtifacts.selected.ble
          ? { ble: preparedArtifacts.selected.ble }
          : {}),
        ...(preparedArtifacts.selected.firmware
          ? { firmware: preparedArtifacts.selected.firmware }
          : {}),
        ...(preparedArtifacts.selected.bootloader
          ? { bootloader: preparedArtifacts.selected.bootloader }
          : {}),
        ...(preparedArtifacts.selected.resourceEntries
          ? { resourceEntries: preparedArtifacts.selected.resourceEntries }
          : {}),
      },
    });
  }
  return sdk.firmwareUpdateV3(connectId, {
    platform,
    bleVersion,
    firmwareVersion,
    bootloaderVersion,
    firmwareType,
    ...getBridgeFirmwareV3BinaryParams(bridgeBinaries),
  });
};
