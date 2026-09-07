import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  isHardwareError,
  isHardwareErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { isLegacyHardwareUiActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';
import type {
  IDeviceSharedCallParams,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import type {
  IDeviceStageAuthChecklistItem,
  IDeviceStageAuthFailureReasonValue,
  IDeviceStageConfirmContent,
  IDeviceStageErrorReasonValue,
} from '@onekeyhq/shared/types/deviceStage';

import localDb from '../../dbs/local/localDb';
import {
  EHardwareUiStateAction,
  EThirdPartyHardwareUiAction,
  deviceStageAtom,
  firmwareUpdateWorkflowRunningAtom,
  hardwareUiStateAtom,
  thirdPartyAppInstallAtom,
  thirdPartyBatchInstallAtom,
  thirdPartyHardwareUiStateAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import {
  DeviceStageBurstScope,
  createLatestStateFeed,
} from './DeviceStageBurst';
import {
  HardwareProcessingManager,
  type IOneKeyHardwareOperationLease,
} from './HardwareProcessingManager';
import { buildPassphraseUiResponsePayload } from './passphraseUiResponseUtils';

import type { IDeviceStageBurstBeginParams } from './DeviceStageBurst';
import type { IDBDevice } from '../../dbs/local/types';
import type {
  IDeviceStageState,
  IHardwareUiPayload,
  IHardwareUiResponseCorrelation,
  IThirdPartyHardwareUiState,
} from '../../states/jotai/atoms';
import type { IDeviceType, UiResponseEvent } from '@onekeyfe/hd-core';

export type IWithHardwareProcessingControlParams = {
  allowDuringFirmwareUpdate?: boolean;
  hideCheckingDeviceLoading?: boolean;
  skipDeviceCancel?: boolean; // cancel device at end
  skipCloseHardwareUiStateDialog?: boolean; // close state dialog at end
  skipDeviceCancelAtFirst?: boolean;
  skipWaitingAnimationAtFirst?: boolean;
};

export type IWithHardwareProcessingOptions = {
  deviceParams: IDeviceSharedCallParams | undefined;
  debugMethodName?: string;
  oneKeyOperationLease?: IOneKeyHardwareOperationLease;
  onFinally?: () => void;
  /** DeviceStage confirm channel (OK-59934): what the confirm card shows
   * when this operation asks for a device confirmation. */
  stageConfirmContent?: IDeviceStageConfirmContent;
} & IWithHardwareProcessingControlParams;

export type ICloseHardwareUiStateDialogParams = {
  skipDeviceCancel?: boolean;
  immediateDeviceCancel?: boolean;
  delay?: number;
  connectId: string | undefined;
  walletId?: string;
  reason?: string;
  deviceResetToHome?: boolean;
  hardClose?: boolean; // hard close dialog by event bus
  skipDelayClose?: boolean;
  deviceType?: string;
};

const HARDWARE_CONNECTION_CANCEL_SKIP_CODES = [
  HardwareErrorCode.DeviceNotFound,
  HardwareErrorCode.BleScanError,
  HardwareErrorCode.BlePermissionError,
  HardwareErrorCode.BleLocationError,
  HardwareErrorCode.BleRequiredUUID,
  HardwareErrorCode.BleConnectedError,
  HardwareErrorCode.PollingTimeout,
  HardwareErrorCode.BleDeviceNotBonded,
  HardwareErrorCode.BleServiceNotFound,
  HardwareErrorCode.BleCharacteristicNotFound,
  HardwareErrorCode.BleMonitorError,
  HardwareErrorCode.BleCharacteristicNotifyError,
  HardwareErrorCode.BleWriteCharacteristicError,
  HardwareErrorCode.BleAlreadyConnected,
  HardwareErrorCode.BleLocationServicesDisabled,
  HardwareErrorCode.BleTimeoutError,
  HardwareErrorCode.BleForceCleanRunPromise,
  HardwareErrorCode.BleDeviceBondError,
  HardwareErrorCode.BlePeerRemovedPairingInformation,
  HardwareErrorCode.BleBondInvalid,
  HardwareErrorCode.BleUnavailableWhileUsbConnected,
  HardwareErrorCode.BleCharacteristicNotifyChangeFailure,
  HardwareErrorCode.BleDeviceDisconnected,
  HardwareErrorCode.BlePoweredOff,
  HardwareErrorCode.BleUnsupported,
];

/** Stands in for the confirm payload in logs: its rows carry signature
 * plaintext (personal-sign text, typed-data JSON, transfer amounts), which
 * must never reach a log line — only whether a payload was registered. */
const DEVICE_STAGE_CONFIRM_CONTENT_REDACTED: IDeviceStageConfirmContent = {
  description: '[stageConfirmContent redacted]',
};

@backgroundClass()
class ServiceHardwareUI extends ServiceBase {
  private deviceCacheByConnectId: Map<string, IDBDevice> = new Map();

  private firmwareUpdateExclusiveDepth = 0;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // This service caches `connectId -> IDBDevice` for hardware interaction dialogs.
    // Clear cached dialogs after device state changes so labels cannot become stale.
    appEventBus.on(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      this.onHardwareDeviceStateUpdate,
    );
    // Third-party hardware remains driven by each SDK's features events.
    appEventBus.on(
      EAppEventBusNames.HardwareFeaturesUpdate,
      this.onThirdPartyHardwareFeaturesUpdate,
    );
    // OK-59934: one choke point feeds the third-party rail into the
    // DeviceStage burst scope — the adapters' many atom write sites stay
    // untouched. The combined read keeps install state and ui state from
    // racing each other, and the feed runs one read at a time (latest
    // state wins) so the three subscriptions below cannot interleave a
    // stale prompt over the clear that followed it.
    const feedThirdPartyStage = createLatestStateFeed(async () => {
      const [ui, install, batch] = await Promise.all([
        thirdPartyHardwareUiStateAtom.get(),
        thirdPartyAppInstallAtom.get(),
        thirdPartyBatchInstallAtom.get(),
      ]);
      await this.deviceStageBurst.onThirdPartyState({ ui, install, batch });
    });
    thirdPartyHardwareUiStateAtom.sub(feedThirdPartyStage);
    thirdPartyAppInstallAtom.sub(feedThirdPartyStage);
    thirdPartyBatchInstallAtom.sub(feedThirdPartyStage);
  }

  hardwareProcessingManager = new HardwareProcessingManager();

  /** OK-59934: the DeviceStage burst scope — owns every deviceStageAtom
   * write. See DeviceStageBurst.ts. */
  deviceStageBurst = new DeviceStageBurstScope({
    // Backs end()'s disconnect fallback: tracker verdict plus a WebUSB
    // re-enumeration, so a cleared tracker (SDK reset) is not mistaken
    // for an unplug.
    isDeviceStillConnected: (connectId) =>
      this.backgroundApi.serviceHardware.isHardwareDeviceConnected({
        connectId,
      }),
  });

  private onHardwareDeviceStateUpdate = async ({
    connectId,
    state,
  }: IAppEventBusPayload[EAppEventBusNames.HardwareDeviceStateUpdate]) => {
    try {
      // Delete from cache first to avoid a race where a new interaction immediately reads stale cache.
      for (const [
        cachedConnectId,
        cached,
      ] of this.deviceCacheByConnectId.entries()) {
        if (
          cached?.deviceId === state.identity.deviceId ||
          cached?.uuid === state.identity.serialNo
        ) {
          this.deviceCacheByConnectId.delete(cachedConnectId);
        }
      }
      if (connectId) this.deviceCacheByConnectId.delete(connectId);
    } catch {
      // Best-effort: this event is only for UI consistency. Clear cache on any error.
      this.deviceCacheByConnectId.clear();
    }
  };

  private onThirdPartyHardwareFeaturesUpdate = async ({
    deviceId,
  }: IAppEventBusPayload[EAppEventBusNames.HardwareFeaturesUpdate]) => {
    try {
      const device = await localDb.getDevice(deviceId);
      if (device?.connectId) {
        this.deviceCacheByConnectId.delete(device.connectId);
      } else {
        this.deviceCacheByConnectId.clear();
      }
    } catch {
      this.deviceCacheByConnectId.clear();
    }
  };

  @backgroundMethod()
  async sendUiResponse(response: UiResponseEvent) {
    return this.backgroundApi.serviceHardware.sendUiResponseToActiveSdk(
      response,
    );
  }

  @backgroundMethod()
  async showConfirmOnDeviceToastDemo({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId,
      payload: {
        deviceType: EDeviceType.Classic,
        uiRequestType: EHardwareUiStateAction.REQUEST_BUTTON,
        eventType: '',
        deviceId: '',
        connectId,
        rawPayload: {},
        deviceMode: EOneKeyDeviceMode.normal,
      },
    });
  }

  private async getDeviceCached(
    connectId: string,
  ): Promise<IDBDevice | undefined> {
    const cached = this.deviceCacheByConnectId.get(connectId);
    if (cached) {
      return cached;
    }
    const device =
      await this.backgroundApi.serviceHardware.getDeviceByConnectId({
        connectId,
      });
    if (device) {
      this.deviceCacheByConnectId.set(connectId, device);
    }
    return device;
  }

  private async updateDialogWithDeviceInfo({
    action,
    connectId,
  }: {
    action: EHardwareUiStateAction;
    connectId: string;
  }) {
    try {
      const device = await this.getDeviceCached(connectId);
      if (!device) {
        return;
      }
      // The stage opens on these beats before anything has named the
      // device — this lookup is where the model and name first exist, so
      // the replica and its label arrive with it. Fed ahead of the guard
      // below, which is about the legacy atom's own staleness, not the
      // stage's (OK-59934).
      void this.deviceStageBurst.mergeDeviceIdentity({
        connectId,
        deviceType: device.deviceType,
        deviceName: deviceUtils.buildDeviceStageName({
          features: device.featuresInfo,
          fallbackName: device.name,
        }),
      });
      const currentState = await hardwareUiStateAtom.get();
      if (
        currentState?.action !== action ||
        currentState?.connectId !== connectId
      ) {
        return;
      }
      await hardwareUiStateAtom.set({
        action,
        connectId,
        payload: {
          uiRequestType: action,
          eventType: '',
          deviceType: device.deviceType,
          deviceId: device.deviceId ?? '',
          connectId,
          deviceMode: EOneKeyDeviceMode.normal,
          rawPayload: {
            features: device.featuresInfo,
          },
        },
      });
    } catch {
      // ignore error, device info is optional for display
    }
  }

  @backgroundMethod()
  async showCheckingDeviceDialog({
    connectId,
    deviceType,
    deviceName,
  }: {
    connectId: string;
    /** What the caller already knows about the device. A scan result
     * carries both, and this beat is the stage's opening one — without
     * them the capsule would stand there nameless until something else
     * named the device (OK-59934). */
    deviceType?: IDeviceType;
    deviceName?: string;
  }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId,
      payload: undefined,
    });
    if (connectId) {
      void this.updateDialogWithDeviceInfo({
        action: EHardwareUiStateAction.DeviceChecking,
        connectId,
      });
    }
    void this.deviceStageBurst.noteStep('connecting', {
      connectId,
      deviceType: await this.resolveDeviceTypeForStage({
        deviceType,
        deviceName,
      }),
      deviceName,
    });
  }

  /**
   * The model behind a beat that only knows a name. A OneKey advertises
   * its model in its Bluetooth name ("Pro2 8650"), which is the only
   * identity available while onboarding a device the database has never
   * seen — the case where waiting for a lookup means no replica at all.
   */
  private async resolveDeviceTypeForStage({
    deviceType,
    deviceName,
  }: {
    deviceType?: IDeviceType;
    deviceName?: string;
  }): Promise<IDeviceType | undefined> {
    if (deviceType && deviceType !== EDeviceType.Unknown) {
      return deviceType;
    }
    if (!deviceName) {
      return deviceType;
    }
    try {
      const { getDeviceTypeByBleName } = await CoreSDKLoader();
      const derived = getDeviceTypeByBleName(deviceName);
      return derived && derived !== EDeviceType.Unknown ? derived : deviceType;
    } catch {
      return deviceType;
    }
  }

  @backgroundMethod()
  async showDeviceProcessLoadingDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.ProcessLoading,
      connectId,
      payload: undefined,
    });
    if (connectId) {
      void this.updateDialogWithDeviceInfo({
        action: EHardwareUiStateAction.ProcessLoading,
        connectId,
      });
    }
    void this.deviceStageBurst.noteStep('processing', { connectId });
    // wait animation done
    await timerUtils.wait(150);
  }

  @backgroundMethod()
  async showBluetoothDevicePairingDialog({
    device,
    features,
    deviceId,
    usbConnectId,
    promiseId,
  }: {
    device: IDBDevice;
    features: IOneKeyDeviceFeatures | undefined;
    deviceId: string;
    usbConnectId: string;
    promiseId?: number;
  }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId: usbConnectId,
      payload: {
        uiRequestType: EHardwareUiStateAction.DeviceChecking,
        eventType: EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING,
        deviceType: device.deviceType,
        deviceId,
        connectId: usbConnectId,
        deviceMode: EOneKeyDeviceMode.normal,
        promiseId: promiseId?.toString(),
        rawPayload: { deviceId, usbConnectId, features },
      },
    });
  }

  @backgroundMethod()
  async showEnterPassphraseOnDeviceDialog({
    responseCorrelation,
  }: {
    responseCorrelation?: IHardwareUiResponseCorrelation;
  } = {}) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: buildPassphraseUiResponsePayload({ mode: 'device' }),
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async showEnterAttachPinOnDeviceDialog({
    responseCorrelation,
  }: {
    responseCorrelation?: IHardwareUiResponseCorrelation;
  } = {}) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: buildPassphraseUiResponsePayload({ mode: 'attach-pin' }),
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async sendPinToDevice({
    pin,
    responseCorrelation,
  }: {
    pin: string;
    responseCorrelation?: IHardwareUiResponseCorrelation;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: pin,
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async sendPassphraseToDevice({
    passphrase,
    responseCorrelation,
  }: {
    passphrase: string;
    responseCorrelation?: IHardwareUiResponseCorrelation;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: buildPassphraseUiResponsePayload({ mode: 'host', passphrase }),
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async showEnterPinOnDevice({
    responseCorrelation,
  }: {
    responseCorrelation?: IHardwareUiResponseCorrelation;
  } = {}) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async sendEnterPinOnDeviceEvent({
    connectId,
    payload,
  }: {
    connectId: string;
    payload: IHardwareUiPayload | undefined;
  }) {
    await this.showEnterPinOnDevice({
      responseCorrelation: payload?.uiResponseCorrelation,
    });

    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.EnterPinOnDevice,
      connectId,
      payload,
    });
    void this.deviceStageBurst.noteStep('enterPin', { connectId, payload });
  }

  @backgroundMethod()
  async sendRequestDeviceInBootloaderForWebDevice({
    deviceId,
  }: {
    deviceId: string;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.SELECT_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE,
      payload: {
        deviceId,
      },
    });
  }

  @backgroundMethod()
  async sendRequestDeviceForSwitchFirmwareWebDevice({
    deviceId,
  }: {
    deviceId: string;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.SELECT_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE,
      payload: {
        deviceId,
      },
    });
  }

  @backgroundMethod()
  async cleanHardwareUiState({
    hardClose,
  }: {
    hardClose?: boolean; // hard close dialog by event bus
  } = {}) {
    await hardwareUiStateAtom.set(undefined);
    if (hardClose) {
      // atom some times not work, emit event to hard close dialog
      appEventBus.emit(
        EAppEventBusNames.HardCloseHardwareUiStateDialog,
        undefined,
      );
    }
  }

  // ----- DeviceStage (OK-59934) driver APIs ------------------------------

  /** The firmware workflow is taking the screen: the stage leaves (see
   * DeviceStageBurst.silenceForFirmwareWorkflow) and so does any air-gap
   * scan it was hosting — the stage was that scan's only surface, and a
   * pending scan left behind would wait invisibly for its 30-minute expiry
   * while the update page ran. Rejected the way a user close rejects it;
   * a no-op without a session. */
  async silenceDeviceStageForFirmwareWorkflow() {
    const stepAtSilence = (await deviceStageAtom.get())?.step;
    await this.deviceStageBurst.silenceForFirmwareWorkflow();
    await this.backgroundApi.serviceQrWallet.cancelStageAirGapScan({
      scanning: stepAtSilence === 'scanQr',
    });
  }

  /** The stage's half of a connect abandoned before any burst began (a
   * bootloader hand-off, a failed connect): see DeviceStageBurst.dismissUnowned. */
  @backgroundMethod()
  async deviceStageDismissUnowned() {
    await this.deviceStageBurst.dismissUnowned();
  }

  @backgroundMethod()
  async deviceStageNoteInputSubmitted() {
    await this.deviceStageBurst.noteInputSubmitted();
  }

  /**
   * Lands an error outcome on the stage from a UI-side runner (the
   * authenticity check above all) — for failures that are not the run's
   * own verdict, like a wrong PIN at the unlock that precedes it.
   */
  @backgroundMethod()
  async deviceStageNoteError({
    connectId,
    errorReason,
  }: {
    connectId?: string;
    errorReason?: IDeviceStageErrorReasonValue;
  }) {
    await this.deviceStageBurst.noteStep('error', { connectId, errorReason });
  }

  /** The hidden-wallet teach card was read: on to the entry. The card's
   * shortcut preference is written by the driver, which owns that atom. */
  @backgroundMethod()
  async deviceStagePassphraseIntroContinue() {
    await this.deviceStageBurst.notePassphraseIntroDone();
  }

  /**
   * Puts the passphrase teach card on stage BEFORE the device flow
   * starts (v6.5.2's order: teach, then touch the hardware). The caller
   * holds a UI burst around it, waits for the card's Continue, and only
   * then begins the hardware call — the account selector's deliberate
   * Add-hidden-wallet is the one place that teaches.
   */
  @backgroundMethod()
  async deviceStageShowPassphraseIntro(params: {
    connectId?: string;
    deviceType?: IDeviceStageState['deviceType'];
    deviceName?: string;
  }) {
    await this.deviceStageBurst.noteStep('passphraseIntro', {
      connectId: params.connectId,
      deviceType: params.deviceType,
      deviceName: params.deviceName,
      passphraseMode: 'create',
    });
  }

  /**
   * The authenticity flow's beats, fed by whoever runs the check (the
   * verification sequence lives UI-side, where its result contract is
   * consumed). The checklist rides along and survives the whole run.
   */
  @backgroundMethod()
  async deviceStageNoteAuthStep(params: {
    step: 'genuineCheck' | 'authVerifying' | 'authSuccess' | 'authFailure';
    connectId?: string;
    checklist?: IDeviceStageAuthChecklistItem[];
    failureReason?: IDeviceStageAuthFailureReasonValue;
    /** Fallback detail (v6.5.0 dialog parity): display-ready message
     * shown in place of the generic title, code as a title suffix. */
    failureMessage?: string;
    failureCode?: string;
  }) {
    await this.deviceStageBurst.noteStep(params.step, {
      connectId: params.connectId,
      authChecklist: params.checklist,
      authFailureReason: params.failureReason,
      authFailureMessage: params.failureMessage,
      authFailureCode: params.failureCode,
    });
  }

  /**
   * Opens a UI-held burst for a whole flow (onboarding above all): every
   * wrapper that runs inside it joins by depth, so the stage stays put
   * across the seams instead of closing and reopening. The returned token
   * closes it — see deviceStageEndBurst.
   */
  @backgroundMethod()
  async deviceStageBeginBurst(
    params: IDeviceStageBurstBeginParams & { reuseToken?: number } = {},
  ) {
    return this.deviceStageBurst.beginExplicit(params);
  }

  @backgroundMethod()
  async deviceStageEndBurst(params: { token: number; error?: unknown }) {
    await this.deviceStageBurst.endExplicit(params);
  }

  /**
   * Depth-stacked hold for a UI runner that brackets one async narrative
   * in try/finally (the authenticity check above all). Unlike the token
   * API it joins an outer holder's burst instead of superseding it, so a
   * flow-held burst around the runner keeps its own close.
   */
  @backgroundMethod()
  async deviceStageJoinBurst(params: IDeviceStageBurstBeginParams = {}) {
    await this.deviceStageBurst.begin(params);
  }

  @backgroundMethod()
  async deviceStageLeaveBurst(params: { error?: unknown } = {}) {
    await this.deviceStageBurst.end(params);
  }

  /** The authenticity failure card's "Continue anyway" — the verdict is
   * taken, the narrative retires, the stage falls back to the flow. */
  @backgroundMethod()
  async deviceStageNoteAuthResolved() {
    await this.deviceStageBurst.noteAuthNarrativeResolved();
  }

  /** The showQr card's Next: the person watched the device show its
   * answer code — on to the in-card camera (doc §4.6). */
  @backgroundMethod()
  async deviceStageQrProceedToScan() {
    await this.deviceStageBurst.qrProceedToScan();
  }

  /** The scanQr card's way back: re-present the code (never a reject —
   * the legacy skipReject crossing, in stage form). */
  @backgroundMethod()
  async deviceStageQrBackToShow() {
    await this.deviceStageBurst.qrBackToShow();
  }

  /** Confirm channel: UI-side registration for callers that know the
   * confirm payload before (or while) the hardware call runs. */
  @backgroundMethod()
  async deviceStageRegisterConfirmContent({
    content,
  }: {
    content: IDeviceStageConfirmContent | undefined;
  }) {
    await this.deviceStageBurst.registerConfirmContent(content);
  }

  @backgroundMethod()
  async deviceStageUserClose({
    connectId,
    skipDeviceCancel,
  }: {
    connectId?: string;
    skipDeviceCancel?: boolean;
  }) {
    // Read before the close settles the atom at off: which cancel a
    // dismissed air-gap step maps to depends on where the person was.
    const stepAtClose = (await deviceStageAtom.get())?.step;
    const qrStepAtClose = stepAtClose === 'showQr' || stepAtClose === 'scanQr';
    await this.deviceStageBurst.userClose();
    // Unconditional, keyed to session existence (a no-op without one):
    // a pending air-gap scan must reject on ANY stage close, even where
    // something repainted the QR pair before the person closed — keying
    // on the painted step alone would strand the bg promise until the
    // 30-minute expiry, holding the flow (and, for wrapped flows, the
    // global hardware semaphore) the whole time. The step only picks
    // which legacy cancel the reject speaks.
    await this.backgroundApi.serviceQrWallet.cancelStageAirGapScan({
      scanning: stepAtClose === 'scanQr',
    });
    // Same announcement the legacy dialog made on a user close: pages
    // holding state for the interaction (address verify, a running
    // authenticity check) stand down with it.
    appEventBus.emit(
      EAppEventBusNames.CloseHardwareUiStateDialogManually,
      undefined,
    );
    // Cancel semantics: same path the legacy dialog's user-close takes.
    // An air-gap step forces the device half off: there is no device
    // call to cancel, and a connectId-less sdk.cancel is a GLOBAL one —
    // it would cold-boot the SDK and interrupt every queued call on
    // every connected device (the legacy toast close touched nothing).
    // The same goes for a stage that never learned its device — a UI hold
    // closed before the search resolved, the opening beat of a scan: with
    // no connectId there is nothing to cancel BY, so the device half is
    // skipped rather than let the missing id fall through to that global
    // cancel.
    await this.closeHardwareUiStateDialogFn({
      connectId,
      skipDeviceCancel:
        qrStepAtClose || !connectId ? true : (skipDeviceCancel ?? false),
      immediateDeviceCancel: true,
      reason: 'DeviceStage userClose',
    });
  }

  /**
   * Demo driver (Gallery): plays realistic burst scripts against the real
   * burst scope, so the stage, the container, and the one-entrance-one-exit
   * rule can be verified without hardware. Interactive steps wait for the
   * real user input on the stage (PIN submit → processing).
   */
  @backgroundMethod()
  async demoDeviceStageBurst({
    scenario,
  }: {
    scenario:
      | 'sign'
      | 'signOnDevice'
      | 'reject'
      | 'disconnect'
      | 'trezorSign'
      | 'ledgerInstall';
  }) {
    const scope = this.deviceStageBurst;
    const connectId = 'demo-device-stage';
    const isOnDevice = scenario === 'signOnDevice';
    const isTrezor = scenario === 'trezorSign';
    const isLedger = scenario === 'ledgerInstall';
    const demoVendor = (() => {
      if (isTrezor) return EHardwareVendor.trezor;
      if (isLedger) return EHardwareVendor.ledger;
      return undefined;
    })();
    const deviceType = isOnDevice ? EDeviceType.Pro2 : EDeviceType.Classic;
    const makePayload = (uiRequestType: string): IHardwareUiPayload => ({
      uiRequestType,
      eventType: '',
      deviceType,
      deviceId: 'demo-device-id',
      connectId,
      deviceMode: EOneKeyDeviceMode.normal,
      rawPayload: {},
    });
    const feed = (action: EHardwareUiStateAction) =>
      scope.onHardwareUiEvent({
        action,
        connectId,
        payload: makePayload(action),
      });
    const feedCallEnd = () =>
      scope.onHardwareUiEvent({
        action: EHardwareUiStateAction.CLOSE_UI_WINDOW,
        connectId,
        shouldClearUiState: true,
      });
    const feedThirdParty = (
      action: EThirdPartyHardwareUiAction,
      payload?: IThirdPartyHardwareUiState['payload'],
    ) =>
      scope.onThirdPartyState({
        ui: demoVendor
          ? { action, vendor: demoVendor, ...(payload ? { payload } : {}) }
          : undefined,
        install: undefined,
        batch: undefined,
      });
    const feedThirdPartyInstall = (progress?: number) =>
      scope.onThirdPartyState({
        ui: undefined,
        install: demoVendor
          ? {
              vendor: demoVendor,
              appName: 'Ethereum',
              ...(progress === undefined ? {} : { progress }),
            }
          : undefined,
        batch: undefined,
      });
    const feedThirdPartyClear = () =>
      scope.onThirdPartyState({
        ui: undefined,
        install: undefined,
        batch: undefined,
      });
    const waitForStep = async (
      step: string,
      { timeoutMs = 60_000 }: { timeoutMs?: number } = {},
    ) => {
      const startedAt = Date.now();
      for (;;) {
        const state = await deviceStageAtom.get();
        if (state?.step === step) {
          return true;
        }
        if (state?.step === 'off' || Date.now() - startedAt > timeoutMs) {
          return false;
        }
        await timerUtils.wait(200);
      }
    };
    const demoConfirmDetails = [
      {
        label: 'Address',
        value: '0x627Ddbef61C811af05288Cd79db324fCac914AeF',
        highlightEnds: true,
      },
      { label: 'Amount', value: '0.05 ETH' },
      { label: 'Fee', value: '0.00042 ETH' },
    ];

    const demoDeviceName = (() => {
      if (isTrezor) return 'Trezor Safe 7';
      if (isLedger) return 'Ledger Nano X';
      return isOnDevice ? 'Pro2 6136' : 'OneKey Classic (demo)';
    })();
    const demoVendorModel = (() => {
      if (isTrezor) return 'T3W1';
      if (isLedger) return 'nanoX';
      return undefined;
    })();
    const demoVendorModelName = (() => {
      if (isTrezor) return 'Safe 7';
      if (isLedger) return 'Nano X';
      return undefined;
    })();
    await scope.begin({
      connectId,
      deviceType: demoVendor ? undefined : deviceType,
      deviceName: demoDeviceName,
      vendor: demoVendor,
      vendorModel: demoVendorModel,
      vendorModelName: demoVendorModelName,
      // The confirm channel: content registered up front; REQUEST_BUTTON
      // consumes it — the demo exercises the real registration path.
      confirmContent:
        scenario === 'sign' ? { details: demoConfirmDetails } : undefined,
    });
    let scriptError: unknown;
    try {
      await timerUtils.wait(1500);
      switch (scenario) {
        case 'sign': {
          await feed(EHardwareUiStateAction.REQUEST_PIN);
          // The person types the PIN on the stage; submit lands processing.
          if (await waitForStep('processing')) {
            await timerUtils.wait(1000);
            // The registered rows ride in through the plain event feed.
            await feed(EHardwareUiStateAction.REQUEST_BUTTON);
            await timerUtils.wait(3500);
            // Call #1 ends: the SDK's close morphs to processing, not off.
            await feedCallEnd();
            await timerUtils.wait(1200);
            // Call #2 of the same burst re-registers, then asks again.
            await scope.registerConfirmContent({
              description: 'Verify the receive address shown on the device.',
            });
            await feed(EHardwareUiStateAction.REQUEST_BUTTON);
            await timerUtils.wait(3000);
            await feedCallEnd();
            await timerUtils.wait(800);
          }
          break;
        }
        case 'signOnDevice': {
          await feed(EHardwareUiStateAction.EnterPinOnDevice);
          await timerUtils.wait(3000);
          await feed(EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW);
          await timerUtils.wait(1000);
          await scope.noteStep('confirm', {
            connectId,
            confirmDetails: demoConfirmDetails,
            payload: makePayload(EHardwareUiStateAction.REQUEST_BUTTON),
          });
          await timerUtils.wait(3500);
          await feedCallEnd();
          await timerUtils.wait(800);
          break;
        }
        case 'reject': {
          await scope.noteStep('confirm', {
            connectId,
            confirmDetails: demoConfirmDetails,
            payload: makePayload(EHardwareUiStateAction.REQUEST_BUTTON),
          });
          await timerUtils.wait(2500);
          scriptError = {
            $isHardwareError: true,
            code: HardwareErrorCode.ActionCancelled,
          };
          break;
        }
        case 'disconnect': {
          await feed(EHardwareUiStateAction.ProcessLoading);
          await timerUtils.wait(2500);
          scriptError = {
            $isHardwareError: true,
            code: HardwareErrorCode.DeviceNotFound,
          };
          break;
        }
        case 'trezorSign': {
          await feedThirdParty(EThirdPartyHardwareUiAction.unlockDevice);
          await timerUtils.wait(2200);
          // Trezor matrix PIN — the person taps positions on the stage.
          await feedThirdParty(EThirdPartyHardwareUiAction.requestTrezorPin);
          if (await waitForStep('processing')) {
            await timerUtils.wait(800);
            await feedThirdParty(EThirdPartyHardwareUiAction.confirmOnDevice);
            await timerUtils.wait(3000);
            // Call boundary on the third-party rail: atoms cleared.
            await feedThirdPartyClear();
            await timerUtils.wait(400);
          }
          break;
        }
        case 'ledgerInstall': {
          // Install confirm card, then real-progress installing bar.
          await feedThirdPartyInstall();
          await timerUtils.wait(3000);
          for (let p = 0; p <= 10; p += 1) {
            await feedThirdPartyInstall(p / 10);
            await timerUtils.wait(300);
          }
          await feedThirdPartyClear();
          await timerUtils.wait(300);
          break;
        }
        default:
          break;
      }
    } finally {
      await scope.end({ error: scriptError });
    }
  }

  closeHardwareUiStateDialogTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async closeHardwareUiStateDialog(params: ICloseHardwareUiStateDialogParams) {
    clearTimeout(this.closeHardwareUiStateDialogTimer);

    if (!params.skipDelayClose) {
      this.closeHardwareUiStateDialogTimer = setTimeout(
        () =>
          this.closeHardwareUiStateDialogFn({
            ...params,
            skipDeviceCancel: true,
          }),
        600,
      );
    }

    await this.closeHardwareUiStateDialogFn(params);
  }

  @backgroundMethod()
  async closeHardwareUiStateDialogFn(
    params: ICloseHardwareUiStateDialogParams,
  ) {
    /* eslint-disable prefer-const */
    let {
      skipDeviceCancel = true,
      immediateDeviceCancel = false,
      delay,
      connectId,
      walletId,
      reason,
      deviceResetToHome = true,
      hardClose,
      deviceType,
    } = params;
    /* eslint-enable prefer-const */

    try {
      if (!connectId && walletId) {
        const device =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });
        connectId = device?.connectId;
      }
      console.log(`closeHardwareUiStateDialog: ${reason || 'no reason'}`);
      if (delay) {
        await timerUtils.wait(delay);
      }
      await this.cleanHardwareUiState({ hardClose });

      if (!skipDeviceCancel) {
        if (connectId) {
          this.hardwareProcessingManager.cancelOperation(connectId);
        }
        console.log('closeHardwareUiStateDialog cancel device: ', connectId);
        // do not wait cancel, may cause caller stuck
        void this.backgroundApi.serviceHardware.cancel({
          connectId,
          forceDeviceResetToHome: deviceResetToHome,
          immediate: immediateDeviceCancel,
          deviceType,
        });
      }
    } catch (_error) {
      // closeHardwareUiStateDialog should be called safely, do not block caller
    }
  }

  processingNestedNum = 0;

  isOuterProcessing() {
    return this.processingNestedNum === 1;
  }

  @backgroundMethod()
  async isHardwareChannelBusy(_params?: { connectId?: string }) {
    const [
      hardwareUiState,
      firmwareUpdateWorkflowRunning,
      deviceSearchInProgress,
    ] = await Promise.all([
      hardwareUiStateAtom.get(),
      firmwareUpdateWorkflowRunningAtom.get(),
      this.backgroundApi.serviceHardware.isDeviceSearchInProgress(),
    ]);
    return (
      this.processingNestedNum > 0 ||
      this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked() ||
      firmwareUpdateWorkflowRunning ||
      deviceSearchInProgress ||
      Boolean(hardwareUiState)
    );
  }

  async withHardwareProcessing<T>(
    fn: (lease?: IOneKeyHardwareOperationLease) => Promise<T>,
    params: IWithHardwareProcessingOptions,
  ): Promise<T> {
    const device = params.deviceParams?.dbDevice;
    const vendor = device?.vendor ?? device?.settings?.vendor;
    const isThirdPartyVendor = getVendorProfile(
      vendor ?? EHardwareVendor.onekey,
    ).isThirdParty;
    const supportsPortfolioSync = Boolean(
      device &&
      isProtocolV2ProductType(device.deviceType) &&
      (device.connectProtocol === 'V2' ||
        device.deviceStateInfo?.protocol === 'V2') &&
      vendor === EHardwareVendor.onekey,
    );
    // Nested calls reuse the active OneKey operation lease. Only the lease
    // owner represents a complete interaction and may resume Portfolio sync.
    const shouldNotifyPortfolioInteraction =
      !params.oneKeyOperationLease &&
      !isThirdPartyVendor &&
      supportsPortfolioSync;
    let desktopInteractionGeneration: number | undefined;
    if (
      !params.allowDuringFirmwareUpdate &&
      (this.firmwareUpdateExclusiveDepth > 0 ||
        (await firmwareUpdateWorkflowRunningAtom.get()))
    ) {
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.feedback_hardware_is_busy,
        }),
        autoToast: false,
      });
    }
    if (isThirdPartyVendor) {
      return this.withHardwareProcessingInternal(() => fn(undefined), params);
    }
    const tracksFirmwareUpdateExclusivity = Boolean(
      params.allowDuringFirmwareUpdate,
    );
    if (tracksFirmwareUpdateExclusivity) {
      this.firmwareUpdateExclusiveDepth += 1;
    }
    // Keep operation-level serialization during the mixed-SDK rollout and for
    // shared lifecycle work outside the correlated PIN/passphrase response path.
    try {
      let successfulTransportType: EHardwareTransportType | undefined;
      const result = await this.runExclusiveOneKeyOperation(
        async (lease) => {
          const operationResult = await this.withHardwareProcessingInternal(
            async () => {
              if (
                shouldNotifyPortfolioInteraction &&
                platformEnv.isDesktop &&
                device?.id
              ) {
                const generation =
                  await this.backgroundApi.serviceHardwarePortfolioSync
                    .notifyInteractiveHardwareOperationStarted({
                      connectId: device.connectId,
                      deviceDbId: device.id,
                    })
                    .catch(() => undefined);
                if (typeof generation === 'number') {
                  desktopInteractionGeneration = generation;
                }
              }
              return fn(lease);
            },
            params,
          );
          if (platformEnv.isDesktop && device?.id) {
            successfulTransportType = await this.backgroundApi.serviceHardware
              .getCurrentTransportType()
              .catch(() => undefined);
          }
          return operationResult;
        },
        {
          deviceKey:
            device?.id || device?.deviceId || device?.uuid || device?.connectId,
          lease: params.oneKeyOperationLease,
        },
      );
      if (
        shouldNotifyPortfolioInteraction &&
        platformEnv.isNative &&
        device?.id
      ) {
        void this.backgroundApi.serviceHardwarePortfolioSync
          .notifyInteractiveHardwareOperationSucceeded({
            connectId: device.connectId,
            deviceDbId: device.id,
          })
          .catch(() => undefined);
      } else if (
        shouldNotifyPortfolioInteraction &&
        platformEnv.isDesktop &&
        device?.id &&
        desktopInteractionGeneration !== undefined &&
        successfulTransportType
      ) {
        void this.backgroundApi.serviceHardwarePortfolioSync
          .notifyInteractiveHardwareOperationSucceeded({
            connectId: device.connectId,
            deviceDbId: device.id,
            interactionGeneration: desktopInteractionGeneration,
            transportType: successfulTransportType,
          })
          .catch(() => undefined);
      }
      return result;
    } finally {
      if (tracksFirmwareUpdateExclusivity) {
        this.firmwareUpdateExclusiveDepth = Math.max(
          this.firmwareUpdateExclusiveDepth - 1,
          0,
        );
      }
    }
  }

  runExclusiveOneKeyOperation<T>(
    operation: (lease: IOneKeyHardwareOperationLease) => Promise<T>,
    {
      deviceKey,
      lease,
    }: {
      deviceKey?: string;
      lease?: IOneKeyHardwareOperationLease;
    } = {},
  ) {
    return this.hardwareProcessingManager.runExclusiveOneKeyOperation({
      deviceKey,
      lease,
      operation,
    });
  }

  async tryRunExclusiveOneKeyOperation<T>(
    operation: (lease: IOneKeyHardwareOperationLease) => Promise<T>,
    {
      deviceKey,
      lease,
    }: {
      deviceKey?: string;
      lease?: IOneKeyHardwareOperationLease;
    } = {},
  ) {
    if (await this.isHardwareChannelBusy()) {
      return { acquired: false } as const;
    }
    return this.hardwareProcessingManager.tryRunExclusiveOneKeyOperation({
      deviceKey,
      lease,
      operation,
    });
  }

  private async withHardwareProcessingInternal<T>(
    fn: () => Promise<T>,
    params: IWithHardwareProcessingOptions,
  ): Promise<T> {
    clearTimeout(this.closeHardwareUiStateDialogTimer);
    clearTimeout(this.backgroundApi.serviceHardware.cancelTimer);
    // Every log sink below prints this copy instead of params: the real
    // stageConfirmContent stays untouched because it is the only channel
    // feeding deviceStageBurst.begin({ confirmContent }).
    const paramsForLog: IWithHardwareProcessingOptions = {
      ...params,
      stageConfirmContent: params.stageConfirmContent
        ? DEVICE_STAGE_CONFIRM_CONTENT_REDACTED
        : undefined,
    };
    console.log(
      `withHardwareProcessing START: processingNestedNum=${this.processingNestedNum}`,
      paramsForLog,
    );
    const {
      deviceParams,
      skipDeviceCancel = false,
      skipCloseHardwareUiStateDialog = false,
      skipDeviceCancelAtFirst = true,
      hideCheckingDeviceLoading,
      onFinally,
    } = params;
    const device = deviceParams?.dbDevice;
    const connectId = device?.connectId;
    let isOuterCall = false;
    let skipDeviceCancelAfterError = false;
    let stageBurstError: unknown;

    // Third-party vendors (Ledger) don't use OneKey SDK
    // Skip all OneKey-specific flows: DeviceChecking dialog, mutex, cancel, resetToHome
    const isThirdPartyVendor = getVendorProfile(
      device?.vendor ?? EHardwareVendor.onekey,
    ).isThirdParty;
    let deviceResetToHome = true;
    let isBusy = false;
    try {
      if (this.processingNestedNum <= 0) {
        this.processingNestedNum = 0;
      }
      this.processingNestedNum += 1;
      // Determine outer call AFTER increment so that the first caller is treated as outer
      isOuterCall = this.isOuterProcessing();

      defaultLogger.hardware.sdkLog.consoleLog('withHardwareProcessing');
      defaultLogger.account.accountCreatePerf.withHardwareProcessingStart(
        paramsForLog,
      );

      if (connectId) {
        // The device update detection is postponed for two hours
        // and the automatic detection is resumed after the device communication is completed
        void this.backgroundApi.serviceFirmwareUpdate.delayShouldDetectTimeCheckWithDelay(
          { connectId, delay: timerUtils.getTimeDurationMs({ hour: 2 }) },
        );
      }

      if (this.isOuterProcessing()) {
        // >>> mock hardware connectId
        // if (deviceParams?.dbDevice && deviceParams) {
        //   deviceParams.dbDevice.connectId = '11111';
        // }

        await this.cleanHardwareUiState();
        await this.deviceStageBurst.begin({
          connectId,
          deviceType: device?.deviceType,
          deviceName: deviceUtils.buildDeviceStageName({
            features: device?.featuresInfo,
            fallbackName: device?.name,
          }),
          vendor: isThirdPartyVendor
            ? (device?.vendor ?? device?.settings?.vendor)
            : undefined,
          vendorModel: isThirdPartyVendor
            ? device?.settings?.vendorModel
            : undefined,
          vendorModelName: isThirdPartyVendor
            ? device?.settings?.vendorModelName
            : undefined,
          confirmContent: params.stageConfirmContent,
        });
        if (connectId && !hideCheckingDeviceLoading && !isThirdPartyVendor) {
          // 先在统一连接管理器中确定本次实际传输，再显示动画，避免 BLE
          // 通讯使用上一次持久化的 USB 弹窗。这里只选择传输，不发起设备通讯。
          await this.backgroundApi.serviceHardware.prepareHardwareTransport({
            connectId,
            connectProtocol: device?.connectProtocol,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
          await this.showCheckingDeviceDialog({
            connectId,
          });
        }
        // Third-party searching UI is driven by SDK ui-events.

        // await waitForCancelDone();

        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessing({
          message: 'cancelableDelay',
        });

        // Dialog 和 Toast 在执行 show ，但是动画未结束时，立即调用 close 无效，将导致 Dialog 和 Toast 一直显示
        // wait action animation done
        // action dialog may call getFeatures of the hardware when it is closed
        // if (connectId && !skipWaitingAnimationAtFirst) {
        //   await this.hardwareProcessingManager.cancelableDelay(connectId, 350);
        // }

        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessingDone(
          {
            message: 'cancelableDelay',
          },
        );
      } else {
        // await waitForCancelDone();
      }

      // test delay
      // await timerUtils.wait(6000);

      // Skip OneKey SDK mutex check for third-party vendors
      if (!isThirdPartyVendor) {
        let isMutexLocked =
          this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked();
        if (isMutexLocked) {
          await this.backgroundApi.serviceHardware.getFeaturesMutex.waitForUnlock();
          isMutexLocked =
            this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked();
          if (isMutexLocked) {
            isBusy = true;
            throw new OneKeyLocalError(
              appLocale.intl.formatMessage({
                id: ETranslations.feedback_hardware_is_busy,
              }),
            );
          }
        }
      }

      if (this.isOuterProcessing()) {
        // TODO wait 3s if device is canceling
        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessing({
          message: 'cancelAtFirst',
        });
        if (connectId && !skipDeviceCancelAtFirst && this.isOuterProcessing()) {
          // await this.backgroundApi.serviceHardware.cancel(connectId);
          // await this.hardwareProcessingManager.cancelableDelay(connectId, 600);
        }
        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessingDone(
          {
            message: 'cancelAtFirst',
          },
        );
      }

      defaultLogger.account.accountCreatePerf.withHardwareProcessingRunFn();
      const r = await fn();
      defaultLogger.account.accountCreatePerf.withHardwareProcessingRunFnDone();

      deviceResetToHome = false;
      console.log('withHardwareProcessing done: ', r);
      return r;
    } catch (error) {
      stageBurstError = error;
      console.error('withHardwareProcessing ERROR: ', error);
      console.error(
        'withHardwareProcessing ERROR stack: ',
        (error as Error)?.stack,
      );
      // The SDK error payload never carries the device it came from, so stamp
      // the connectId this call was made with — UI actions (firmware update)
      // can then target the failing device instead of resolving one.
      if (connectId && isHardwareError({ error: error as IOneKeyError })) {
        const hardwareError = error as IOneKeyError;
        const hadConnectId = Boolean(hardwareError.payload?.connectId);
        hardwareError.payload = {
          ...hardwareError.payload,
          connectId: hardwareError.payload?.connectId || connectId,
        };
        // The error constructor only notifies recovery when it already has
        // a connectId. Notify here when this catch supplied the missing ID.
        if (
          !hadConnectId &&
          isHardwareErrorByCode({
            error: hardwareError,
            code: HardwareErrorCode.NotAllowInBootloaderMode,
          })
        ) {
          appEventBus.emit(
            EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode,
            { connectId },
          );
        }
      }
      // OK-59934 hard rule #2 (失败不外溢): the stage lands hardware
      // failures as its error outcome, so the same failure must not also
      // toast. Cleared here in bg, before the error crosses the bridge —
      // toastIfError respects an explicit boolean and will not re-arm it.
      if (
        !isLegacyHardwareUiActive() &&
        isHardwareError({ error: error as IOneKeyError })
      ) {
        (error as IOneKeyError).autoToast = false;
      }
      if (
        isHardwareErrorByCode({
          error: error as any,
          code: HardwareErrorCode.NewFirmwareForceUpdate,
        })
      ) {
        if (this.isOuterProcessing()) {
          setTimeout(() => {
            // backdrop conflict, wait hardware ui dialog close
            appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateForce, {
              connectId,
            });
          }, 300);
        }
      }
      if (
        isHardwareErrorByCode({
          error: error as any,
          code: HARDWARE_CONNECTION_CANCEL_SKIP_CODES,
        })
      ) {
        // Pairing / link-setup failures never have an acquired session.
        // Sending Cancel here can re-enter BLE and raise the OS pairing prompt.
        skipDeviceCancelAfterError = true;
        deviceResetToHome = false;
      } else if (
        isHardwareErrorByCode({
          error: error as any,
          code: [
            HardwareErrorCode.ActionCancelled,
            HardwareErrorCode.CallQueueActionCancelled,
            HardwareErrorCode.PinCancelled,
            // Hardware interrupts generally have follow-up actions; skip reset to home
            HardwareErrorCode.DeviceInterruptedFromUser,
            HardwareErrorCode.DeviceInterruptedFromOutside,
          ],
        })
      ) {
        deviceResetToHome = false;
      } else if (!isHardwareError({ error: error as any })) {
        // not hardware error, reset to home
        deviceResetToHome = false;
      }
      throw error;
    } finally {
      console.log('withHardwareProcessing FINALLY:', {
        processingNestedNum: this.processingNestedNum,
        skipCloseHardwareUiStateDialog,
      });
      // Third-party vendors may have empty connectId (e.g. USB Ledger),
      // but still need to clear their loading UI state.
      if (isOuterCall) {
        if (isThirdPartyVendor) {
          if (!skipCloseHardwareUiStateDialog) {
            void thirdPartyHardwareUiStateAtom.set(undefined);
            void thirdPartyAppInstallAtom.set(undefined);
          }
        } else if (connectId) {
          if (!skipCloseHardwareUiStateDialog) {
            const closeDialogParams = {
              skipDeviceCancel: skipDeviceCancel || skipDeviceCancelAfterError,
              deviceResetToHome,
            };
            if (isBusy) {
              closeDialogParams.skipDeviceCancel = true;
              closeDialogParams.deviceResetToHome = false;
            }
            await this.closeHardwareUiStateDialog({
              connectId,
              skipDeviceCancel: closeDialogParams.skipDeviceCancel,
              deviceResetToHome: closeDialogParams.deviceResetToHome,
              deviceType: device?.deviceType,
            });
            void this.backgroundApi.serviceAccount.generateHwWalletsMissingXfp({
              wallet: deviceParams?.dbWallet,
              connectId,
              deviceId: device?.deviceId,
              withUserInteraction: false,
            });
          }
          void this.backgroundApi.serviceFirmwareUpdate.delayShouldDetectTimeCheck(
            { connectId },
          );
        }
      }
      if (isOuterCall) {
        await this.deviceStageBurst.end({ error: stageBurstError });
      }
      this.processingNestedNum -= 1;
      onFinally?.();
    }
  }
}

export default ServiceHardwareUI;
