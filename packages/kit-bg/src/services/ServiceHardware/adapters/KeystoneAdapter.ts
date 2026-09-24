import {
  EConnectorInteraction,
  HardwareErrorCode,
} from '@onekeyfe/hwk-adapter-core';
import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EHardwareVendor,
  type IThirdPartyHardwareSearchTarget,
} from '@onekeyhq/shared/types/device';

import { BaseAdapter } from './BaseAdapter';

import type {
  DeviceInfo,
  IHardwareWallet,
  IThirdPartyConnectedDevicePayload,
  IThirdPartyHardwareAdapter,
  IThirdPartyHardwareSearchOptions,
  Response,
} from './types';

// Device calls that keep the stage on `processing`, so a long USB export
// is not mistaken for a stalled connection.
const KEYSTONE_CHAIN_CALL = /^(evm|btc|sol|tron)[A-Z]/;
const KEYSTONE_DEVICE_CALLS = new Set([
  'allNetworkGetAddress',
  'getChainFingerprint',
  'importFromQr',
]);

function isKeystoneDeviceCall(method: string): boolean {
  return KEYSTONE_DEVICE_CALLS.has(method) || KEYSTONE_CHAIN_CALL.test(method);
}

type IQrDisplayEvent = {
  payload?: {
    device?: unknown;
    data?: { urType?: string; urData?: string; animated?: boolean };
  };
};

function toConnectedDevicePayload(
  info: DeviceInfo,
  operationId: string,
): IThirdPartyConnectedDevicePayload | undefined {
  if (!info.deviceId || !info.connectId) return undefined;
  return {
    operationId,
    connectId: info.connectId,
    deviceId: info.deviceId,
    model: info.model,
    modelName: info.modelName,
    label: info.label,
    firmwareVersion: info.firmwareVersion,
    connectionType: info.connectionType,
    capabilities: info.capabilities,
    raw: info.raw || {},
  };
}

/**
 * Keystone adapter: no THP pairing, BLE binding probes, or host passphrase
 * UI. Its QR round trip bridges via emitUiEvent; the SDK blocks in hw.on() until this adapter's uiResponse() is called back.
 */
export class KeystoneAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.keystone;

  readonly supportsAllNetworkGetAddress = true;

  readonly hw: IHardwareWallet;

  private activeOperationId: string | undefined;

  private processingDepth = 0;

  // Keystone cold-start jobs serialize; a replacement cancels and waits so
  // two first-contact flows never share the adapter's QR/USB state.
  private pendingConnect?: Promise<void>;

  constructor(hw: IHardwareWallet) {
    super();
    this.hw = this.createProcessingAwareHw(hw);
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] adapter created');

    this.hw.on(UI_REQUEST.REQUEST_QR_DISPLAY, (event) => {
      const data = (event as IQrDisplayEvent).payload?.data;
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Keystone] REQUEST_QR_DISPLAY urType=${
          data?.urType ?? '-'
        }`,
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestKeystoneQrDisplay,
        payload: {
          urType: data?.urType,
          urData: data?.urData,
          animated: data?.animated,
        },
      });
    });

    this.hw.on(UI_REQUEST.REQUEST_QR_SCAN, () => {
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Keystone] REQUEST_QR_SCAN',
      );
      this.emitUiEvent({
        kind: 'request',
        type: EThirdPartyHardwareUiAction.requestKeystoneQrScan,
      });
    });

    // USB interaction status relayed from the connector: public-data export
    // confirms once per connector lifetime (re-enumeration must not reopen the toast), but signing still confirms every request. Same toast as Ledger.
    this.hw.on('ui-event', (event) => {
      const typed = event as {
        type?: string;
        payload?: { sessionId?: string };
      };
      switch (typed.type) {
        case EConnectorInteraction.ConfirmOnDevice:
          void this.publishUiState(
            {
              action: EThirdPartyHardwareUiAction.confirmOnDevice,
              vendor: EHardwareVendor.keystone,
            },
            typed.payload?.sessionId,
          );
          break;
        case EConnectorInteraction.InteractionComplete:
          this.clearOrRestoreProcessing(typed.payload?.sessionId);
          break;
        default:
          break;
      }
    });

    this.hw.on('operation-ended', (event) => {
      const operationId = (event as { payload?: { operationId?: string } })
        .payload?.operationId;
      if (!operationId) return;
      this.emitConnectionStateChange({ type: 'disconnected', operationId });
      if (this.activeOperationId !== operationId) return;
      void (async () => {
        await this.clearUiState();
        if (this.activeOperationId === operationId) {
          this.activeOperationId = undefined;
        }
      })();
    });

    this.onUiEvent((event) => {
      if (event.kind === 'request') {
        void this.publishUiState({
          action: event.type as EThirdPartyHardwareUiAction,
          vendor: EHardwareVendor.keystone,
          payload: event.payload as IThirdPartyHardwareUiState['payload'],
        });
      }
    });
  }

  private createProcessingAwareHw(hw: IHardwareWallet): IHardwareWallet {
    return new Proxy(hw, {
      get: (target, property, receiver) => {
        const value: unknown = Reflect.get(target, property, receiver);
        if (
          typeof property !== 'string' ||
          typeof value !== 'function' ||
          !isKeystoneDeviceCall(property)
        ) {
          return value;
        }
        const boundMethod = (value as (...args: unknown[]) => unknown).bind(
          target,
        );
        return (...args: unknown[]) =>
          this.runWithProcessing(() => Promise.resolve(boundMethod(...args)));
      },
    });
  }

  private async runWithProcessing<T>(operation: () => Promise<T>): Promise<T> {
    // Only the outermost call touches the UI state: a nested call must not
    // replace a QR prompt that is still on screen.
    this.processingDepth += 1;
    if (this.processingDepth === 1) {
      void this.publishUiState({
        action: EThirdPartyHardwareUiAction.processing,
        vendor: EHardwareVendor.keystone,
      });
    }
    try {
      return await operation();
    } finally {
      this.processingDepth = Math.max(0, this.processingDepth - 1);
      if (this.processingDepth === 0) {
        void this.clearUiState();
      }
    }
  }

  private clearOrRestoreProcessing(sessionId?: string): void {
    if (this.processingDepth > 0) {
      void this.restoreProcessingUiState(
        EThirdPartyHardwareUiAction.processing,
        sessionId,
      );
      return;
    }
    void this.clearUiState(sessionId);
  }

  async searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] searchDevices');
    return this.hw.searchDevices(options);
  }

  async searchDeviceTargets(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<IThirdPartyHardwareSearchTarget[]> {
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Keystone] searchDeviceTargets',
    );
    const targets = await this.hw.searchDeviceTargets(options);
    return targets.map((target) => ({
      ...target,
      vendor: EHardwareVendor.keystone,
    }));
  }

  async connectDevice(
    searchTargetId: string,
  ): Promise<Response<IThirdPartyConnectedDevicePayload>> {
    const prior = this.pendingConnect;
    let settleTracked: () => void = () => undefined;
    const tracked = new Promise<void>((resolve) => {
      settleTracked = resolve;
    });
    this.pendingConnect = tracked;
    try {
      if (prior) {
        // A replacement first-contact flow must not share QR/USB state with
        // the one it supersedes: cancel, then wait for it to settle.
        this.cancel();
        await prior;
      }
      return await this.connectDeviceTarget(searchTargetId);
    } finally {
      settleTracked();
      if (this.pendingConnect === tracked) {
        this.pendingConnect = undefined;
      }
    }
  }

  private async connectDeviceTarget(
    searchTargetId: string,
  ): Promise<Response<IThirdPartyConnectedDevicePayload>> {
    this.activeOperationId = undefined;
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] connectDevice');
    const connected = await this.hw.connectDevice(searchTargetId);
    if (!connected.success) {
      return { success: false, payload: connected.payload };
    }
    const operationId = connected.payload;
    this.activeOperationId = operationId;
    let info: Awaited<ReturnType<IHardwareWallet['getDeviceInfo']>>;
    try {
      info = await this.hw.getDeviceInfo(operationId, '');
    } catch (error) {
      // An open operation holds the device; never leave it behind.
      await this.hw.releaseOperation(operationId).catch(() => undefined);
      throw error;
    }
    if (!info.success) {
      await this.hw.releaseOperation(operationId).catch(() => undefined);
      return { success: false, payload: info.payload };
    }
    const device = toConnectedDevicePayload(info.payload, operationId);
    if (!device) {
      await this.hw.releaseOperation(operationId).catch(() => undefined);
      return {
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceMismatch,
          error: 'Keystone did not return a stable wallet identity',
        },
      };
    }
    this.emitConnectionStateChange({ type: 'connected', device });
    return {
      success: true,
      payload: device,
    };
  }

  async releaseOperation(operationId: string): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Keystone] releaseOperation',
    );
    await this.hw.releaseOperation(operationId);
    this.emitConnectionStateChange({ type: 'disconnected', operationId });
  }

  async reset(): Promise<void> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] reset()');
    const operationId = this.activeOperationId;
    this.activeOperationId = undefined;
    if (operationId) {
      this.emitConnectionStateChange({ type: 'disconnected', operationId });
    }
    this.pendingConnect = undefined;
    this.processingDepth = 0;
    // Clear UI state first, same as Ledger/Trezor: a reset mid-QR-round-trip
    // would otherwise leave the QR display/scan flag set, keeping the toast or camera on screen behind a disposed adapter.
    void this.clearUiState();
    await this.hw.dispose();
  }
}
