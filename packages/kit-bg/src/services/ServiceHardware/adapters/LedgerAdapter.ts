import {
  EConnectorInteraction,
  HardwareErrorCode,
  failure,
  resolveSearchTargetReusePolicy,
} from '@onekeyfe/hwk-adapter-core';
import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  EThirdPartyHardwareUiAction,
  thirdPartyAppInstallAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { BaseAdapter } from './BaseAdapter';
import { registerBleBindingUi } from './registerBleBindingUi';

import type {
  DeviceInfo,
  IHardwareConnectionContext,
  IHardwareWallet,
  IThirdPartyConnectedDevicePayload,
  IThirdPartyHardwareAdapter,
  IThirdPartyHardwareSearchOptions,
  IThirdPartyHardwareSearchTarget,
  Response,
} from './types';

type IOperationHardwareWallet = IHardwareWallet & {
  connectDevice(searchTargetId: string): Promise<Response<string>>;
  releaseOperation(operationId: string): Promise<void>;
};

const APP_INSTALL_PROGRESS_LOG_INTERVAL_MS = 5000;
const APP_INSTALL_PROGRESS_LOG_STEP = 0.1;

type IAppInstallProgressLogState = {
  progress: number;
  loggedAt: number;
  completed: boolean;
};

export class LedgerAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.ledger;

  readonly supportsAllNetworkGetAddress = true;

  readonly hw: IHardwareWallet;
  readonly cancelBleBinding: (bindingSessionId: string) => void;

  private readonly appInstallProgressLogState = new Map<
    string,
    IAppInstallProgressLogState
  >();

  private activeOperationId: string | undefined;

  constructor(hw: IHardwareWallet) {
    super();
    this.hw = hw;
    this.cancelBleBinding = registerBleBindingUi({
      hw: this.hw,
      vendor: this.vendor,
    });

    this.hw.on('ui-event', (event) => {
      const eventType = (event as { type?: string }).type ?? 'unknown';
      defaultLogger.hardware.sdkLog.uiEvent(
        `[3rdPartyHW][Ledger] ${eventType}`,
        event,
      );
      switch (event.type) {
        case EConnectorInteraction.Searching:
          void this.publishUiState(
            {
              action: EThirdPartyHardwareUiAction.searching,
              vendor: EHardwareVendor.ledger,
            },
            event.payload?.sessionId,
          );
          break;
        case EConnectorInteraction.ConfirmOpenApp:
          void this.publishUiState(
            {
              action: EThirdPartyHardwareUiAction.openApp,
              vendor: EHardwareVendor.ledger,
            },
            event.payload?.sessionId,
          );
          break;
        case EConnectorInteraction.UnlockDevice:
          void this.publishUiState(
            {
              action: EThirdPartyHardwareUiAction.unlockDevice,
              vendor: EHardwareVendor.ledger,
            },
            event.payload?.sessionId,
          );
          break;
        case EConnectorInteraction.ConfirmOnDevice:
          void this.publishUiState(
            {
              action: EThirdPartyHardwareUiAction.confirmOnDevice,
              vendor: EHardwareVendor.ledger,
            },
            event.payload?.sessionId,
          );
          break;
        case EConnectorInteraction.InteractionComplete:
          void this.clearUiState(event.payload?.sessionId);
          break;
        case EConnectorInteraction.AppInstallProgress: {
          // Ledger DMK install progress (0..1); throttled log avoids flooding.
          const { connectId, appName, progress } = event.payload;
          if (
            this.shouldLogAppInstallProgress({ connectId, appName, progress })
          ) {
            defaultLogger.hardware.sdkLog.log(
              `[3rdPartyHW][Ledger] app-install-progress appName=${appName} progress=${progress}`,
            );
          }
          // Dedicated install atom (separate from the single-slot ui-state):
          // the imperatively-shown install dialog reads progress here and
          // coexists with any device-prompt toast.
          void thirdPartyAppInstallAtom.set({
            vendor: EHardwareVendor.ledger,
            appName,
            progress,
          });
          break;
        }
        default: {
          // Compile-time exhaustiveness guard: when the SDK adds a new
          // EConnectorInteraction variant, `event` is no longer `never` here
          // and the build fails until the new variant is handled above. The
          // runtime log stays as a belt-and-suspenders for unexpected values.
          const unhandled: never = event;
          defaultLogger.hardware.sdkLog.log(
            `[3rdPartyHW][Ledger] Unhandled SDK ui-event type: ${
              (unhandled as { type?: string })?.type ?? eventType
            }`,
          );
          break;
        }
      }
    });

    this.hw.on(UI_REQUEST.REQUEST_DEVICE_CONNECT, (event) => {
      const { vendor, reason } = event.payload;
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] REQUEST_DEVICE_CONNECT vendor=${vendor} reason=${reason}`,
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestDeviceNotFound,
        payload: {
          vendor,
          reason,
          message: appLocale.intl.formatMessage({
            id: ETranslations.hardware_third_party_connect_ledger_message,
          }),
        },
      });
    });

    this.hw.on(UI_REQUEST.REQUEST_SELECT_DEVICE, (event) => {
      if (event.payload.scanning) return;
      const deviceSearchTargets = event.payload.devices.map((device) => ({
        searchTargetId: device.connectId,
        searchTargetReusePolicy: resolveSearchTargetReusePolicy(device),
        vendor: EHardwareVendor.ledger,
        connectionType: device.connectionType,
        kind: 'physical' as const,
        label: device.label,
        model: device.model,
        modelName: device.modelName,
        serialNumber: device.serialNumber,
      }));
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestDeviceSelection,
        payload: {
          vendor: EHardwareVendor.ledger,
          deviceSearchTargets,
          deviceSelection: {
            requestId: event.payload.requestId,
            context: event.payload.context,
            extra: event.payload.extra,
          },
        },
      });
    });

    this.hw.on(UI_REQUEST.REQUEST_BTC_HIGH_INDEX_CONFIRM, (event) => {
      const { vendor, path, accountIndex } = event.payload;
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] REQUEST_BTC_HIGH_INDEX_CONFIRM path=${path} index=${accountIndex}`,
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm,
        payload: {
          vendor,
          path,
          accountIndex,
        },
      });
    });

    this.hw.on(UI_REQUEST.REQUEST_INSTALL_APP, (event) => {
      const { appName } = event.payload;
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] REQUEST_INSTALL_APP appName=${appName}`,
      );
      // Drive the dedicated install dialog (confirm state: no progress yet).
      void thirdPartyAppInstallAtom.set({
        vendor: EHardwareVendor.ledger,
        appName,
      });
    });

    this.hw.on(UI_REQUEST.CLOSE_UI_WINDOW, () => {
      defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] CLOSE_UI_WINDOW');
      void this.clearUiState();
      void thirdPartyAppInstallAtom.set(undefined);
    });

    this.hw.on('operation-ended', (event) => {
      const operationId = (event as { payload?: { operationId?: string } })
        .payload?.operationId;
      if (!operationId) return;
      this.emitConnectionStateChange({ type: 'disconnected', operationId });
      if (this.activeOperationId !== operationId) return;
      void Promise.all([
        this.clearUiState(),
        thirdPartyAppInstallAtom.set((state) =>
          this.activeOperationId === operationId &&
          state?.vendor === EHardwareVendor.ledger
            ? undefined
            : state,
        ),
      ]).finally(() => {
        if (this.activeOperationId === operationId) {
          this.activeOperationId = undefined;
        }
      });
    });

    this.onUiEvent((event) => {
      if (event.kind === 'request') {
        const {
          reason,
          message,
          path,
          accountIndex,
          deviceSearchTargets,
          deviceSelection,
        } = event.payload ?? {};
        void this.publishUiState({
          action: event.type as EThirdPartyHardwareUiAction,
          vendor: EHardwareVendor.ledger,
          payload: {
            reason,
            message,
            path,
            accountIndex,
            deviceSearchTargets,
            deviceSelection,
          },
        });
      }
    });
  }

  private shouldLogAppInstallProgress({
    connectId,
    appName,
    progress,
  }: {
    connectId: string;
    appName: string;
    progress: number;
  }) {
    const key = `${connectId || '(empty)'}:${appName}`;
    const now = Date.now();
    const previous = this.appInstallProgressLogState.get(key);
    if (previous?.completed && progress >= previous.progress) {
      return false;
    }
    const shouldLog =
      !previous ||
      progress < previous.progress ||
      progress >= 1 ||
      progress - previous.progress >= APP_INSTALL_PROGRESS_LOG_STEP ||
      now - previous.loggedAt >= APP_INSTALL_PROGRESS_LOG_INTERVAL_MS;

    if (shouldLog) {
      this.appInstallProgressLogState.set(key, {
        progress,
        loggedAt: now,
        completed: progress >= 1,
      });
    }
    return shouldLog;
  }

  async searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] searchDevices()');
    const devices = await (
      this.hw as IHardwareWallet & {
        searchDevices(
          options?: IThirdPartyHardwareSearchOptions,
        ): Promise<DeviceInfo[]>;
      }
    ).searchDevices(options);
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Ledger] searchDevices -> count=${devices.length}`,
    );
    return devices;
  }

  async searchDeviceTargets(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<IThirdPartyHardwareSearchTarget[]> {
    const targets = await this.hw.searchDeviceTargets(options);
    return targets.map((target) => ({
      ...target,
      vendor: EHardwareVendor.ledger,
    }));
  }

  async connectDevice(
    searchTargetId: string,
    operationContext?: IHardwareConnectionContext,
  ): Promise<Response<IThirdPartyConnectedDevicePayload>> {
    this.activeOperationId = undefined;
    let connected = false;
    let operationId: string | undefined;
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Ledger] connectDevice searchTargetId=${searchTargetId}`,
    );
    try {
      if (operationContext && !this.hw.acquireOperation) {
        return failure(
          HardwareErrorCode.MethodNotSupported,
          'Ledger operation-scoped acquire is unavailable',
        );
      }
      const result =
        operationContext && this.hw.acquireOperation
          ? await this.hw.acquireOperation(searchTargetId, operationContext)
          : await (this.hw as IOperationHardwareWallet).connectDevice(
              searchTargetId,
            );
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] connectDevice result success=${String(
          result.success,
        )}`,
      );
      if (result.success) {
        operationId = result.payload;
        this.activeOperationId = operationId;
        const info = await this.hw.getDeviceInfo(operationId, '');
        defaultLogger.hardware.sdkLog.log(
          `[3rdPartyHW][Ledger] getDeviceInfo success=${String(info.success)}`,
        );
        void this.clearUiState();
        if (info.success) {
          const payload: IThirdPartyConnectedDevicePayload = {
            operationId,
            connectId: info.payload.connectId,
            deviceId: info.payload.deviceId,
            model: info.payload.model,
            modelName: info.payload.modelName,
            label: info.payload.label,
            firmwareVersion: info.payload.firmwareVersion,
            connectionType: info.payload.connectionType,
            capabilities: info.payload.capabilities,
            raw: info.payload.raw,
          };
          connected = true;
          this.emitConnectionStateChange({
            type: 'connected',
            device: payload,
          });
          return {
            success: true,
            payload,
          };
        }
        return { success: false, payload: info.payload };
      }
      void this.clearUiState();
      return { success: false, payload: result.payload };
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Ledger] connectDevice threw: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      void this.clearUiState();
      throw error;
    } finally {
      // SDK builds up to 1.2.3-alpha.8 rethrow a denied or preempted permission
      // request from getDeviceInfo instead of returning a failure.
      if (!connected && operationId) {
        await (this.hw as IOperationHardwareWallet)
          .releaseOperation(operationId)
          .catch(() => undefined);
      }
    }
  }

  async releaseOperation(operationId: string): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Ledger] releaseOperation operationId=${operationId}`,
    );
    await (this.hw as IOperationHardwareWallet).releaseOperation(operationId);
    this.emitConnectionStateChange({ type: 'disconnected', operationId });
  }

  async reset(): Promise<void> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Ledger] reset()');
    const operationId = this.activeOperationId;
    this.activeOperationId = undefined;
    if (operationId) {
      this.emitConnectionStateChange({ type: 'disconnected', operationId });
    }
    void this.clearUiState();
    await this.hw.dispose();
  }
}
