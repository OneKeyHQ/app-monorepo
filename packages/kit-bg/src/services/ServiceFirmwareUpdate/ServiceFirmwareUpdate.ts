import {
  EDeviceType,
  type EFirmwareType,
  HardwareErrorCode,
} from '@onekeyfe/hd-shared';
import { get, isArray, isNil } from 'lodash';
import semver from 'semver';

import {
  type IBackgroundMethodWithDevOnlyPassword,
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  BridgeTimeoutError,
  FirmwareUpdateBatteryTooLow,
  FirmwareUpdateExit,
  FirmwareUpdateTasksClear,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedFirmwareUpgradeFromWeb,
  NeedOneKeyBridgeUpgrade,
  OneKeyLocalError,
  UseDesktopToUpdateFirmware,
} from '@onekeyhq/shared/src/errors';
import { FirmwareUpdateVersionMismatchError } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceResponse,
  isHardwareErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  classifyFirmwareUpdateFailure,
  resolveFirmwareUpdateErrorCode,
  toUserFacingFirmwareUpdateError,
} from '@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS } from '@onekeyhq/shared/src/hardware/connectionTimeouts';
import { projectLegacyDeviceFeaturesFromState } from '@onekeyhq/shared/src/hardware/deviceStateUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { parseFirmwareVersions } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type {
  IAllDeviceVerifyVersions,
  IBleFirmwareReleasePayload,
  IBleFirmwareUpdateInfo,
  IBootloaderReleasePayload,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IDeviceFirmwareType,
  IFirmwareChangeLog,
  IFirmwareReleasePayload,
  IFirmwareUpdateDetectStatusSnapshot,
  IFirmwareUpdateInfo,
  IFirmwareUpdateV3VersionParams,
  IHardwareBridgeReleasePayload,
  IOneKeyDeviceFeatures,
  IPro2FirmwareUpdateTarget,
  IProtocolV2FirmwareVersionInfo,
  IResourceUpdateInfo,
} from '@onekeyhq/shared/types/device';
import {
  EHardwareCallContext,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  EFirmwareUpdateSteps,
  EHardwareUiStateAction,
  firmwareUpdateResultVerifyAtom,
  firmwareUpdateRetryAtom,
  firmwareUpdateStepInfoAtom,
  firmwareUpdateWorkflowRunningAtom,
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import serviceHardwareUtils from '../ServiceHardware/serviceHardwareUtils';

import {
  FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
  FIRMWARE_UPDATE_MIN_BATTERY_LEVEL,
  FIRMWARE_UPDATE_MIN_VERSION_ALLOWED,
} from './firmwareUpdateConsts';
import { FirmwareUpdateDetectMap } from './FirmwareUpdateDetectMap';
import { firmwareUpdateTrace } from './FirmwareUpdateTrace';

import type {
  IFirmwareArtifactSelfTestScenario,
  IFirmwareArtifactSelfTestState,
} from './FirmwareArtifactSelfTest';
import type {
  IFirmwareExecutionArtifacts,
  IFirmwareWorkflowArtifacts,
} from './FirmwarePreparedArtifactController';
import type { IFirmwareUpdateRuntimeHost } from './FirmwareUpdateRuntime';
import type { IFirmwareUpdateTraceInputMode } from './FirmwareUpdateTrace';
import type { IDBDevice } from '../../dbs/local/types';
import type {
  IPromiseContainerCallbackCreate,
  IPromiseContainerReject,
  IPromiseContainerResolve,
} from '../ServicePromise';
import type {
  AllFirmwareRelease,
  CoreApi,
  Success as CoreSuccess,
  DeviceSuccess,
  DeviceUploadResourceParams,
  FirmwareUpdatePlanForceTarget,
  FirmwareUpdateV4Target,
  IDeviceType,
  IVersionArray,
} from '@onekeyfe/hd-core';
import type { Success } from '@onekeyfe/hd-transport';

let firmwareUpdateRuntimeModulePromise:
  | Promise<typeof import('./FirmwareUpdateRuntime')>
  | undefined;

const loadFirmwareUpdateRuntime = () =>
  (firmwareUpdateRuntimeModulePromise ??= import('./FirmwareUpdateRuntime'));

export type IAutoUpdateFirmwareParams = {
  connectId: string | undefined;
  version: string;
  firmwareType: IDeviceFirmwareType;
  deviceType: IDeviceType | undefined;
};

export type IUpdateFirmwareWorkflowParams = {
  backuped: boolean;
  usbConnected: boolean;
  releaseResult: ICheckAllFirmwareReleaseResult;
};

export type IStartUpdateWorkflowV2Result = {
  backgroundTaskStarted: true;
};

export type IDetectActiveAccountFirmwareUpdatesResult =
  | {
      status: 'busy' | 'failed' | 'throttled';
      retryAfterMs: number;
    }
  | {
      status: 'finished' | 'skipped';
    };

const FIRMWARE_UPDATE_DETECT_BUSY_RETRY_DELAY = timerUtils.getTimeDurationMs({
  seconds: 5,
});

const PRO2_APP_FIRMWARE_UPDATE_TARGETS = new Set<IPro2FirmwareUpdateTarget>([
  'app_v1',
  'app_v2',
]);

const PROTOCOL_V2_SAFE_OS_TARGETS = new Set<IPro2FirmwareUpdateTarget>([
  'app_v1',
  'app_v2',
]);

export function buildPro2TargetsToUpdate({
  sdkTargets,
  forceTargets = [],
}: {
  sdkTargets: readonly FirmwareUpdateV4Target[] | undefined;
  forceTargets?: readonly IPro2FirmwareUpdateTarget[];
}) {
  return Array.from(
    new Set<IPro2FirmwareUpdateTarget>([
      ...(sdkTargets ?? []).map((target) =>
        target === 'boot_resources' ? 'resource' : target,
      ),
      ...forceTargets,
    ]),
  );
}

export function buildProtocolV2PlanForceTargets({
  forceTargets = [],
  forceOnceTargets = [],
}: {
  forceTargets?: readonly IPro2FirmwareUpdateTarget[];
  forceOnceTargets?: readonly IPro2FirmwareUpdateTarget[];
}) {
  return buildPro2TargetsToUpdate({
    sdkTargets: [],
    forceTargets: [...forceTargets, ...forceOnceTargets],
  });
}

export function shouldForceProtocolV2ResourceUpdate({
  targetsToUpdate,
  legacyForceResource,
  forceTargets = [],
  forceOnceTargets = [],
}: {
  targetsToUpdate: readonly FirmwareUpdateV4Target[];
  legacyForceResource?: boolean;
  forceTargets?: readonly IPro2FirmwareUpdateTarget[];
  forceOnceTargets?: readonly IPro2FirmwareUpdateTarget[];
}) {
  return (
    targetsToUpdate.some(
      (target) => target === 'resource' || target === 'boot_resources',
    ) &&
    (legacyForceResource === true ||
      forceTargets.includes('resource') ||
      forceOnceTargets.includes('resource'))
  );
}

export function buildProtocolV2FirmwareVersionInfo({
  releaseInfo,
  targetsToUpdate,
}: {
  releaseInfo: Pick<
    AllFirmwareRelease,
    'components' | 'currentVersions' | 'release'
  >;
  targetsToUpdate: readonly IPro2FirmwareUpdateTarget[];
}): IProtocolV2FirmwareVersionInfo {
  const selectedComponentTargets = targetsToUpdate.filter(
    (target): target is Exclude<IPro2FirmwareUpdateTarget, 'resource'> =>
      target !== 'resource',
  );
  const components = selectedComponentTargets.map((target) => {
    const component = releaseInfo.components?.find(
      (item) => item.updateTarget === target,
    );
    return {
      target,
      currentVersion: component?.currentVersion ?? null,
      targetVersion: component?.targetVersion ?? null,
    };
  });
  const hasSafeOSUpdate = targetsToUpdate.some((target) =>
    PROTOCOL_V2_SAFE_OS_TARGETS.has(target),
  );
  const safeOSComponentTargetVersion = components.find(
    (component) =>
      component.target === 'app_v1' || component.target === 'app_v2',
  )?.targetVersion;

  return {
    safeOS: {
      currentVersion:
        releaseInfo.currentVersions?.firmware ??
        releaseInfo.currentVersions?.applicationP1 ??
        null,
      targetVersion: hasSafeOSUpdate
        ? (releaseInfo.release?.version?.join('.') ??
          safeOSComponentTargetVersion ??
          null)
        : null,
    },
    components,
  };
}

export function supportsFirmwareUpdateWorkflowV2(
  deviceType: IDeviceType | string | null | undefined,
): boolean {
  // Workflow V2 is the app's second-generation update flow, not the device's Protocol V2.
  // Pro uses this flow, while Protocol V2 devices such as Pro2 and Neo enter through it too.
  return deviceType === EDeviceType.Pro || isProtocolV2ProductType(deviceType);
}

export type IUpdateFirmwareTaskFn = ({
  id,
}: {
  id: number;
}) => Promise<DeviceSuccess | undefined>; // return DeviceSuccess | undefined go to next task, throw error to retry

type IUpdateFirmwareTask = {
  fn: IUpdateFirmwareTaskFn;
  workflowId: number | undefined;
};

interface IFirmwareUpdateResult {
  bleVersion?: string;
  firmwareVersion?: string;
  bootloaderVersion?: string;
}

type IFirmwareUpdateV4AppParams = IFirmwareUpdateV3VersionParams & {
  requirePreparedArtifacts: boolean;
  targetsToUpdate: FirmwareUpdateV4Target[];
};

@backgroundClass()
class ServiceFirmwareUpdate extends ServiceBase {
  private firmwareUpdateRuntimeHost?: Promise<IFirmwareUpdateRuntimeHost>;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private async getActiveTransportType(): Promise<EHardwareTransportType> {
    const serviceHardware = this.backgroundApi.serviceHardware;
    if (typeof serviceHardware?.getCurrentTransportType === 'function') {
      return serviceHardware.getCurrentTransportType();
    }
    return this.backgroundApi.serviceSetting.getHardwareTransportType();
  }

  private getFirmwareUpdateRuntimeHost(): Promise<IFirmwareUpdateRuntimeHost> {
    return (this.firmwareUpdateRuntimeHost ??= loadFirmwareUpdateRuntime().then(
      ({ createFirmwareUpdateRuntimeHost }) =>
        createFirmwareUpdateRuntimeHost({
          getHardwareTransportType: () => this.getActiveTransportType(),
          getSDKInstance: (connectId?: string) =>
            this.getSDKInstance({ connectId }),
        }),
    ));
  }

  @backgroundMethodForDev()
  startFirmwareArtifactSelfTest({
    scenario,
  }: IBackgroundMethodWithDevOnlyPassword & {
    scenario: IFirmwareArtifactSelfTestScenario;
  }): Promise<IFirmwareArtifactSelfTestState> {
    return this.getFirmwareUpdateRuntimeHost().then((runtime) =>
      runtime.selfTest.start(scenario),
    );
  }

  @backgroundMethodForDev()
  getFirmwareArtifactSelfTestState(
    _params: IBackgroundMethodWithDevOnlyPassword,
  ): Promise<IFirmwareArtifactSelfTestState | undefined> {
    return Promise.resolve(this.firmwareUpdateRuntimeHost).then((runtime) =>
      runtime?.selfTest.getState(),
    );
  }

  getSDKInstance({
    connectId,
    hardwareTransportType,
    forceFirmwareManifestRefresh,
  }: {
    connectId: string | undefined;
    hardwareTransportType?: EHardwareTransportType;
    forceFirmwareManifestRefresh?: boolean;
  }): Promise<CoreApi> {
    return this.backgroundApi.serviceHardware.getSDKInstance({
      connectId,
      hardwareTransportType,
      ...(forceFirmwareManifestRefresh
        ? { forceFirmwareManifestRefresh: true }
        : {}),
    });
  }

  clearOnceUpdateDevSettings(): Promise<void> {
    return this.backgroundApi.serviceDevSetting.updateFirmwareUpdateDevSettings(
      {
        forceUpdateOnceFirmware: false,
        forceUpdateOnceBle: false,
        forceUpdateOnceBootloader: false,
        pro2ForceUpdateOnceTargets: [],
      },
    );
  }

  @backgroundMethod()
  async rebootToBootloader(connectId: string): Promise<boolean> {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUpdateReboot(connectId),
    );
  }

  @backgroundMethod()
  async rebootToBoardloader(connectId: string): Promise<DeviceSuccess> {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceRebootToBoardloader(connectId),
    );
  }

  async checkDeviceIsBootloaderMode({
    connectId,
    allowEmptyConnectId,
    forceProtocolDetection,
    hardwareTransportType,
  }: {
    connectId: string | undefined;
    allowEmptyConnectId?: boolean | undefined;
    forceProtocolDetection?: boolean;
    hardwareTransportType?: EHardwareTransportType;
  }) {
    let features: IOneKeyDeviceFeatures | undefined;
    let error: IOneKeyError | undefined;
    let isBootloaderMode = false;
    try {
      const state = await this.backgroundApi.serviceHardware.getDeviceState({
        connectId,
        params: {
          scope: 'firmware',
          retryCount: 0, // don't retry, just checking once
          // do not prompt web device permission
          skipWebDevicePrompt: true,
          allowEmptyConnectId,
          forceProtocolDetection,
          ...(forceProtocolDetection
            ? { timeout: DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS }
            : {}),
        },
        silentMode: true,
        hardwareTransportType,
      });
      features = projectLegacyDeviceFeaturesFromState(state);
      isBootloaderMode = await deviceUtils.isBootloaderModeByFeatures({
        features,
      });
    } catch (e) {
      if (
        isHardwareErrorByCode({
          error: e as any,
          code: HardwareErrorCode.DeviceDetectInBootloaderMode,
        })
      ) {
        isBootloaderMode = true;
      } else {
        error = e as any;
      }
    }
    return {
      isBootloaderMode,
      features,
      error,
    };
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUploadResource(connectId, params),
    );
  }

  detectMap = new FirmwareUpdateDetectMap({
    backgroundApi: this.backgroundApi,
  });

  private async getFirmwareUpdateDetectIdentity(connectId: string) {
    const dbDevice = await localDb
      .getDeviceByQuery({ connectId })
      .catch(() => undefined);
    return {
      connectId: dbDevice?.connectId || connectId,
      usbConnectId: dbDevice?.usbConnectId,
      bleConnectId: dbDevice?.bleConnectId,
    };
  }

  private async deleteFirmwareUpdateDetectInfo(connectId: string) {
    const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
    await this.detectMap.deleteUpdateInfo(identity);
  }

  @backgroundMethod()
  async resetShouldDetectTimeCheck({ connectId }: { connectId: string }) {
    const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
    this.detectMap.resetLastDetectAt({ connectId: identity.connectId });
  }

  @backgroundMethod()
  async showAutoUpdateCheckDebugToast(message: string) {
    void this.backgroundApi.serviceDevSetting
      .getFirmwareUpdateDevSettings('showAutoCheckHardwareUpdatesToast')
      .then((result) => {
        if (!result) return;

        void this.backgroundApi.serviceApp.showToast({
          method: 'message',
          title: message,
        });
      })
      .catch(() => {
        // ignore
      });
  }

  /**
   * Defer device update checks
   * @param connectId device connectId
   */
  @backgroundMethod()
  async delayShouldDetectTimeCheck({ connectId }: { connectId: string }) {
    const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
    this.detectMap.updateLastDetectAt({ connectId: identity.connectId });

    void this.showAutoUpdateCheckDebugToast('推迟硬件自动更新检测');
  }

  @backgroundMethod()
  async delayShouldDetectTimeCheckWithDelay({
    connectId,
    delay,
  }: {
    connectId: string;
    delay: number;
  }) {
    const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
    this.detectMap.updateLastDetectAtWithDelay({
      connectId: identity.connectId,
      delay,
    });
    void this.showAutoUpdateCheckDebugToast('暂停硬件自动更新检测');
  }

  @backgroundMethod()
  async getFirmwareUpdateDetectInfo({ connectId }: { connectId: string }) {
    const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
    return this.detectMap.detectMapCache[identity.connectId];
  }

  @backgroundMethod()
  async getFirmwareUpdateDetectStatus({ connectId }: { connectId: string }) {
    const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
    return {
      ...this.detectMap.getDetectStatus({ connectId: identity.connectId }),
      requestedConnectId: connectId,
    };
  }

  @backgroundMethod()
  async getFirmwareUpdateDetectStatuses({
    connectIds,
  }: {
    connectIds: string[];
  }): Promise<Record<string, IFirmwareUpdateDetectStatusSnapshot>> {
    const entries = await Promise.all(
      connectIds.map(async (connectId) => {
        const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
        return [
          connectId,
          {
            ...this.detectMap.getDetectStatus({
              connectId: identity.connectId,
            }),
            requestedConnectId: connectId,
          },
        ] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  @backgroundMethod()
  async clearFirmwareUpdateDetectStatusCache() {
    await this.detectMap.clear();
  }

  // TODO sdk not ready yet(slow network test)
  // TODO check firmware update from hidden wallet
  // TODO check firmware update from onboarding
  @backgroundMethod()
  async detectActiveAccountFirmwareUpdates({
    connectId,
  }: {
    connectId: string;
  }): Promise<IDetectActiveAccountFirmwareUpdatesResult> {
    // detect certain account device firmware update, so connectId is required
    if (!connectId) {
      return { status: 'skipped' };
    }
    const dbDevice = await localDb.getDeviceByQuery({ connectId });
    const vendorProfile = dbDevice?.vendor
      ? getVendorProfile(dbDevice.vendor)
      : undefined;
    if (vendorProfile?.isThirdParty) {
      return { status: 'skipped' };
    }
    const detectIdentity = {
      connectId: dbDevice?.connectId || connectId,
      usbConnectId: dbDevice?.usbConnectId,
      bleConnectId: dbDevice?.bleConnectId,
    };
    const detectConnectId = detectIdentity.connectId;
    const exclusiveResult = await this.backgroundApi.serviceHardwareUI
      .tryRunExclusiveOneKeyOperation(
        async (): Promise<IDetectActiveAccountFirmwareUpdatesResult> => {
          const showBootloaderUpdateModal = () => {
            appEventBus.emit(
              EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode,
              {
                connectId,
              },
            );
          };
          if (!this.detectMap.shouldDetect({ connectId: detectConnectId })) {
            return {
              status: 'throttled',
              retryAfterMs: Math.max(
                1,
                this.detectMap.getNextDetectDelay({
                  connectId: detectConnectId,
                }),
              ),
            };
          }
          const compatibleConnectId =
            await this.backgroundApi.serviceHardware.getCompatibleConnectId({
              hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
              connectId,
            });

          const { isBootloaderMode, features, error } =
            await this.checkDeviceIsBootloaderMode({
              connectId: compatibleConnectId || connectId,
            });

          serviceHardwareUtils.hardwareLog(
            'checkFirmwareUpdateStatus',
            features,
          );

          if (error) {
            if (
              isHardwareErrorByCode({
                error,
                code: [HardwareErrorCode.DeviceNotFound],
              })
            ) {
              return {
                status: 'failed',
                retryAfterMs: FIRMWARE_UPDATE_DETECT_BUSY_RETRY_DELAY,
              };
            }
            throw error;
          }

          if (isBootloaderMode) {
            showBootloaderUpdateModal();
            this.detectMap.updateLastDetectAt({
              connectId: detectConnectId,
            });
          } else if (features) {
            const firmwareType = await deviceUtils.getFirmwareType({
              features,
            });
            const releaseInfo = await this.baseCheckAllFirmwareRelease({
              connectId: compatibleConnectId || connectId,
              firmwareType,
              skipChangeTransportType: true,
              retryCount: 0,
              silentMode: true,
              forceFirmwareManifestRefresh: false,
            });
            const firmware = await this.checkFirmwareRelease({
              connectId: compatibleConnectId || connectId,
              features,
              firmwareReleasePayload:
                releaseInfo.firmware as unknown as IFirmwareReleasePayload,
              saveUpdateInfo: false,
            });
            const ble = await this.checkBLEFirmwareRelease({
              connectId: compatibleConnectId || connectId,
              features,
              bleReleasePayload:
                releaseInfo.ble as unknown as IBleFirmwareReleasePayload,
              currentVersion: releaseInfo.currentVersions?.ble,
              saveUpdateInfo: false,
            });
            const targetsToUpdate = buildPro2TargetsToUpdate({
              sdkTargets: releaseInfo.targetsToUpdate,
            });
            await this.detectMap.resolveUpdateInfo({
              ...detectIdentity,
              firmware,
              ble,
              targetsToUpdate,
            });
            this.detectMap.updateLastDetectAt({
              connectId: detectConnectId,
            });
          } else {
            return {
              status: 'failed',
              retryAfterMs: FIRMWARE_UPDATE_DETECT_BUSY_RETRY_DELAY,
            };
          }
          return { status: 'finished' };
        },
        {
          deviceKey:
            dbDevice?.id || dbDevice?.deviceId || dbDevice?.uuid || connectId,
        },
      )
      .catch((error: unknown) => {
        serviceHardwareUtils.hardwareLog(
          'detectActiveAccountFirmwareUpdates failed',
          error,
        );
        return undefined;
      });
    if (!exclusiveResult) {
      return {
        status: 'failed',
        retryAfterMs: FIRMWARE_UPDATE_DETECT_BUSY_RETRY_DELAY,
      };
    }
    if (!exclusiveResult.acquired) {
      return {
        status: 'busy',
        retryAfterMs: FIRMWARE_UPDATE_DETECT_BUSY_RETRY_DELAY,
      };
    }
    return exclusiveResult.result;
  }

  private _checkCacheMeetExpectations({
    baseReleaseInfo,
  }: {
    baseReleaseInfo: AllFirmwareRelease | undefined;
  }) {
    if (baseReleaseInfo) {
      const firmwareVersion = get(baseReleaseInfo, 'firmware.release.version');
      const bleVersion = get(baseReleaseInfo, 'ble.release.version');
      const featuresCache = get(baseReleaseInfo, 'features');
      if (featuresCache && (bleVersion || firmwareVersion)) {
        return baseReleaseInfo;
      }
    }
    return undefined;
  }

  private async getFirmwareUpdateDevForceTargets(): Promise<
    FirmwareUpdatePlanForceTarget[]
  > {
    const settings =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettingsSnapshot();
    const targets: FirmwareUpdatePlanForceTarget[] = [];
    if (settings?.forceUpdateFirmware || settings?.forceUpdateOnceFirmware) {
      targets.push('firmware');
      if (settings.forceUpdateResEvenSameVersion) {
        targets.push('resource');
      }
    }
    if (settings?.forceUpdateBle || settings?.forceUpdateOnceBle) {
      targets.push('ble');
    }
    if (
      settings?.forceUpdateBootloader ||
      settings?.forceUpdateOnceBootloader
    ) {
      targets.push('bootloader');
    }
    return targets;
  }

  @backgroundMethod()
  @toastIfError()
  async checkAllFirmwareRelease({
    connectId,
    firmwareType,
    skipCancel,
    baseReleaseInfoCache,
    checkFirmwareHash,
    resolvedTransportType,
  }: {
    connectId: string | undefined;
    firmwareType: EFirmwareType | undefined;
    skipCancel?: boolean;
    baseReleaseInfoCache?: AllFirmwareRelease;
    checkFirmwareHash?: boolean;
    resolvedTransportType?: EHardwareTransportType;
  }): Promise<ICheckAllFirmwareReleaseResult> {
    const hardwareSdk = await CoreSDKLoader();
    const getDeviceSerialNo =
      (
        hardwareSdk as typeof hardwareSdk & {
          getDeviceSerialNo?: typeof hardwareSdk.getDeviceUUID;
        }
      ).getDeviceSerialNo ?? hardwareSdk.getDeviceUUID;
    const forceUpdateTargets = await this.getFirmwareUpdateDevForceTargets();

    const releaseInfoCache =
      !checkFirmwareHash && forceUpdateTargets.length === 0
        ? this._checkCacheMeetExpectations({
            baseReleaseInfo: baseReleaseInfoCache,
          })
        : undefined;

    let resolvedTransport:
      | {
          connectId: string;
          transportType: EHardwareTransportType;
        }
      | undefined;
    if (connectId) {
      resolvedTransport = resolvedTransportType
        ? { connectId, transportType: resolvedTransportType }
        : await this.backgroundApi.serviceHardware.resolveHardwareTransport({
            connectId,
            hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
          });
    }
    const originalConnectId = resolvedTransport?.connectId ?? connectId;
    // Skip cancel when using cached data since device state was already verified
    const needSkipCancel = skipCancel || !!releaseInfoCache;

    if (platformEnv.isNative && !originalConnectId) {
      throw new OneKeyLocalError(
        'checkAllFirmwareRelease ERROR: native ble-sdk connectId is required',
      );
    }

    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.init,
      payload: undefined,
    });
    await firmwareUpdateRetryAtom.set(undefined);
    serviceHardwareUtils.hardwareLog('checkAllFirmwareRelease');

    // transport 与 connectId 已在上方成对解析；这里不能再从持久化设置推导，
    // 因为持久化值可能仍描述上一轮操作，而本轮已经选择了 BLE。
    const currentTransportType =
      resolvedTransport?.transportType ?? (await this.getActiveTransportType());
    const sdk = await this.getSDKInstance({
      connectId: originalConnectId,
      hardwareTransportType: currentTransportType,
      forceFirmwareManifestRefresh: true,
    });
    try {
      if (!needSkipCancel) {
        sdk.cancel(originalConnectId);
      }
    } catch (_error) {
      //
    }

    if (!needSkipCancel) {
      await timerUtils.wait(1000);
    }

    const updatingConnectId = deviceUtils.getUpdatingConnectId({
      connectId: originalConnectId,
      currentTransportType,
    });

    try {
      if (!needSkipCancel) {
        sdk.cancel(updatingConnectId);
      }
    } catch (_error) {
      //
    }

    const { isBootloaderMode, features: initialFeatures } =
      await this.checkDeviceIsBootloaderMode({
        connectId: originalConnectId,
        allowEmptyConnectId: true,
        forceProtocolDetection:
          currentTransportType === EHardwareTransportType.DesktopWebBle,
        hardwareTransportType: currentTransportType,
      });
    let features: IOneKeyDeviceFeatures =
      initialFeatures as IOneKeyDeviceFeatures;

    // use originalConnectId getFeatures() make sure sdk throw DeviceNotFound if connected device not matched with originalConnectId
    if (isBootloaderMode || !features) {
      features =
        await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
          connectId: isBootloaderMode ? updatingConnectId : originalConnectId,
          params: {
            allowEmptyConnectId: true,
            forceProtocolDetection:
              currentTransportType === EHardwareTransportType.DesktopWebBle,
            ...(currentTransportType === EHardwareTransportType.DesktopWebBle
              ? { timeout: DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS }
              : {}),
          },
          hardwareTransportType: currentTransportType,
        });
    }

    const deviceType = await deviceUtils.getDeviceTypeFromFeatures({
      features,
    });
    const protocolV2DevSettings = isProtocolV2ProductType(deviceType)
      ? await Promise.all([
          this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
            'pro2ForceUpdateTargets',
          ),
          this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
            'pro2ForceUpdateOnceTargets',
          ),
        ])
      : undefined;
    const pro2ForceTargets = protocolV2DevSettings
      ? buildProtocolV2PlanForceTargets({
          forceTargets: protocolV2DevSettings[0] ?? [],
          forceOnceTargets: protocolV2DevSettings[1] ?? [],
        })
      : undefined;
    const forceUpdateTargetsForDevice = isProtocolV2ProductType(deviceType)
      ? []
      : forceUpdateTargets;

    const releaseInfo =
      releaseInfoCache?.firmwareUpdatePlan && !pro2ForceTargets?.length
        ? releaseInfoCache
        : await this.loadBaseFirmwareRelease({
            connectId: originalConnectId,
            firmwareType,
            skipChangeTransportType: true,
            checkFirmwareHash,
            resolvedTransportType: currentTransportType,
            forceUpdateTargets: forceUpdateTargetsForDevice,
            protocolV2ForceUpdateTargets: pro2ForceTargets,
          });

    const currentFirmwareType = await deviceUtils.getFirmwareType({
      features: releaseInfo.features as unknown as
        | IOneKeyDeviceFeatures
        | undefined,
    });
    const shouldResolveDetectStatus =
      firmwareType === undefined || currentFirmwareType === firmwareType;

    const firmware = await this.checkFirmwareRelease({
      connectId: updatingConnectId,
      features,
      firmwareReleasePayload:
        releaseInfo.firmware as unknown as IFirmwareReleasePayload,
      saveUpdateInfo: false,
      forceUpdate: forceUpdateTargetsForDevice.includes('firmware'),
    });

    let ble;
    let bootloader;
    let bridge;
    if (firmware?.hasUpgrade && firmware.toVersion) {
      bridge = releaseInfo.bridge as unknown as IHardwareBridgeReleasePayload;

      const mockShouldUpdateBridge =
        await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'shouldUpdateBridge',
        );
      if (bridge && mockShouldUpdateBridge === true) {
        // TODO mock bridge?.shouldUpdate
        bridge.shouldUpdate = true;
      }
    }
    const shouldCheckProtocolV2Bootloader =
      isProtocolV2ProductType(deviceType) && Boolean(releaseInfo.bootloader);
    if (
      !bridge?.shouldUpdate &&
      releaseInfo.bootloader &&
      (shouldCheckProtocolV2Bootloader ||
        (firmware?.toVersion &&
          (firmware.hasUpgrade ||
            forceUpdateTargetsForDevice.includes('bootloader'))))
    ) {
      bootloader = await this.checkBootloaderRelease({
        connectId: updatingConnectId,
        features,
        firmwareUpdateInfo: firmware,
        bootloaderReleasePayload:
          releaseInfo.bootloader as unknown as IBootloaderReleasePayload,
        forceUpdate:
          forceUpdateTargetsForDevice.includes('bootloader') ||
          pro2ForceTargets?.includes('boot'),
        currentVersion: releaseInfo.currentVersions?.bootloader,
      });
    }

    if (!bridge?.shouldUpdate) {
      ble = await this.checkBLEFirmwareRelease({
        connectId: updatingConnectId,
        features,
        bleReleasePayload:
          releaseInfo.ble as unknown as IBleFirmwareReleasePayload,
        forceUpdate:
          forceUpdateTargetsForDevice.includes('ble') ||
          pro2ForceTargets?.includes('coprocessor'),
        currentVersion: releaseInfo.currentVersions?.ble,
        saveUpdateInfo: !shouldResolveDetectStatus,
      });
    }

    let hasUpgrade =
      firmware?.hasUpgrade || ble?.hasUpgrade || bootloader?.hasUpgrade;

    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (mockAllIsUpToDate) {
      hasUpgrade = false;
    }

    // Force update if firmware is too many versions behind
    if (firmware?.hasUpgrade) {
      if (
        this.isVersionTooOld(
          firmware.fromVersion,
          firmware.toVersion,
          FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
        )
      ) {
        firmware.hasUpgradeForce = true;
      }
    }
    if (ble?.hasUpgrade) {
      if (
        this.isVersionTooOld(
          ble.fromVersion,
          ble.toVersion,
          FIRMWARE_ONBOARDING_MAX_VERSIONS_BEHIND,
        )
      ) {
        ble.hasUpgradeForce = true;
      }
    }

    // TODO boot mode device serial number is empty
    const deviceSerialNo = getDeviceSerialNo(features);
    const deviceName = await deviceUtils.buildDeviceName({ features });
    const deviceBleName = deviceUtils.buildDeviceBleName({ features });

    const totalPhase: Array<IDeviceFirmwareType | undefined> = [
      bootloader?.hasUpgrade ? 'bootloader' : undefined,
      firmware?.hasUpgrade ? 'firmware' : undefined,
      ble?.hasUpgrade ? 'ble' : undefined,
    ];

    const pro2TargetsToUpdate = isProtocolV2ProductType(deviceType)
      ? buildPro2TargetsToUpdate({
          sdkTargets: releaseInfo.targetsToUpdate,
          forceTargets: pro2ForceTargets,
        })
      : undefined;
    const effectiveHasUpgrade =
      hasUpgrade || Boolean(pro2TargetsToUpdate?.length);

    if (
      originalConnectId &&
      (shouldResolveDetectStatus || !effectiveHasUpgrade)
    ) {
      const identity =
        await this.getFirmwareUpdateDetectIdentity(originalConnectId);
      if (shouldResolveDetectStatus) {
        await this.detectMap.resolveUpdateInfo({
          ...identity,
          firmware,
          ble,
          targetsToUpdate: pro2TargetsToUpdate,
        });
      } else {
        await this.detectMap.deleteUpdateInfo(identity);
      }
    }

    let serverVersionInfos: IAllDeviceVerifyVersions | undefined;
    const defaultVersion = '0.0.0';
    const versionInfosFromBackend =
      await this.backgroundApi.serviceHardware.hardwareVerifyManager.fetchFirmwareVerifyHash(
        {
          deviceType,
          firmwareVersion: firmware?.hasUpgrade
            ? firmware.toVersion
            : defaultVersion,
          bluetoothVersion: ble?.hasUpgrade ? ble.toVersion : defaultVersion,
          bootloaderVersion: bootloader?.hasUpgrade
            ? bootloader.toVersion
            : defaultVersion,
          firmwareType,
        },
      );
    if (Array.isArray(versionInfosFromBackend)) {
      serverVersionInfos = deviceUtils.parseServerVersionInfos({
        serverVerifyInfos: versionInfosFromBackend,
      });
      if (firmware?.hasUpgrade && serverVersionInfos.firmware.releaseUrl) {
        firmware.githubReleaseUrl = serverVersionInfos.firmware.releaseUrl;
      }
      if (ble?.hasUpgrade && serverVersionInfos.bluetooth.releaseUrl) {
        ble.githubReleaseUrl = serverVersionInfos.bluetooth.releaseUrl;
      }
      if (bootloader?.hasUpgrade && serverVersionInfos.bootloader.releaseUrl) {
        bootloader.githubReleaseUrl = serverVersionInfos.bootloader.releaseUrl;
      }
    }

    const protocolV2FirmwareVersionInfo = pro2TargetsToUpdate
      ? buildProtocolV2FirmwareVersionInfo({
          releaseInfo,
          targetsToUpdate: pro2TargetsToUpdate,
        })
      : undefined;

    let fixedUpdatingConnectId = updatingConnectId;
    try {
      if (platformEnv.isSupportDesktopBle) {
        const device: IDBDevice | undefined = await localDb.getDeviceByQuery({
          connectId: originalConnectId,
        });
        fixedUpdatingConnectId = deviceUtils.getFixedUpdatingConnectId({
          updatingConnectId,
          currentTransportType,
          device,
        });
      }
    } catch (_error) {
      // Keep the transport-derived connect ID when the local device is absent.
    }

    const executableFirmwareUpdatePlan =
      releaseInfo.firmwareUpdatePlan?.artifacts.length &&
      releaseInfo.firmwareUpdatePlan.targetsToUpdate.length
        ? releaseInfo.firmwareUpdatePlan
        : undefined;
    const firmwareUpdatePlanDigest = await (
      await this.getFirmwareUpdateRuntimeHost()
    ).artifacts.cachePlanDigestIfPreparedSupported({
      hasUpgrade: effectiveHasUpgrade,
      plan: executableFirmwareUpdatePlan,
      connectId: updatingConnectId,
      transportType: currentTransportType,
      expectedTargets: isProtocolV2ProductType(deviceType)
        ? pro2TargetsToUpdate
        : [
            ...new Set<FirmwareUpdatePlanForceTarget>([
              ...forceUpdateTargetsForDevice,
              ...(firmware?.hasUpgrade ? (['firmware'] as const) : []),
              ...(ble?.hasUpgrade ? (['ble'] as const) : []),
              ...(bootloader?.hasUpgrade ? (['bootloader'] as const) : []),
            ]),
          ],
      requirePreparedPlan: isProtocolV2ProductType(deviceType),
    });

    const result = {
      updatingConnectId: fixedUpdatingConnectId,
      originalConnectId,
      features,
      deviceType,
      deviceName,
      deviceBleName,
      deviceUUID: deviceSerialNo,
      firmwareUpdatePlanDigest,
      hasUpgrade: effectiveHasUpgrade,
      isBootloaderMode: features
        ? (await deviceUtils.getDeviceModeFromFeatures({ features })) ===
          EOneKeyDeviceMode.bootloader
        : false,
      updateInfos: {
        firmware,
        ble,
        bootloader,
        bridge,
      },
      totalPhase: totalPhase.filter(Boolean),
      pro2TargetsToUpdate,
      pro2ResourceArchive: releaseInfo.resourceArchive
        ? {
            archiveSha256: releaseInfo.resourceArchive.archiveSha256,
            archiveSize: releaseInfo.resourceArchive.archiveSize,
          }
        : undefined,
      protocolV2FirmwareVersionInfo,
    };

    // Firmware-check interactions such as PIN entry are complete at this point.
    // Close only the UI without cancelling the device request used by the update.
    if (originalConnectId) {
      await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: originalConnectId,
        skipDeviceCancel: true,
        deviceResetToHome: false,
        skipDelayClose: true,
        reason: 'checkAllFirmwareRelease completed',
      });
    }

    return result;
  }

  @backgroundMethod()
  async checkFirmwareRelease({
    connectId,
    features,
    firmwareReleasePayload,
    saveUpdateInfo = true,
    forceUpdate,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
    firmwareReleasePayload: IFirmwareReleasePayload;
    saveUpdateInfo?: boolean;
    forceUpdate?: boolean;
  }): Promise<IFirmwareUpdateInfo> {
    const releasePayload: IFirmwareReleasePayload = {
      ...firmwareReleasePayload,
      features,
      connectId, // set connectId as result missing features, but events include
    };

    // TODO check releaseInfo.version with current version
    // 1. manual check here
    // 2. auto check by event: FIRMWARE_EVENT (event emit by method calling like sdk.getFeatures())
    return this.setFirmwareUpdateInfo(
      releasePayload,
      saveUpdateInfo,
      forceUpdate,
    );
  }

  private async loadBaseFirmwareRelease({
    connectId,
    firmwareType,
    skipChangeTransportType,
    retryCount,
    silentMode,
    checkFirmwareHash,
    resolvedTransportType,
    forceUpdateTargets,
    protocolV2ForceUpdateTargets,
    forceFirmwareManifestRefresh,
  }: {
    connectId: string | undefined;
    firmwareType: EFirmwareType | undefined;
    skipChangeTransportType?: boolean;
    retryCount?: number;
    silentMode?: boolean;
    checkFirmwareHash?: boolean;
    resolvedTransportType?: EHardwareTransportType;
    forceUpdateTargets?: FirmwareUpdatePlanForceTarget[];
    protocolV2ForceUpdateTargets?: IPro2FirmwareUpdateTarget[];
    forceFirmwareManifestRefresh?: boolean;
  }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
      hardwareTransportType: resolvedTransportType,
      forceFirmwareManifestRefresh,
    });
    const checkBridgeRelease = await this._hasUseBridge();
    let currentConnectId = connectId;
    if (!skipChangeTransportType) {
      const currentTransportType =
        resolvedTransportType ?? (await this.getActiveTransportType());
      currentConnectId = deviceUtils.getUpdatingConnectId({
        connectId,
        currentTransportType,
      });
    }
    const checkReleaseParams = {
      checkBridgeRelease,
      firmwareType,
      platform: platformEnv.symbol ?? 'web',
      retryCount,
      checkFirmwareHash,
      forceUpdateTargets,
      protocolV2ForceUpdateTargets,
    };
    const result = await convertDeviceResponse(
      () =>
        // method fail if device on boot mode
        hardwareSDK.checkAllFirmwareRelease(
          currentConnectId,
          checkReleaseParams,
        ),
      {
        silentMode,
      },
    );

    return result;
  }

  @backgroundMethod()
  baseCheckAllFirmwareRelease(
    params: Parameters<ServiceFirmwareUpdate['loadBaseFirmwareRelease']>[0],
  ) {
    return this.loadBaseFirmwareRelease({
      ...params,
      forceFirmwareManifestRefresh: params.forceFirmwareManifestRefresh ?? true,
    }).then((result) => ({
      ...result,
      firmwareUpdatePlan: undefined,
    }));
  }

  @backgroundMethod()
  async checkFirmwareTypeAvailable({
    connectId,
    deviceType,
    firmwareType,
  }: {
    connectId: string | undefined;
    deviceType: IDeviceType;
    firmwareType: EFirmwareType;
  }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK.checkFirmwareTypeAvailable({
        deviceType,
        firmwareType,
      }),
    );
  }

  @backgroundMethod()
  async checkBLEFirmwareRelease({
    connectId,
    features,
    bleReleasePayload,
    forceUpdate,
    currentVersion,
    saveUpdateInfo = true,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
    bleReleasePayload: IBleFirmwareReleasePayload;
    forceUpdate?: boolean;
    currentVersion?: string | null;
    saveUpdateInfo?: boolean;
  }): Promise<IBleFirmwareUpdateInfo> {
    const releasePayload: IBleFirmwareReleasePayload = {
      ...bleReleasePayload,
      features,
      connectId,
    };

    // TODO check releaseInfo.version with current version
    // 1. manual check here
    // 2. auto check by event: FIRMWARE_EVENT (event emit by method calling like sdk.getFeatures())
    return this.setBleFirmwareUpdateInfo(
      releasePayload,
      forceUpdate,
      currentVersion,
      saveUpdateInfo,
    );
  }

  // TODO only for classic and mini?
  @backgroundMethod()
  async checkBootloaderRelease({
    connectId,
    features,
    firmwareUpdateInfo,
    bootloaderReleasePayload,
    forceUpdate,
    currentVersion,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
    firmwareUpdateInfo: IFirmwareUpdateInfo;
    bootloaderReleasePayload: IBootloaderReleasePayload;
    forceUpdate?: boolean;
    currentVersion?: string | null;
  }): Promise<IBootloaderUpdateInfo> {
    const usedReleasePayload = bootloaderReleasePayload;

    const { bootloaderVersion: detectedBootloaderVersion } =
      await deviceUtils.getDeviceVersion({
        features,
        device: undefined,
      });
    const bootloaderVersion = currentVersion || detectedBootloaderVersion;
    let toVersion = '';
    let changelog: IFirmwareChangeLog | undefined;
    // boot releaseInfo?.release may be string of resource download url
    const versionFromReleaseInfo =
      usedReleasePayload?.release?.displayBootloaderVersion ??
      usedReleasePayload?.release?.version;
    if (versionFromReleaseInfo && isArray(versionFromReleaseInfo)) {
      toVersion = this.arrayVersionToString(versionFromReleaseInfo);
    }
    if (!toVersion) {
      toVersion = this.arrayVersionToString(
        firmwareUpdateInfo.releasePayload.release?.displayBootloaderVersion,
      );
    }
    changelog = usedReleasePayload.release?.bootloaderChangelog;
    if (!changelog) {
      changelog =
        firmwareUpdateInfo.releasePayload.release?.bootloaderChangelog;
    }

    const fromVersion = bootloaderVersion;
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: usedReleasePayload,
        firmwareType: 'bootloader',
        fromVersion,
        toVersion,
        fromFirmwareType: undefined,
        toFirmwareType: undefined,
        forceUpdate,
      });

    const updateInfo: IBootloaderUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      fromFirmwareType: undefined,
      toVersion,
      toFirmwareType: undefined,
      releasePayload: usedReleasePayload,
      changelog,
      firmwareType: 'bootloader',
    };
    return updateInfo;
  }

  async getFirmwareHasUpgradeStatus({
    releasePayload,
    firmwareType,
    fromVersion,
    toVersion,
    fromFirmwareType,
    toFirmwareType,
    forceUpdate,
  }: {
    releasePayload:
      | IFirmwareReleasePayload
      | IBleFirmwareReleasePayload
      | IBootloaderReleasePayload;
    firmwareType: IDeviceFirmwareType;
    fromVersion: string;
    toVersion: string;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
    forceUpdate?: boolean;
  }) {
    let hasUpgradeForce = false;
    let hasUpgrade = false;
    switch (releasePayload?.status) {
      case 'required':
        hasUpgradeForce = true;
        hasUpgrade = true;
        break;
      case 'valid':
      case 'none':
        hasUpgrade = false;
        break;
      case 'outdated':
        hasUpgrade = true;
        break;
      default:
        hasUpgrade = false;
        break;
    }

    // bootloaderMode may return status: 'unknown' | 'none'
    // TODO: different of 'unknown' | 'none';
    if (
      // bootloader can't detect current firmware version, so we always upgrade fw and ble
      releasePayload?.bootloaderMode &&
      releasePayload?.release &&
      ['firmware', 'ble'].includes(firmwareType) // bootloader can't reinstall
    ) {
      hasUpgrade = true;
    }

    // TODO sdk missing type shouldUpdate
    // @ts-ignore
    if (releasePayload?.shouldUpdate) {
      // if sdk indicate should update, always update
      hasUpgrade = true;
    }

    const changeFirmwareType = fromFirmwareType !== toFirmwareType;
    if (
      firmwareType !== 'bootloader' &&
      !releasePayload?.bootloaderMode &&
      fromVersion &&
      toVersion &&
      !changeFirmwareType
    ) {
      if (semver.gte(fromVersion, toVersion)) {
        hasUpgrade = false;
        hasUpgradeForce = false;
      }
    }

    // re-fix at last, if valid status, never upgrade
    if (releasePayload?.status === 'valid') {
      hasUpgrade = false;
    }

    if (forceUpdate === true) {
      hasUpgrade = true;
    } else if (forceUpdate === undefined) {
      const forceUpdateTargets = await this.getFirmwareUpdateDevForceTargets();
      if (forceUpdateTargets.includes(firmwareType)) {
        hasUpgrade = true;
      }
    }

    return {
      hasUpgradeForce,
      hasUpgrade,
    };
  }

  isVersionTooOld(
    fromVersion: string,
    toVersion: string,
    maxBehind: number,
  ): boolean {
    const from = semver.parse(fromVersion);
    const to = semver.parse(toVersion);
    if (!from || !to) return false;

    if (to.major > from.major) return true;
    if (to.major === from.major && to.minor - from.minor > maxBehind)
      return true;
    if (
      to.major === from.major &&
      to.minor === from.minor &&
      to.patch - from.patch > maxBehind
    )
      return true;

    return false;
  }

  async getConnectIdFromReleaseInfo(
    payload: IFirmwareReleasePayload | IBleFirmwareReleasePayload,
  ) {
    let connectId = payload.connectId;
    // features only included by events calling
    if (!connectId && payload.features) {
      connectId =
        await this.backgroundApi.serviceHardware.getConnectIdFromFeatures({
          features: payload.features,
        });
    }
    return connectId;
  }

  arrayVersionToString(version: IVersionArray | undefined) {
    return version?.join('.') || '';
  }

  // TODO move to standalone service
  @backgroundMethod()
  async setFirmwareUpdateInfo(
    payload: IFirmwareReleasePayload,
    saveUpdateInfo = true,
    forceUpdate?: boolean,
  ): Promise<IFirmwareUpdateInfo> {
    serviceHardwareUtils.hardwareLog('_checkFirmwareUpdate', payload);
    if (!payload?.features) {
      throw new OneKeyLocalError(
        'setFirmwareUpdateInfo ERROR: features is required',
      );
    }
    const connectId = await this.getConnectIdFromReleaseInfo(payload);

    const { firmwareVersion } = await deviceUtils.getDeviceVersion({
      device: undefined,
      features: payload?.features,
    });

    const fromVersion = firmwareVersion || '';
    const fromFirmwareType = await deviceUtils.getFirmwareType({
      features: payload?.features,
    });
    const toVersion = this.arrayVersionToString(payload?.release?.version);
    const toFirmwareType = payload.release?.firmwareType;
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: payload,
        firmwareType: 'firmware',
        fromVersion,
        toVersion,
        fromFirmwareType,
        toFirmwareType,
        forceUpdate,
      });

    const updateInfo: IFirmwareUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      fromFirmwareType,
      toVersion,
      toFirmwareType: payload.release?.firmwareType,
      releasePayload: payload,
      changelog: payload.release?.changelog,
      firmwareType: 'firmware',
    };
    if (connectId && saveUpdateInfo) {
      const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
      await this.detectMap.updateFirmwareUpdateInfo({
        ...identity,
        updateInfo,
      });
    }
    serviceHardwareUtils.hardwareLog(
      '_checkFirmwareUpdate updateInfo',
      updateInfo,
    );
    return updateInfo;
  }

  @backgroundMethod()
  async setBleFirmwareUpdateInfo(
    payload: IBleFirmwareReleasePayload,
    forceUpdate?: boolean,
    currentVersion?: string | null,
    saveUpdateInfo = true,
  ) {
    serviceHardwareUtils.hardwareLog('showBleFirmwareReleaseInfo', payload);
    if (!payload.features) {
      throw new OneKeyLocalError(
        'setBleFirmwareUpdateInfo ERROR: features is required',
      );
    }
    const connectId = await this.getConnectIdFromReleaseInfo(payload);
    const { bleVersion: detectedBleVersion } =
      await deviceUtils.getDeviceVersion({
        device: undefined,
        features: payload.features,
      });
    const fromVersion = currentVersion || detectedBleVersion || '';
    const toVersion = this.arrayVersionToString(payload?.release?.version);
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: payload,
        firmwareType: 'ble',
        fromVersion,
        toVersion,
        fromFirmwareType: undefined,
        toFirmwareType: undefined,
        forceUpdate,
      });

    const updateInfo: IBleFirmwareUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      fromFirmwareType: undefined,
      toVersion,
      toFirmwareType: undefined,
      releasePayload: payload,
      changelog: payload.release?.changelog,
      firmwareType: 'ble',
    };
    if (connectId && saveUpdateInfo) {
      const identity = await this.getFirmwareUpdateDetectIdentity(connectId);
      await this.detectMap.updateBleFirmwareUpdateInfo({
        ...identity,
        updateInfo,
      });
    }
    return updateInfo;
  }

  async withFirmwareUpdateEvents<T>(
    fn: () => Promise<T>,
    executionArtifacts?: IFirmwareExecutionArtifacts,
  ): Promise<T> {
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    const transactionId =
      executionArtifacts?.preparedArtifacts?.transactionId ??
      executionArtifacts?.bridgeBinaries?.transactionId;
    const executor =
      executionArtifacts?.preparedArtifacts?.plan.executor ??
      executionArtifacts?.bridgeBinaries?.executor;
    let inputMode: IFirmwareUpdateTraceInputMode = 'sdk-managed';
    if (executionArtifacts?.preparedArtifacts) {
      inputMode = 'artifact-reader';
    } else if (executionArtifacts?.bridgeBinaries) {
      inputMode = 'bridge-binary';
    }
    const listener = (data: any) => {
      serviceHardwareUtils.hardwareLog('autoUpdateFirmware', data);
      const tipMessage =
        get(data, 'data.message') ??
        get(data, 'payload.data.message') ??
        get(data, 'message');
      if (transactionId && typeof tipMessage === 'string') {
        firmwareUpdateTrace({
          transactionId,
          stage: 'sdk-tip',
          executor,
          inputMode,
          tipMessage,
        });
      }
      // dispatch(setUpdateFirmwareStep(get(data, 'data.message', '')));
    };
    hardwareSDK.on(EHardwareUiStateAction.FIRMWARE_TIP, listener);
    try {
      return await fn();
    } finally {
      hardwareSDK.off(EHardwareUiStateAction.FIRMWARE_TIP, listener);
    }
  }

  @backgroundMethod()
  async ensureDeviceExist(
    connectId: string,
    maxTryCount = 10,
    bootloaderMode = false,
  ) {
    return new Promise((resolve) => {
      const scanner = deviceUtils.getDeviceScanner({
        backgroundApi: this.backgroundApi,
      });
      let tryCount = 0;
      scanner.startDeviceScan(
        (response) => {
          tryCount += 1;
          if (tryCount > maxTryCount) {
            scanner.stopScan();
            resolve(false);
          }
          if (!response.success) {
            return;
          }
          const deviceExist = bootloaderMode
            ? // bootloader mode does not have connect id for classic
              (response.payload ?? []).length > 0
            : (response.payload ?? []).find((d) =>
                equalsIgnoreCase(d.connectId, connectId),
              );
          if (deviceExist) {
            scanner.stopScan();
            resolve(true);
          }
        },
        () => {},
        1,
        3000,
        Number.MAX_VALUE,
      );
    });
  }

  async updatingBootloader(
    params: IUpdateFirmwareWorkflowParams,
    updateInfo: IBootloaderUpdateInfo,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<undefined | Success> {
    const preparedArtifactController = (
      await this.getFirmwareUpdateRuntimeHost()
    ).artifacts;
    const executionArtifacts = preparedArtifactController.getExecutionArtifacts(
      firmwareArtifacts,
      'bootloaderUpdate',
    );
    const {
      executePreparedDeviceUpdateBootloader,
      executePreparedFirmwareUpdateV2Bootloader,
    } = await loadFirmwareUpdateRuntime();
    const hardwareSDK = await this.getSDKInstance({
      connectId: params.releaseResult.updatingConnectId,
    });

    const deviceType = params.releaseResult?.deviceType;
    if (!deviceType) return;

    // TODO move to utils
    const isClassicOrMini =
      deviceType === EDeviceType.Classic ||
      deviceType === EDeviceType.Mini ||
      deviceType === EDeviceType.Classic1s ||
      deviceType === EDeviceType.ClassicPure;

    const isTouchOrPro =
      deviceType === EDeviceType.Touch || deviceType === EDeviceType.Pro;

    return this.withFirmwareUpdateEvents(async () => {
      if (isClassicOrMini) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {
            installingTarget: {
              totalPhase: params.releaseResult.totalPhase,
              currentPhase: 'bootloader',
              updateInfo,
            },
          },
        });
        const result = convertDeviceResponse(() =>
          executePreparedFirmwareUpdateV2Bootloader({
            sdk: hardwareSDK,
            connectId: params.releaseResult.updatingConnectId,
            ...executionArtifacts,
            platform: platformEnv.symbol ?? 'web',
          }),
        );
        return result;
      }
      if (isTouchOrPro) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {
            installingTarget: {
              totalPhase: params.releaseResult.totalPhase,
              currentPhase: 'bootloader',
              updateInfo,
            },
          },
        });
        return convertDeviceResponse(() =>
          executePreparedDeviceUpdateBootloader({
            sdk: hardwareSDK,
            connectId: params.releaseResult.updatingConnectId as string,
            ...executionArtifacts,
          }),
        );
      }
    }, executionArtifacts);
  }

  updatingBootloaderForTouchAndProLegacy(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      const hardwareSDK = await this.getSDKInstance({
        connectId: params.releaseResult.updatingConnectId,
      });
      // restart count down
      await timerUtils.wait(8000);
      let tryCount = 0;
      //  polling device when restart success
      const DISCONNECT_ERROR = 'Request failed with status code';
      const execute = async () => {
        if (!params.releaseResult.updatingConnectId) {
          return;
        }
        const isFoundDevice = await this.ensureDeviceExist(
          params.releaseResult.updatingConnectId,
        );
        if (!isFoundDevice) {
          resolve({
            success: false,
            payload: {
              error: 'Device Not Found',
              code: HardwareErrorCode.DeviceNotFound,
            },
          });
        }
        const res = await hardwareSDK.deviceUpdateBootloader(
          params.releaseResult.updatingConnectId,
          {},
        );
        if (!res.success) {
          if (
            res.payload.error.indexOf(DISCONNECT_ERROR) > -1 &&
            tryCount < 3
          ) {
            tryCount += 1;
            await execute();
          } else {
            resolve(res);
            return;
          }
        }
        resolve(res as unknown as CoreSuccess<boolean>);
      };

      await execute();
    });
  }

  @backgroundMethod()
  @toastIfError()
  async updatingFirmware(
    { connectId, version, firmwareType, deviceType }: IAutoUpdateFirmwareParams,
    updateInfo: IBleFirmwareUpdateInfo | IFirmwareUpdateInfo,
    workflowParams: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<Success> {
    const preparedArtifactController = (
      await this.getFirmwareUpdateRuntimeHost()
    ).artifacts;
    const executionArtifacts = preparedArtifactController.getExecutionArtifacts(
      firmwareArtifacts,
      'firmwareUpdateV2',
    );
    const { executePreparedFirmwareUpdateV2 } =
      await loadFirmwareUpdateRuntime();
    // const { dispatch } = this.backgroundApi;
    // dispatch(setUpdateFirmwareStep(''));

    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });

    return this.withFirmwareUpdateEvents(async () => {
      // dev
      // const settings = this.backgroundApi.appSelector((s) => s.settings);
      // const enable = settings?.devMode?.enable ?? false;
      // const updateDeviceRes = settings?.devMode?.updateDeviceRes ?? false;

      // const forcedUpdateRes = enable && updateDeviceRes;
      // const version = settings.deviceUpdates?.[connectId][firmwareType]?.version;

      const forceUpdateResEvenIfSameVersion =
        executionArtifacts.preparedArtifacts?.plan.targetsToUpdate.includes(
          'resource',
        ) ??
        (await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'forceUpdateResEvenSameVersion',
        ));
      const versionArr = version.split('.').map((v) => parseInt(v, 10)); // TODO move to utils
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {
            totalPhase: workflowParams.releaseResult.totalPhase,
            currentPhase: firmwareType,
            updateInfo,
          },
        },
      });

      const currentTransportType = await this.getActiveTransportType();

      const updateType = firmwareType === 'ble' ? 'ble' : 'firmware';
      const result = await convertDeviceResponse(async () => {
        const updatingConnectId = deviceUtils.getUpdatingConnectId({
          connectId,
          currentTransportType,
        });
        return executePreparedFirmwareUpdateV2({
          sdk: hardwareSDK,
          connectId: updatingConnectId,
          ...executionArtifacts,
          updateType,
          forcedUpdateRes: forceUpdateResEvenIfSameVersion === true,
          version: versionArr,
          platform: platformEnv.symbol ?? 'web',
          firmwareType: updateInfo.toFirmwareType,
        });
      });
      if (
        result &&
        deviceType === EDeviceType.Touch &&
        firmwareType === 'firmware'
      ) {
        // const updateBootRes = await this.updateBootloader(connectId);
        // if (!updateBootRes.success) return updateBootRes;
      }
      // TODO handleErrors UpdatingModal
      return result;
    }, executionArtifacts);
  }

  @backgroundMethod()
  async checkBridgeStatus(): Promise<{ status: boolean; timeout?: boolean }> {
    if (!(await this._hasUseBridge())) {
      return Promise.resolve({ status: true });
    }

    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });

    try {
      const bridgeStatus = await convertDeviceResponse(() =>
        hardwareSDK?.checkBridgeStatus(),
      );
      return { status: bridgeStatus };
    } catch (error) {
      if (
        error instanceof InitIframeLoadFail ||
        error instanceof InitIframeTimeout
      ) {
        return Promise.resolve({ status: true });
      }
      /**
       * Sometimes we need to capture the Bridge timeout error
       * it does not mean that the user does not have bridge installed
       */
      if (error instanceof BridgeTimeoutError) {
        return Promise.resolve({ status: true, timeout: true });
      }

      return Promise.resolve({ status: false });
    }
  }

  async _hasUseBridge() {
    const hardwareTransportType = await this.getActiveTransportType();
    if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
      return false;
    }
    return (
      platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension
    );
  }

  updateTasks: Record<number | string, IUpdateFirmwareTask> = {};

  updateWorkflowSequence = 0;

  // Bind analytics to the workflow that created each task so late native
  // completions cannot mutate a newer workflow's counters.
  updateWorkflowTracking:
    | {
        workflowId: number;
        acceptsTaskResults: boolean;
        updateFlow: 'v1' | 'v2';
        releaseResult: ICheckAllFirmwareReleaseResult;
        transportType: EHardwareTransportType | undefined;
        startedAt: number;
        retryCount: number;
        lastFailure: IOneKeyError | undefined;
      }
    | undefined;

  resetUpdateWorkflowTracking({
    updateFlow,
    releaseResult,
  }: {
    updateFlow: 'v1' | 'v2';
    releaseResult: ICheckAllFirmwareReleaseResult;
  }) {
    this.updateWorkflowSequence += 1;
    const workflowId = this.updateWorkflowSequence;
    const startedAt = Date.now();
    this.updateWorkflowTracking = {
      workflowId,
      acceptsTaskResults: true,
      updateFlow,
      releaseResult,
      transportType: undefined,
      startedAt,
      retryCount: 0,
      lastFailure: undefined,
    };
    return workflowId;
  }

  getUpdateWorkflowTracking(workflowId: number) {
    const tracking = this.updateWorkflowTracking;
    return tracking?.workflowId === workflowId && tracking.acceptsTaskResults
      ? tracking
      : undefined;
  }

  recordUpdateWorkflowTransportType(
    workflowId: number,
    transportType: EHardwareTransportType,
  ) {
    const tracking = this.getUpdateWorkflowTracking(workflowId);
    if (!tracking) {
      return false;
    }
    tracking.transportType = transportType;
    return true;
  }

  private async getUpdateWorkflowTransportType() {
    return (
      this.updateWorkflowTracking?.transportType ??
      this.getActiveTransportType()
    );
  }

  isUpdateWorkflowCurrent(workflowId: number | undefined) {
    return (
      workflowId === undefined ||
      (this.updateWorkflowTracking?.workflowId === workflowId &&
        this.updateWorkflowTracking.acceptsTaskResults)
    );
  }

  closeUpdateWorkflowTracking() {
    const tracking = this.updateWorkflowTracking;
    if (!tracking || !tracking.acceptsTaskResults) {
      return;
    }
    tracking.acceptsTaskResults = false;
  }

  recordUpdateWorkflowFailure(workflowId: number, error: unknown) {
    const tracking = this.getUpdateWorkflowTracking(workflowId);
    if (
      !tracking ||
      error instanceof FirmwareUpdateExit ||
      error instanceof FirmwareUpdateTasksClear
    ) {
      return false;
    }
    const err = toPlainErrorObject(error as any);
    if (classifyFirmwareUpdateFailure(err) === 'cancelled') {
      return false;
    }
    tracking.lastFailure = err;
    return true;
  }

  recordUpdateWorkflowRetry(workflowId: number) {
    const tracking = this.getUpdateWorkflowTracking(workflowId);
    if (!tracking) {
      return false;
    }
    tracking.retryCount += 1;
    return true;
  }

  @backgroundMethod()
  async getUpdateWorkflowTrackingInfo(): Promise<{
    retryCount: number | undefined;
    totalDurationMs: number | undefined;
    transferredBytes: number | undefined;
    totalBytes: number | undefined;
    averageTransferRateBytesPerSecond: number | undefined;
    transferDurationMs: number | undefined;
    lastFailureType:
      | ReturnType<typeof classifyFirmwareUpdateFailure>
      | undefined;
    lastErrorCode: string | undefined;
  }> {
    const tracking = this.updateWorkflowTracking;
    const now = Date.now();
    const [activeUiState, completedUiState] = await Promise.all([
      hardwareUiStateAtom.get(),
      hardwareUiStateCompletedAtom.get(),
    ]);
    const transferMetrics =
      activeUiState?.payload?.firmwareTransferMetrics ??
      completedUiState?.payload?.firmwareTransferMetrics;
    return {
      retryCount: tracking?.retryCount,
      totalDurationMs: tracking ? now - tracking.startedAt : undefined,
      transferredBytes: transferMetrics?.transferredBytes,
      totalBytes: transferMetrics?.totalBytes,
      averageTransferRateBytesPerSecond: transferMetrics?.rateBytesPerSecond,
      transferDurationMs: transferMetrics?.elapsedMs,
      lastFailureType: tracking?.lastFailure
        ? classifyFirmwareUpdateFailure(tracking.lastFailure)
        : undefined,
      lastErrorCode: resolveFirmwareUpdateErrorCode(tracking?.lastFailure),
    };
  }

  updateTasksAdd({
    fn,
    reject,
    resolve,
  }: IPromiseContainerCallbackCreate & {
    fn: IUpdateFirmwareTaskFn;
  }) {
    const { servicePromise } = this.backgroundApi;
    // TODO disabled servicePromise auto reject when timeout
    const id = servicePromise.createCallback({ reject, resolve });

    this.updateTasks[id] = {
      fn,
      workflowId: this.updateWorkflowTracking?.workflowId,
    };
    return id;
  }

  async updateTasksReject({ id, error }: IPromiseContainerReject) {
    const { servicePromise } = this.backgroundApi;
    await servicePromise.rejectCallback({ id, error });
    delete this.updateTasks[id];
  }

  async updateTasksResolve({ id, data }: IPromiseContainerResolve) {
    const { servicePromise } = this.backgroundApi;
    await servicePromise.resolveCallback({
      id,
      data,
    });
    delete this.updateTasks[id];
  }

  async updateTasksClear(reason: string) {
    await Promise.all(
      Object.keys(this.updateTasks).map(async (id) => {
        await this.updateTasksReject({
          id,
          error: new FirmwareUpdateTasksClear({
            message: `updateTasksClear: ${reason}`,
          }),
        });
      }),
    );
    this.updateTasks = {};
  }

  @backgroundMethod()
  async exitUpdateWorkflow() {
    this.closeUpdateWorkflowTracking();
    try {
      const { cancelFirmwareArtifactPreparations } =
        await loadFirmwareUpdateRuntime();
      await cancelFirmwareArtifactPreparations();
    } finally {
      await this.updateTasksClear('exitUpdateWorkflow');
      await firmwareUpdateWorkflowRunningAtom.set(false);
    }
  }

  async cancelUpdateWorkflowIfExit() {
    const isRunning = await firmwareUpdateWorkflowRunningAtom.get();
    if (!isRunning) {
      throw new FirmwareUpdateExit();
    }
  }

  async waitDeviceRestart({
    releaseResult,
    actionType,
  }: {
    releaseResult: ICheckAllFirmwareReleaseResult | undefined;
    actionType: 'nextPhase' | 'retry' | 'ble-done' | 'boot-done' | 'done';
  }) {
    // use getFeatures to wait device reboot, not working, will pending forever
    // await this.backgroundApi.serviceHardware.getFeatures(
    //   params.connectId,
    //   {
    //     allowEmptyConnectId: true,
    //   },
    // );
    const hardwareTransportType = await this.getActiveTransportType();
    if (actionType === 'nextPhase') {
      const isWebUsb = hardwareTransportType === EHardwareTransportType.WEBUSB;
      await timerUtils.wait(isWebUsb ? 20 * 1000 : 15 * 1000);
    }
    if (actionType === 'retry') {
      await timerUtils.wait(5 * 1000);
    }
    if (actionType === 'ble-done') {
      if (
        [EDeviceType.Touch, EDeviceType.Pro].includes(
          (releaseResult?.deviceType || '') as EDeviceType,
        )
      ) {
        await timerUtils.wait(15 * 1000);
      }
    }
    if (actionType === 'done') {
      await timerUtils.wait(
        releaseResult?.deviceType === EDeviceType.Mini ? 5 * 1000 : 2 * 1000,
      );
    }
    if (actionType === 'boot-done') {
      if (
        [EDeviceType.Touch, EDeviceType.Pro].includes(
          (releaseResult?.deviceType ?? '') as EDeviceType,
        )
      ) {
        await timerUtils.wait(20 * 1000);
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async startUpdateWorkflow(params: IUpdateFirmwareWorkflowParams) {
    const workflowId = this.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: params.releaseResult,
    });
    // The guard goes up BEFORE the stage is silenced: an ask already queued
    // behind the silence would otherwise pass the stage's gate in the gap
    // and repaint over the update page until the drain below ended. The
    // retry path orders these the same way; the finally covers a failed
    // silence too.
    await firmwareUpdateWorkflowRunningAtom.set(true);
    try {
      await this.clearHardwareUiStateBeforeStartUpdateWorkflow();
      const dbDevice = await localDb.getDeviceByQuery({
        connectId: params.releaseResult.originalConnectId, // TODO remove connectId check
      });
      if (!dbDevice) {
        // throw new OneKeyLocalError('device not found');
      }
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          try {
            appEventBus.emit(EAppEventBusNames.BeginFirmwareUpdate, undefined);
            // await other hardware task stop processing
            await timerUtils.wait(3000);

            // Lock transport type during firmware update to prevent auto-switching
            // This prevents the system from switching to BLE when USB device is temporarily
            // unavailable during device reboot
            const currentTransportType = await this.getActiveTransportType();
            this.recordUpdateWorkflowTransportType(
              workflowId,
              currentTransportType,
            );
            await this.backgroundApi.serviceHardware.setForceTransportType({
              forceTransportType: currentTransportType,
            });
            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflow: locked transport type',
              currentTransportType,
            );

            // TODO verify current device is matched with params.connectId\params.updateFirmware\params.updateBle
            // pre checking
            await this.validateMnemonicBackuped(params);
            await this.validateUSBConnection(params);
            // must before validateMinVersionAllowed, go to https://help.onekey.so/
            await this.validateShouldUpdateFullResource(params);
            // go to https://firmware.onekey.so/
            await this.validateMinVersionAllowed(params);
            await this.validateDeviceBattery(params);
            await this.validateShouldUpdateBridge(params);

            await this.setFirmwareArtifactDownloadState(true);
            await (
              await this.getFirmwareUpdateRuntimeHost()
            ).artifacts.withWorkflowArtifacts(
              params.releaseResult,
              async (firmwareArtifacts) => {
                await this.setFirmwareArtifactDownloadState(false);
                // ** clear all retry tasks
                await this.updateTasksClear('startUpdateWorkflow');

                let shouldRebootAfterUpdate = false;

                const waitRebootDelayForNextPhase = async () => {
                  if (shouldRebootAfterUpdate) {
                    await this.waitDeviceRestart({
                      actionType: 'nextPhase',
                      releaseResult: params.releaseResult,
                    });
                    shouldRebootAfterUpdate = false;
                  }
                };

                // ** bootloader update
                await this.cancelUpdateWorkflowIfExit();
                if (
                  params?.releaseResult?.updateInfos?.bootloader?.hasUpgrade
                ) {
                  await waitRebootDelayForNextPhase();
                  await this.startUpdateBootloaderTask(
                    params,
                    firmwareArtifacts,
                  );

                  shouldRebootAfterUpdate = true;

                  // await hardware boot install and reboot
                  // move sdk
                  await this.waitDeviceRestart({
                    actionType: 'boot-done',
                    releaseResult: params.releaseResult,
                  });
                }

                // TODO cancel workflow if modal closed or back

                // ** firmware update (including res update)
                if (params?.releaseResult?.updateInfos?.firmware?.hasUpgrade) {
                  await waitRebootDelayForNextPhase();

                  const deviceType = params?.releaseResult?.deviceType;
                  // TODO recheck release if match with current connect device
                  // TODO check update version gt current version
                  // TODO check features matched
                  await this.cancelUpdateWorkflowIfExit();
                  await this.startUpdateFirmwareTaskBase(
                    {
                      connectId: params?.releaseResult?.updatingConnectId,
                      version:
                        params?.releaseResult?.updateInfos?.firmware?.toVersion,
                      firmwareType: 'firmware',
                      deviceType,
                    },
                    params?.releaseResult?.updateInfos?.firmware,
                    params,
                    firmwareArtifacts,
                  );

                  shouldRebootAfterUpdate = true;
                }

                //  ble update
                if (params?.releaseResult?.updateInfos?.ble?.hasUpgrade) {
                  await waitRebootDelayForNextPhase();

                  const deviceType = params?.releaseResult?.deviceType;

                  // TODO recheck release if match with current connect device
                  await this.cancelUpdateWorkflowIfExit();
                  await this.startUpdateFirmwareTaskBase(
                    {
                      connectId: params?.releaseResult?.updatingConnectId,
                      version:
                        params?.releaseResult?.updateInfos?.ble?.toVersion,
                      firmwareType: 'ble',
                      deviceType,
                    },
                    params?.releaseResult?.updateInfos?.ble,
                    params,
                    firmwareArtifacts,
                  );

                  shouldRebootAfterUpdate = true;

                  await this.waitDeviceRestart({
                    actionType: 'ble-done',
                    releaseResult: params.releaseResult,
                  });
                }

                serviceHardwareUtils.hardwareLog(
                  'startUpdateWorkflow DONE',
                  params,
                );

                await firmwareUpdateRetryAtom.set(undefined);
                if (params.releaseResult.originalConnectId) {
                  await this.waitDeviceRestart({
                    actionType: 'done',
                    releaseResult: params.releaseResult,
                  });
                  await this.deleteFirmwareUpdateDetectInfo(
                    params.releaseResult.originalConnectId,
                  );
                  await this.backgroundApi.serviceHardware.updateDeviceVersionAfterFirmwareUpdate(
                    params,
                  );
                  await this.clearOnceUpdateDevSettings();
                  appEventBus.emit(
                    EAppEventBusNames.FinishFirmwareUpdate,
                    undefined,
                  );
                }
              },
            );
          } finally {
            // Always clear transport type lock when firmware update completes (success or failure)
            await this.backgroundApi.serviceHardware.clearForceTransportType();
            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflow: cleared transport type lock',
            );
          }
        },
        {
          deviceParams: {
            dbDevice: dbDevice || ({} as any),
          },
          allowDuringFirmwareUpdate: true,
          skipDeviceCancel: true,
          hideCheckingDeviceLoading: true,
          debugMethodName: 'startUpdateWorkflow',
        },
      );
    } finally {
      // The bg guard outlives the UI and must cover lock acquisition failures too.
      await firmwareUpdateWorkflowRunningAtom.set(false);
    }
  }

  @backgroundMethod()
  async clearHardwareUiStateBeforeStartUpdateWorkflow() {
    // The stage leaves with the legacy state: the update page is the only
    // surface from here, and a burst still in flight takes nothing down
    // until its own end. An air-gap scan the stage was hosting leaves with
    // it, rejected, rather than waiting invisibly for its expiry.
    await this.backgroundApi.serviceHardwareUI.silenceDeviceStageForFirmwareWorkflow();
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: '',
      payload: {} as any,
    });
    await hardwareUiStateCompletedAtom.set(undefined);
    await firmwareUpdateResultVerifyAtom.set(undefined);
  }

  async completeUpdateWorkflow({
    params,
  }: {
    params: IUpdateFirmwareWorkflowParams;
  }) {
    const updateFirmwareInfo = params.releaseResult.updateInfos?.firmware;
    const { fromFirmwareType, toFirmwareType } = updateFirmwareInfo ?? {
      fromFirmwareType: undefined,
      toFirmwareType: undefined,
    };
    const needOnboarding =
      fromFirmwareType && toFirmwareType && fromFirmwareType !== toFirmwareType;

    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.updateDone,
      payload: {
        needOnboarding,
      },
    });

    try {
      const hardwareTransportType = await this.getUpdateWorkflowTransportType();
      const trackingInfo = await this.getUpdateWorkflowTrackingInfo();

      defaultLogger.update.firmware.firmwareUpdateResult({
        deviceType: params.releaseResult.deviceType,
        transportType: hardwareTransportType,
        updateFlow: 'v2',
        firmwareVersions: parseFirmwareVersions(params.releaseResult),
        fromFirmwareType,
        toFirmwareType,
        status: 'success',
        retryCount: trackingInfo.retryCount,
        totalDurationMs: trackingInfo.totalDurationMs,
        transferredBytes: trackingInfo.transferredBytes,
        totalBytes: trackingInfo.totalBytes,
        averageTransferRateBytesPerSecond:
          trackingInfo.averageTransferRateBytesPerSecond,
        transferDurationMs: trackingInfo.transferDurationMs,
      });
    } catch (loggingError) {
      serviceHardwareUtils.hardwareLog(
        'completeUpdateWorkflow logging ERROR',
        loggingError,
      );
    }
  }

  async failUpdateWorkflow({
    params,
    error,
  }: {
    params: IUpdateFirmwareWorkflowParams;
    error: unknown;
  }) {
    const err = toPlainErrorObject(error as any);
    const displayError = toUserFacingFirmwareUpdateError(err);
    const failureType = classifyFirmwareUpdateFailure(err);
    const updateFirmwareInfo = params.releaseResult.updateInfos?.firmware;

    serviceHardwareUtils.hardwareLog('startUpdateWorkflow ERROR', error);
    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.error,
      payload: {
        error: displayError,
      },
    });

    try {
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
    } catch (toastError) {
      serviceHardwareUtils.hardwareLog(
        'failUpdateWorkflow toast ERROR',
        toastError,
      );
    }

    try {
      const hardwareTransportType = await this.getUpdateWorkflowTransportType();
      const trackingInfo = await this.getUpdateWorkflowTrackingInfo();
      const resultFailureType =
        failureType === 'cancelled'
          ? trackingInfo.lastFailureType
          : failureType;
      if (!resultFailureType || resultFailureType === 'cancelled') {
        return;
      }

      defaultLogger.update.firmware.firmwareUpdateResult({
        deviceType: params.releaseResult.deviceType,
        transportType: hardwareTransportType,
        updateFlow: 'v2',
        firmwareVersions: parseFirmwareVersions(params.releaseResult),
        fromFirmwareType: updateFirmwareInfo?.fromFirmwareType,
        toFirmwareType: updateFirmwareInfo?.toFirmwareType,
        status: 'failed',
        failureType: resultFailureType,
        errorCode:
          failureType === 'cancelled'
            ? trackingInfo.lastErrorCode
            : resolveFirmwareUpdateErrorCode(err),
        retryCount: trackingInfo.retryCount,
        totalDurationMs: trackingInfo.totalDurationMs,
        transferredBytes: trackingInfo.transferredBytes,
        totalBytes: trackingInfo.totalBytes,
        averageTransferRateBytesPerSecond:
          trackingInfo.averageTransferRateBytesPerSecond,
        transferDurationMs: trackingInfo.transferDurationMs,
      });
    } catch (loggingError) {
      serviceHardwareUtils.hardwareLog(
        'failUpdateWorkflow logging ERROR',
        loggingError,
      );
    }
  }

  private async setFirmwareArtifactDownloadState(
    isDownloadingArtifacts: boolean,
  ) {
    const stepInfo = await firmwareUpdateStepInfoAtom.get();
    if (stepInfo.step !== EFirmwareUpdateSteps.updateStart) {
      return;
    }
    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.updateStart,
      payload: {
        ...stepInfo.payload,
        isDownloadingArtifacts,
      },
    });
  }

  async runUpdateWorkflowV2(
    params: IUpdateFirmwareWorkflowParams,
    workflowId: number,
  ) {
    try {
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          let shouldClearForceTransportType = false;

          try {
            appEventBus.emit(EAppEventBusNames.BeginFirmwareUpdate, undefined);
            // await other hardware task stop processing
            await timerUtils.wait(3000);

            // Desktop firmware updates must use the same USB-only product flow as x.
            // Resolve again at execution time so Pro2 and Neo cannot retain a BLE route.
            let currentTransportType = await this.getActiveTransportType();
            if (platformEnv.isDesktop) {
              const resolvedTransport =
                await this.backgroundApi.serviceHardware.resolveHardwareTransport(
                  {
                    connectId:
                      params.releaseResult.originalConnectId ??
                      params.releaseResult.updatingConnectId,
                    hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
                  },
                );
              currentTransportType = resolvedTransport.transportType;
              params.releaseResult.updatingConnectId =
                deviceUtils.getUpdatingConnectId({
                  connectId: resolvedTransport.connectId,
                  currentTransportType,
                });
              if (
                currentTransportType === EHardwareTransportType.DesktopWebBle
              ) {
                throw new OneKeyLocalError(
                  'Desktop firmware updates require a USB transport',
                );
              }
            }
            this.recordUpdateWorkflowTransportType(
              workflowId,
              currentTransportType,
            );
            defaultLogger.update.firmware.firmwareUpdateStarted({
              deviceType: params.releaseResult.deviceType,
              transportType: currentTransportType,
              updateFlow: 'v2',
              firmwareVersions: parseFirmwareVersions(params.releaseResult),
            });
            await this.backgroundApi.serviceHardware.setForceTransportType({
              forceTransportType: currentTransportType,
            });
            shouldClearForceTransportType = true;
            serviceHardwareUtils.hardwareLog(
              'startUpdateWorkflowV2: locked transport type',
              currentTransportType,
            );

            // pre checking
            await this.validateMnemonicBackuped(params);
            await this.validateUSBConnection(params);
            // must before validateMinVersionAllowed, go to https://help.onekey.so/
            await this.validateShouldUpdateFullResource(params);
            // go to https://firmware.onekey.so/
            await this.validateMinVersionAllowed(params);
            await this.validateDeviceBattery(params);
            await this.validateShouldUpdateBridge(params);

            await this.setFirmwareArtifactDownloadState(true);
            try {
              const runtimeHost = await this.getFirmwareUpdateRuntimeHost();
              await runtimeHost.artifacts.withWorkflowArtifacts(
                params.releaseResult,
                async (firmwareArtifacts) => {
                  await this.setFirmwareArtifactDownloadState(false);
                  // ** clear all retry tasks
                  await this.updateTasksClear('startUpdateWorkflow');

                  await this.cancelUpdateWorkflowIfExit();

                  const deviceType = params?.releaseResult?.deviceType;
                  if (!supportsFirmwareUpdateWorkflowV2(deviceType)) {
                    serviceHardwareUtils.hardwareLog(
                      'startUpdateWorkflowV2: unsupported device type',
                      {
                        deviceType: deviceType ?? 'unknown',
                        isProtocolV2Product:
                          isProtocolV2ProductType(deviceType),
                      },
                    );
                    throw new OneKeyLocalError(
                      'Do not support update firmware for this device',
                    );
                  }
                  const updateResult =
                    await this.startUpdateFirmwareTaskForNewBootVersion(
                      params,
                      firmwareArtifacts,
                    );
                  console.log(
                    'startUpdateFirmwareTaskForNewBootVersion result: ===> ',
                    updateResult,
                  );

                  serviceHardwareUtils.hardwareLog(
                    'startUpdateWorkflow DONE',
                    params,
                  );

                  await firmwareUpdateRetryAtom.set(undefined);
                  if (params.releaseResult.originalConnectId) {
                    await this.waitDeviceRestart({
                      actionType: 'done',
                      releaseResult: params.releaseResult,
                    });
                    await this.deleteFirmwareUpdateDetectInfo(
                      params.releaseResult.originalConnectId,
                    );
                    await this.backgroundApi.serviceHardware.updateDeviceVersionAfterFirmwareUpdate(
                      params,
                    );
                    await this.clearOnceUpdateDevSettings();
                    appEventBus.emit(
                      EAppEventBusNames.FinishFirmwareUpdate,
                      undefined,
                    );
                  }
                  // wait verify
                  await timerUtils.wait(2000);
                },
              );
            } finally {
              await this.setFirmwareArtifactDownloadState(false);
            }
          } finally {
            if (shouldClearForceTransportType) {
              // Always clear transport type lock when firmware update completes
              await this.backgroundApi.serviceHardware.clearForceTransportType();
              serviceHardwareUtils.hardwareLog(
                'startUpdateWorkflowV2: cleared transport type lock',
              );
            }
          }
        },
        {
          deviceParams: {
            dbDevice: {} as any,
          },
          allowDuringFirmwareUpdate: true,
          skipDeviceCancel: true,
          hideCheckingDeviceLoading: true,
          debugMethodName: 'startUpdateWorkflowV2',
        },
      );
    } finally {
      // Reset workflow running state at service level to prevent lock-screen bypass
      await firmwareUpdateWorkflowRunningAtom.set(false);
    }
  }

  @backgroundMethod()
  async startUpdateWorkflowV2(
    params: IUpdateFirmwareWorkflowParams,
  ): Promise<IStartUpdateWorkflowV2Result> {
    const workflowId = this.resetUpdateWorkflowTracking({
      updateFlow: 'v2',
      releaseResult: params.releaseResult,
    });
    // Guard first, then silence — see startUpdateWorkflow. A silence that
    // fails must not leave the guard up: nothing below would run to drop it.
    // Unless a newer start has already taken the workflow over — the guard
    // is shared, and dropping it here would uncover THAT workflow's page.
    await firmwareUpdateWorkflowRunningAtom.set(true);
    try {
      await this.clearHardwareUiStateBeforeStartUpdateWorkflow();
    } catch (error) {
      if (this.isUpdateWorkflowCurrent(workflowId)) {
        await firmwareUpdateWorkflowRunningAtom.set(false);
      }
      throw error;
    }

    void (async () => {
      try {
        await this.runUpdateWorkflowV2(params, workflowId);
        await this.completeUpdateWorkflow({
          params,
        });
      } catch (error) {
        await this.failUpdateWorkflow({
          params,
          error,
        });
      }
    })().catch((error) => {
      serviceHardwareUtils.hardwareLog(
        'startUpdateWorkflowV2 background task handler ERROR',
        error,
      );
    });

    return { backgroundTaskStarted: true };
  }

  async startUpdateBootloaderTask(
    params: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ) {
    const firmwareUpdateInfo = params?.releaseResult?.updateInfos?.firmware;
    const firmwareToVersion = firmwareUpdateInfo?.toVersion;
    if (!firmwareUpdateInfo || !firmwareToVersion) {
      return;
    }
    const features =
      await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
        connectId: params.releaseResult.updatingConnectId,
        params: {
          allowEmptyConnectId: true,
        },
      });

    // TODO move to fn
    const releaseInfo = await this.loadBaseFirmwareRelease({
      connectId: params?.releaseResult?.updatingConnectId,
      firmwareType:
        params?.releaseResult?.updateInfos?.firmware?.toFirmwareType,
    });
    const updateInfo = await this.checkBootloaderRelease({
      features,
      connectId: params.releaseResult.updatingConnectId,
      firmwareUpdateInfo,
      bootloaderReleasePayload:
        releaseInfo.bootloader as unknown as IBootloaderReleasePayload,
    });
    // TODO mock boot re-update
    // if (release) {
    //   release.shouldUpdate = true;
    // }

    const mockUpdateBootloader =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBootloader',
      );
    // TODO check update version gt current version
    if (updateInfo?.hasUpgrade || mockUpdateBootloader) {
      return this.createRunTaskWithRetry({
        fn: async () =>
          this.updatingBootloader(params, updateInfo, firmwareArtifacts),
      });
    }
  }

  async startUpdateFirmwareTaskBase(
    params: IAutoUpdateFirmwareParams,
    updateInfo: IBleFirmwareUpdateInfo | IFirmwareUpdateInfo,
    workflowParams: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ) {
    return this.createRunTaskWithRetry({
      fn: async () =>
        this.updatingFirmware(
          params,
          updateInfo,
          workflowParams,
          firmwareArtifacts,
        ),
    });
  }

  createRunTaskWithRetry({ fn }: { fn: IUpdateFirmwareTaskFn }) {
    return new Promise((resolve, reject) => {
      const id = this.updateTasksAdd({ fn, reject, resolve });
      void this.runUpdateTask({ id });
    });
  }

  @backgroundMethod()
  async runUpdateTask({
    id,
    preFn,
  }: {
    id: number;
    preFn?: (params?: undefined) => Promise<void | undefined>;
  }): Promise<void> {
    const task = this.updateTasks[id];
    if (!task || !this.isUpdateWorkflowCurrent(task.workflowId)) {
      return;
    }

    try {
      await this.cancelUpdateWorkflowIfExit();
    } catch (error) {
      await this.updateTasksReject({ id, error });
      return;
    }

    try {
      await firmwareUpdateRetryAtom.set(undefined);

      await preFn?.();
      if (!this.isUpdateWorkflowCurrent(task.workflowId)) {
        return;
      }

      const result = await task.fn({ id });
      if (!this.isUpdateWorkflowCurrent(task.workflowId)) {
        return;
      }
      await this.updateTasksResolve({ id, data: result });
      serviceHardwareUtils.hardwareLog('runUpdateTask SUCCESS', result);
    } catch (error) {
      if (!this.isUpdateWorkflowCurrent(task.workflowId)) {
        return;
      }
      if (task.workflowId !== undefined) {
        this.recordUpdateWorkflowFailure(task.workflowId, error);
      }
      serviceHardwareUtils.hardwareLog('startUpdateWorkflow ERROR', error);

      // never reject here, we should use retry
      // await servicePromise.rejectCallback({ id, error });
      const stepInfo = await firmwareUpdateStepInfoAtom.get();
      if (stepInfo.step === EFirmwareUpdateSteps.updateStart) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {},
        });
      }
      await firmwareUpdateRetryAtom.set({
        id,
        error: toUserFacingFirmwareUpdateError(
          toPlainErrorObject(error as any),
        ),
      });

      await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
        skipDeviceCancel: true,
        connectId: '',
      });

      // TODO hide deviceCheckingLoading and confirm dialog
    } finally {
      if (this.isUpdateWorkflowCurrent(task.workflowId)) {
        try {
          await this.cancelUpdateWorkflowIfExit();
          // Workflow is still alive (not exited by user), but in retry wait state
          // Allow lock screen since no active hardware communication is happening
          const retryInfo = await firmwareUpdateRetryAtom.get();
          if (retryInfo) {
            await firmwareUpdateWorkflowRunningAtom.set(false);
          }
        } catch (error2) {
          await this.updateTasksReject({ id, error: error2 });
        }
      }
    }
  }

  @backgroundMethod()
  async retryUpdateTask({
    id,
    connectId,
    releaseResult,
  }: {
    id: number;
    // TODO put connectId to updateTasks
    connectId: string | undefined;
    releaseResult: ICheckAllFirmwareReleaseResult | undefined;
  }) {
    const task = this.updateTasks[id];
    if (!task || !this.isUpdateWorkflowCurrent(task.workflowId)) {
      return;
    }
    if (task.workflowId !== undefined) {
      this.recordUpdateWorkflowRetry(task.workflowId);
    }

    // Re-block lock screen before resuming hardware communication. Guard
    // first, then silence (see startUpdateWorkflow) — and a silence that
    // fails must not leave the guard, and with it the blocked lock screen,
    // up for the rest of the session. Dropped only while this workflow is
    // still the current one: a newer start owns the shared guard by then.
    await firmwareUpdateWorkflowRunningAtom.set(true);
    try {
      await this.clearHardwareUiStateBeforeStartUpdateWorkflow();
    } catch (error) {
      if (this.isUpdateWorkflowCurrent(task.workflowId)) {
        await firmwareUpdateWorkflowRunningAtom.set(false);
      }
      throw error;
    }
    await firmwareUpdateRetryAtom.set(undefined);

    await this.waitDeviceRestart({
      releaseResult,
      actionType: 'retry',
    });

    await this.runUpdateTask({
      id,
      preFn: makeTimeoutPromise({
        asyncFunc: async () => {
          // make sure device is ready after reboot
          // TODO move to fn and re-checking release \ device \ version matched
          try {
            const features =
              await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
                connectId,
                params: {
                  allowEmptyConnectId: true,
                },
              });
            serviceHardwareUtils.hardwareLog('retryUpdateTask', {
              connectId,
              features,
            });
          } catch (error) {
            await firmwareUpdateStepInfoAtom.set({
              step: EFirmwareUpdateSteps.installing,
              payload: {
                installingTarget: {
                  totalPhase: releaseResult?.totalPhase,
                  currentPhase: '',
                  updateInfo: releaseResult?.updateInfos,
                } as any,
              },
            });
            throw error;
          }
        },
        timeout: timerUtils.getTimeDurationMs({
          // user may retry just when device reboot, getFeatures() will pending forever, so we need timeout reject, then user can see retry button
          seconds: 30,
        }),
        timeoutRejectError: new Error('Retry Timeout'),
      }),
    });
  }

  checkTouchNeedUpdateResource(
    params: IUpdateFirmwareWorkflowParams,
  ): IResourceUpdateInfo {
    const deviceType = params.releaseResult?.deviceType;
    const fwUpdateInfo = params.releaseResult?.updateInfos?.firmware;
    const fwRelease = fwUpdateInfo?.releasePayload?.release;
    if (fwRelease) {
      const { version, fullResourceRange = ['3.5.0', '3.5.0'] } = fwRelease;
      if (deviceType !== EDeviceType.Touch) {
        return { error: null, needUpdate: false };
      }
      const currentVersion = fwUpdateInfo.fromVersion;
      const targetVersion = version.join('.');
      const [minVersion, limitVersion] = fullResourceRange;
      if (
        currentVersion &&
        targetVersion &&
        minVersion &&
        limitVersion &&
        semver.lt(currentVersion, minVersion) &&
        semver.gte(targetVersion, limitVersion)
      ) {
        return {
          error: !platformEnv.isDesktop ? 'USE_DESKTOP' : null,
          needUpdate: true,
          minVersion,
          limitVersion,
        };
      }
    }

    return { error: null, needUpdate: false };
  }

  async startUpdateFirmwareTaskForNewBootVersion(
    params: IUpdateFirmwareWorkflowParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<IFirmwareUpdateResult> {
    const { releaseResult } = params;
    const { updateInfos } = releaseResult;
    // Keep the legacy field name while routing every Protocol V2 product through V4.
    const isPro2Device = isProtocolV2ProductType(releaseResult.deviceType);
    const plan = releaseResult.firmwareUpdatePlanDigest
      ? (await this.getFirmwareUpdateRuntimeHost()).artifacts.getPlan(
          releaseResult,
        )
      : undefined;
    if (isPro2Device && !plan) {
      throw new OneKeyLocalError(
        'Firmware update plan is required for Protocol V2 updates',
      );
    }
    const executor = plan?.executor ?? 'v3';

    const updateParams: IFirmwareUpdateV3VersionParams = {
      connectId: releaseResult.updatingConnectId,
      bleVersion: updateInfos.ble?.hasUpgrade
        ? updateInfos.ble?.toVersion
        : undefined,
      firmwareVersion: updateInfos.firmware?.hasUpgrade
        ? updateInfos.firmware?.toVersion
        : undefined,
      bootloaderVersion: updateInfos.bootloader?.hasUpgrade
        ? updateInfos.bootloader?.toVersion
        : undefined,
      firmwareType: updateInfos.firmware?.toFirmwareType,
      isPro2Device,
      pro2TargetsToUpdate: releaseResult.pro2TargetsToUpdate,
    };
    if (plan?.executor === 'v4') {
      const targetsToUpdate = (
        await loadFirmwareUpdateRuntime()
      ).getFirmwareUpdateV4Targets(plan.targetsToUpdate);
      return this.createRunTaskWithRetry({
        fn: async () =>
          this.updatingFirmwareV4(
            {
              ...updateParams,
              requirePreparedArtifacts: Boolean(
                platformEnv.isNative || platformEnv.isDesktop,
              ),
              targetsToUpdate,
            },
            firmwareArtifacts,
          ),
      }) as Promise<IFirmwareUpdateResult>;
    }
    if (executor !== 'v3') {
      throw new OneKeyLocalError(
        'Firmware update plan selected an incompatible executor',
      );
    }
    return this.createRunTaskWithRetry({
      fn: async () => this.updatingFirmwareV3(updateParams, firmwareArtifacts),
    }) as Promise<IFirmwareUpdateResult>;
  }

  async updatingFirmwareV4(
    params: IFirmwareUpdateV4AppParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<Success> {
    const preparedArtifactController = (
      await this.getFirmwareUpdateRuntimeHost()
    ).artifacts;
    const executionArtifacts = preparedArtifactController.getExecutionArtifacts(
      firmwareArtifacts,
      'firmwareUpdateV4',
    );
    const { assertFirmwareUpdateV4Artifacts, executePreparedFirmwareUpdateV4 } =
      await loadFirmwareUpdateRuntime();
    if (params.requirePreparedArtifacts) {
      assertFirmwareUpdateV4Artifacts(executionArtifacts);
    }
    const currentTransportType = await this.getActiveTransportType();
    const hardwareSDK = await this.getSDKInstance({
      connectId: params.connectId,
      hardwareTransportType: currentTransportType,
    });

    return this.withFirmwareUpdateEvents(async () => {
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {} as any,
        },
      });
      if (params.requirePreparedArtifacts) {
        assertFirmwareUpdateV4Artifacts(
          executionArtifacts,
          currentTransportType,
        );
      }
      const updatingConnectId = deviceUtils.getUpdatingConnectId({
        connectId: params.connectId,
        currentTransportType,
      });
      const [
        legacyForceResource,
        protocolV2ForceTargets,
        protocolV2ForceOnceTargets,
      ] = await Promise.all([
        this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'forceUpdateResEvenSameVersion',
        ),
        this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'pro2ForceUpdateTargets',
        ),
        this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'pro2ForceUpdateOnceTargets',
        ),
      ]);
      const forceUpdateResEvenIfSameVersion =
        shouldForceProtocolV2ResourceUpdate({
          targetsToUpdate: params.targetsToUpdate,
          legacyForceResource,
          forceTargets: protocolV2ForceTargets,
          forceOnceTargets: protocolV2ForceOnceTargets,
        });
      const updateResult = await convertDeviceResponse(() =>
        executePreparedFirmwareUpdateV4({
          sdk: hardwareSDK,
          connectId: updatingConnectId,
          ...executionArtifacts,
          platform: platformEnv.symbol ?? 'web',
          firmwareType: params.firmwareType,
          targetsToUpdate: params.targetsToUpdate,
          forcedUpdateRes: forceUpdateResEvenIfSameVersion,
        }),
      );

      await firmwareUpdateResultVerifyAtom.set({
        finalBleVersion: updateResult?.bleVersion || '',
        finalFirmwareVersion: updateResult?.firmwareVersion || '',
        finalBootloaderVersion: updateResult?.bootloaderVersion || '',
      });

      const versionMismatches: string[] = [];
      const verifyVersion = (
        expectedVersion: string | undefined,
        actualVersion: string | undefined,
      ) => {
        if (
          expectedVersion &&
          semver.valid(expectedVersion) &&
          (!actualVersion ||
            !semver.valid(actualVersion) ||
            !semver.eq(actualVersion, expectedVersion))
        ) {
          versionMismatches.push(expectedVersion);
        }
      };

      if (
        params.targetsToUpdate.some(
          (target) => target === 'app_v1' || target === 'app_v2',
        )
      ) {
        verifyVersion(params.firmwareVersion, updateResult?.firmwareVersion);
      }
      if (params.targetsToUpdate.includes('boot')) {
        verifyVersion(
          params.bootloaderVersion,
          updateResult?.bootloaderVersion,
        );
      }
      if (params.targetsToUpdate.includes('coprocessor')) {
        verifyVersion(params.bleVersion, updateResult?.bleVersion);
      }

      if (versionMismatches.length > 0) {
        throw new FirmwareUpdateVersionMismatchError();
      }

      return { message: 'success', ...updateResult };
    }, executionArtifacts);
  }

  async updatingFirmwareV3(
    params: IFirmwareUpdateV3VersionParams,
    firmwareArtifacts?: IFirmwareWorkflowArtifacts,
  ): Promise<Success> {
    const preparedArtifactController = (
      await this.getFirmwareUpdateRuntimeHost()
    ).artifacts;
    const executionArtifacts = preparedArtifactController.getExecutionArtifacts(
      firmwareArtifacts,
      'firmwareUpdateV3',
    );
    const { executePreparedFirmwareUpdateV3 } =
      await loadFirmwareUpdateRuntime();
    const currentTransportType = await this.getActiveTransportType();
    const hardwareSDK = await this.getSDKInstance({
      connectId: params.connectId,
      hardwareTransportType: currentTransportType,
    });

    return this.withFirmwareUpdateEvents(async () => {
      const { connectId } = params;
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {} as any,
        },
      });

      const convertVersion = (version?: string) => {
        if (version && semver.valid(version)) {
          return version.split('.').map((v) => parseInt(v, 10));
        }
        return undefined;
      };

      const toFirmwareVersion = convertVersion(params.firmwareVersion);
      const toBleVersion = convertVersion(params.bleVersion);
      const toBootloaderVersion = convertVersion(params.bootloaderVersion);
      const versionMismatches: string[] = [];
      const shouldVerifyFirmwareVersion =
        !params.isPro2Device ||
        !params.pro2TargetsToUpdate?.length ||
        params.pro2TargetsToUpdate.some((target) =>
          PRO2_APP_FIRMWARE_UPDATE_TARGETS.has(target),
        );

      try {
        const updatingConnectId = deviceUtils.getUpdatingConnectId({
          connectId,
          currentTransportType,
        });
        const updateResult = await convertDeviceResponse(() =>
          executePreparedFirmwareUpdateV3({
            sdk: hardwareSDK,
            connectId: updatingConnectId,
            ...executionArtifacts,
            platform: platformEnv.symbol ?? 'web',
            bleVersion: toBleVersion,
            firmwareVersion: toFirmwareVersion,
            bootloaderVersion: toBootloaderVersion,
            firmwareType: params.firmwareType,
          }),
        );

        // verify final version
        await firmwareUpdateResultVerifyAtom.set({
          finalBleVersion: updateResult?.bleVersion || '',
          finalFirmwareVersion: updateResult?.firmwareVersion || '',
          finalBootloaderVersion: updateResult?.bootloaderVersion || '',
        });

        const verifyVersion = (
          expectedVersionStr: string | undefined,
          actualVersionStr: string | undefined,
        ) => {
          if (expectedVersionStr && semver.valid(expectedVersionStr)) {
            if (
              !actualVersionStr ||
              !semver.valid(actualVersionStr) ||
              !semver.eq(actualVersionStr, expectedVersionStr)
            ) {
              versionMismatches.push(expectedVersionStr);
            }
          }
        };

        if (shouldVerifyFirmwareVersion) {
          verifyVersion(
            toFirmwareVersion?.join('.'),
            updateResult?.firmwareVersion,
          );
        }
        verifyVersion(toBleVersion?.join('.'), updateResult?.bleVersion);
        verifyVersion(
          toBootloaderVersion?.join('.'),
          updateResult?.bootloaderVersion,
        );

        // wait for 1.5s to verify
        await timerUtils.wait(1500);

        if (versionMismatches.length > 0) {
          throw new FirmwareUpdateVersionMismatchError();
        }

        return { message: 'success', ...updateResult };
      } catch (error) {
        console.log('updatingFirmwareV3 error: ', error);
        throw error;
      }
    }, executionArtifacts);
  }

  async validateShouldUpdateFullResource(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    const mockShouldUpdateFullRes =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'shouldUpdateFullRes',
      );
    if (
      mockShouldUpdateFullRes === true ||
      this.checkTouchNeedUpdateResource(params).needUpdate
    ) {
      throw new UseDesktopToUpdateFirmware();
    }
  }

  async validateShouldUpdateBridge(params: IUpdateFirmwareWorkflowParams) {
    if (params?.releaseResult?.updateInfos?.bridge?.shouldUpdate) {
      throw new NeedOneKeyBridgeUpgrade();
    }
  }

  async validateMinVersionAllowed(params: IUpdateFirmwareWorkflowParams) {
    const minVersionMap = FIRMWARE_UPDATE_MIN_VERSION_ALLOWED;

    const mockShouldUpdateFromWeb =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'shouldUpdateFromWeb',
      );

    if (mockShouldUpdateFromWeb === true) {
      throw new NeedFirmwareUpgradeFromWeb();
    }

    const deviceType = params.releaseResult?.deviceType;

    const checkFn = ({
      updateInfo,
      minVersion,
    }: {
      updateInfo: IFirmwareUpdateInfo | IBootloaderUpdateInfo | undefined;
      minVersion: string | undefined;
    }) => {
      if (
        deviceType &&
        updateInfo?.hasUpgrade &&
        updateInfo?.fromVersion &&
        minVersion &&
        semver.lt(updateInfo?.fromVersion || '', minVersion || '')
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
    };

    // bootloader mode device may return wrong firmware current version. so we skip this check
    if (params.releaseResult?.isBootloaderMode) {
      // only check bootloader version at boot mode
      checkFn({
        updateInfo: params.releaseResult?.updateInfos?.bootloader,
        minVersion: minVersionMap?.[deviceType || 'unknown']?.bootloader,
      });
      if (
        params.releaseResult?.updateInfos?.bootloader?.hasUpgrade &&
        !params.releaseResult?.updateInfos?.bootloader?.fromVersion
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
      return;
    }

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.firmware,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.firmware,
    });

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.ble,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.ble,
    });

    const updateDevDeviceBootloaderOnAppAllowed =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'updateDevDeviceBootloaderOnAppAllowed',
      );

    if (updateDevDeviceBootloaderOnAppAllowed !== true) {
      checkFn({
        updateInfo: params.releaseResult?.updateInfos?.bootloader,
        minVersion:
          minVersionMap?.[deviceType || 'unknown']?.bootloader || '2.0.0',
      });
    }
  }

  async validateMnemonicBackuped(params: IUpdateFirmwareWorkflowParams) {
    if (!params.backuped) {
      throw new OneKeyLocalError('mnemonic not backuped');
    }
  }

  async validateUSBConnection(params: IUpdateFirmwareWorkflowParams) {
    // TODO device is connected by USB
    if (!params.usbConnected) {
      throw new OneKeyLocalError('USB not connected');
    }
  }

  async validateDeviceBattery(params: IUpdateFirmwareWorkflowParams) {
    // USB connected, skip battery check
    if (!platformEnv.isNative) {
      return;
    }

    const { features: deviceFeatures } = params.releaseResult;

    const legacyDeviceFeatures = deviceFeatures as
      | (IOneKeyDeviceFeatures & {
          battery_level?: number;
        })
      | undefined;
    let batteryLevel: number | undefined = legacyDeviceFeatures?.battery_level;

    const mockLowBattery =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'lowBatteryLevel',
      );
    if (mockLowBattery === true) {
      batteryLevel = 1;
    }

    if (isNil(batteryLevel) || Number.isNaN(batteryLevel)) return;

    // <= 25%
    if (Number(batteryLevel ?? 0) <= FIRMWARE_UPDATE_MIN_BATTERY_LEVEL) {
      throw new FirmwareUpdateBatteryTooLow();
    }
  }
}

export default ServiceFirmwareUpdate;
