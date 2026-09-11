import {
  EConnectorInteraction,
  HardwareErrorCode,
} from '@onekeyfe/hwk-adapter-core';
import { UI_REQUEST } from '@onekeyfe/hwk-adapter-core/ui-events';

import {
  EThirdPartyHardwareUiAction,
  type IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

type IQrDisplayEvent = {
  payload?: {
    device?: unknown;
    data?: { urType?: string; urData?: string; animated?: boolean };
  };
};

type IKeystoneLifecycleHw = IHardwareWallet & {
  connectDevice(searchTargetId: string): Promise<Response<string>>;
  searchDeviceTargets?: (
    options?: IThirdPartyHardwareSearchOptions,
  ) => Promise<IThirdPartyHardwareSearchTarget[]>;
  listConnectionTargets?: (
    options?: IThirdPartyHardwareSearchOptions,
  ) => Promise<
    Array<
      Omit<IThirdPartyHardwareSearchTarget, 'searchTargetId'> & {
        targetId: string;
      }
    >
  >;
  releaseInteraction(interactionId: string): Promise<void>;
};

function toConnectedDevicePayload(
  info: DeviceInfo,
  fallbackConnectId: string,
  interactionId: string,
): IThirdPartyConnectedDevicePayload | undefined {
  if (!info.deviceId) return undefined;
  return {
    interactionId,
    connectId: info.connectId || fallbackConnectId,
    deviceId: info.deviceId,
    model: info.model,
    modelName: (info as DeviceInfo & { modelName?: string }).modelName,
    label: info.label,
    firmwareVersion: info.firmwareVersion,
    connectionType: info.connectionType,
    capabilities: info.capabilities,
    raw: (info as DeviceInfo & { raw?: Record<string, unknown> }).raw || {},
  };
}

/**
 * Keystone third-party hardware adapter.
 *
 * Much thinner than Trezor/Ledger: no THP pairing, no BLE binding probes, no
 * host passphrase UI. The one thing genuinely unique to Keystone is the QR
 * round trip — `REQUEST_QR_DISPLAY`/`REQUEST_QR_SCAN` bridge into
 * `ThirdPartyHardwareUiStateContainer` the same way Trezor's THP pairing
 * (typed-code) round trip does: fire-and-forget the request via
 * `emitUiEvent`, and the SDK's own internal state machine blocks inside its
 * `hw.on(...)` handler until this adapter's `uiResponse()` is called back —
 * no separate promise/callback plumbing needed.
 */
export class KeystoneAdapter
  extends BaseAdapter
  implements IThirdPartyHardwareAdapter
{
  readonly vendor = EHardwareVendor.keystone;

  readonly supportsAllNetworkGetAddress = true;

  readonly hw: IHardwareWallet;

  private activeInteractionId: string | undefined;

  // Keystone cold-start jobs serialize; a replacement cancels and waits so
  // two first-contact flows never share the adapter's QR/USB state.
  private pendingConnect?: Promise<void>;

  constructor(hw: IHardwareWallet) {
    super();
    this.hw = hw;
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

    // USB interaction status, relayed from the connector. Public-data export
    // shows confirmation once per connector lifetime; internal USB
    // re-enumeration must not reopen the toast. Signing still confirms every
    // request. Rendered by the shared confirm-on-device toast, same as Ledger.
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
          void this.clearUiState(typed.payload?.sessionId);
          break;
        default:
          break;
      }
    });

    this.hw.on('interaction-ended', (event) => {
      const interactionId = (event as { payload?: { interactionId?: string } })
        .payload?.interactionId;
      if (!interactionId) return;
      this.emitConnectionStateChange({ type: 'disconnected', interactionId });
      if (this.activeInteractionId !== interactionId) return;
      void (async () => {
        await this.clearUiState();
        if (this.activeInteractionId === interactionId) {
          this.activeInteractionId = undefined;
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

  async searchDevices(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<DeviceInfo[]> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] searchDevices');
    return (
      this.hw as IHardwareWallet & {
        searchDevices(
          options?: IThirdPartyHardwareSearchOptions,
        ): Promise<DeviceInfo[]>;
      }
    ).searchDevices(options);
  }

  async searchDeviceTargets(
    options?: IThirdPartyHardwareSearchOptions,
  ): Promise<IThirdPartyHardwareSearchTarget[]> {
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Keystone] searchDeviceTargets',
    );
    const lifecycleHw = this.hw as IKeystoneLifecycleHw;
    if (lifecycleHw.searchDeviceTargets) {
      const targets = await lifecycleHw.searchDeviceTargets(options);
      return targets.map((target) => ({
        ...target,
        vendor: EHardwareVendor.keystone,
      }));
    }
    if (!lifecycleHw.listConnectionTargets) {
      throw new OneKeyLocalError({
        message: 'Keystone SDK does not support searchDeviceTargets',
      });
    }
    const targets = await lifecycleHw.listConnectionTargets(options);
    return targets.map((target) => ({
      ...target,
      searchTargetId: target.targetId,
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
    this.activeInteractionId = undefined;
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] connectDevice');
    const connected = await (this.hw as IKeystoneLifecycleHw).connectDevice(
      searchTargetId,
    );
    if (!connected.success) {
      return { success: false, payload: connected.payload };
    }
    const interactionId = connected.payload;
    this.activeInteractionId = interactionId;
    const info = await this.hw.getDeviceInfo(interactionId, '');
    if (!info.success) {
      await (this.hw as IKeystoneLifecycleHw)
        .releaseInteraction(interactionId)
        .catch(() => undefined);
      return { success: false, payload: info.payload };
    }
    const device = toConnectedDevicePayload(
      info.payload,
      searchTargetId,
      interactionId,
    );
    if (!device) {
      await (this.hw as IKeystoneLifecycleHw)
        .releaseInteraction(interactionId)
        .catch(() => undefined);
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

  async releaseInteraction(interactionId: string): Promise<void> {
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Keystone] releaseInteraction',
    );
    await (this.hw as IKeystoneLifecycleHw).releaseInteraction(interactionId);
    this.emitConnectionStateChange({ type: 'disconnected', interactionId });
  }

  async reset(): Promise<void> {
    defaultLogger.hardware.sdkLog.log('[3rdPartyHW][Keystone] reset()');
    const interactionId = this.activeInteractionId;
    this.activeInteractionId = undefined;
    if (interactionId) {
      this.emitConnectionStateChange({ type: 'disconnected', interactionId });
    }
    this.pendingConnect = undefined;
    // Clear the UI state first, same as Ledger/Trezor. A reset mid-QR-round-
    // trip would otherwise leave requestKeystoneQrDisplay/Scan in the atom,
    // so the container keeps the QR toast or camera on screen with a disposed
    // adapter behind it, and the eventual response is posted into nothing.
    void this.clearUiState();
    await this.hw.dispose();
  }
}
