import { resolveSearchTargetReusePolicy } from '@onekeyfe/hwk-adapter-core';
import { UI_REQUEST, UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';

import localDb from '@onekeyhq/kit-bg/src/dbs/local/localDb';
import { matchesVerifiedDeviceIdentity } from '@onekeyhq/kit-bg/src/dbs/local/verifiedDeviceIdentity';
import type { IVerifiedDeviceIdentity } from '@onekeyhq/kit-bg/src/dbs/local/verifiedDeviceIdentity';
import { thirdPartyBleBindingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IThirdPartyBleBindingState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IHardwareWallet } from './types';
import type {
  SaveDeviceBindingDeclineReason,
  SaveDeviceBindingRequest,
} from '@onekeyfe/hwk-adapter-core';

/**
 * `skipped` (nothing to bind) and `mismatch` (the user picked another device)
 * both refuse the write, but only one of them is something the user did — the
 * SDK turns `mismatch` into a DeviceMismatch the app can translate.
 */
type IBindingPersistResult =
  | { saved: true }
  | { saved: false; reason: SaveDeviceBindingDeclineReason };

export function registerBleBindingUi({
  hw,
  vendor,
  onSaved,
}: {
  hw: IHardwareWallet;
  vendor: EHardwareVendor;
  onSaved?: (request: SaveDeviceBindingRequest) => Promise<void>;
}) {
  let active:
    | {
        bindingSessionId: string;
        requestId: string;
        status: IThirdPartyBleBindingState['status'];
        cancelled: boolean;
      }
    | undefined;
  let uiWrites: Promise<void> = Promise.resolve();
  const updateUi = (
    update: (
      state: IThirdPartyBleBindingState | undefined,
    ) => IThirdPartyBleBindingState | undefined,
  ) => {
    const next = uiWrites.then(async () => {
      await thirdPartyBleBindingAtom.set(update);
    });
    uiWrites = next.catch(() => {
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW] BLE binding UI update failed',
      );
    });
    return next;
  };

  hw.on(UI_REQUEST.REQUEST_SELECT_DEVICE, (event) => {
    const request = event.payload;
    if (!request.scanning || request.context.kind !== 'bind-connection') return;
    const { reason } = request.context;
    if (!active || active.requestId !== request.requestId) {
      if (active) active.cancelled = true;
      active = {
        bindingSessionId: request.bindingSessionId ?? request.requestId,
        requestId: request.requestId,
        status: 'scanning',
        cancelled: false,
      };
    }
    const owner = active;
    if (owner.cancelled || owner.status !== 'scanning') return;
    let busy = false;
    void updateUi((state) => {
      if (active !== owner || owner.cancelled) return state;
      if (
        state &&
        state.vendor !== vendor &&
        (state.status === 'scanning' || state.status === 'verifying')
      ) {
        busy = true;
        owner.cancelled = true;
        return state;
      }
      return {
        vendor,
        bindingSessionId: request.bindingSessionId ?? request.requestId,
        requestId: request.requestId,
        status: 'scanning',
        rejectedConnectId: request.rejectedConnectId,
        reason,
        targets: request.devices.map((device) => ({
          searchTargetId: device.connectId,
          searchTargetReusePolicy: resolveSearchTargetReusePolicy(device),
          vendor,
          connectionType: device.connectionType,
          kind: 'physical' as const,
          label: device.label,
          model: device.model,
          modelName: device.modelName,
          serialNumber: device.serialNumber,
        })),
      };
    })
      .then(() => {
        if (busy)
          hw.uiResponse({
            type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
            payload: { requestId: request.requestId, cancelled: true },
          });
      })
      .catch(() =>
        hw.uiResponse({
          type: UI_RESPONSE.RECEIVE_SELECT_DEVICE,
          payload: { requestId: request.requestId, cancelled: true },
        }),
      );
  });

  hw.on(UI_REQUEST.DEVICE_BINDING_STATUS, (event) => {
    if (
      active?.requestId === event.payload.selectionRequestId &&
      active.status !== 'saved'
    ) {
      active.status = event.payload.status;
      if (
        event.payload.status === 'cancelled' ||
        event.payload.status === 'failed'
      ) {
        active.cancelled = true;
      }
    }
    void updateUi((state) =>
      state?.vendor === vendor &&
      state.requestId === event.payload.selectionRequestId &&
      state.status !== 'saved'
        ? { ...state, status: event.payload.status }
        : state,
    ).catch(() => undefined);
  });

  const writes = new Map<string, Promise<void>>();
  hw.on(UI_REQUEST.REQUEST_SAVE_DEVICE_BINDING, (event) => {
    const request = event.payload;
    const owner = active;
    const isActive = () =>
      Boolean(
        owner &&
        active === owner &&
        !owner.cancelled &&
        owner.requestId === request.selectionRequestId &&
        owner.status === 'verifying',
      );
    const assertBindingActive = () => {
      if (!isActive())
        throw new OneKeyLocalError('BLE binding request is no longer active');
    };
    const dbDeviceId = request.extra?.dbDeviceId;
    const persist = async (): Promise<IBindingPersistResult> => {
      if (
        !isActive() ||
        !dbDeviceId ||
        request.identity.vendor !== vendor ||
        request.connection.transport !== 'ble'
      ) {
        return { saved: false, reason: 'skipped' };
      }
      const device = await localDb.getDevice(dbDeviceId);
      const verifiedDeviceIdentity: IVerifiedDeviceIdentity = {
        vendor,
        identity: request.identity,
      };
      // The dialog can be closed, cancelled or superseded while the read is in
      // flight. That is us dropping the request, not the user holding the wrong
      // device — only a failed identity check is a real mismatch.
      if (
        !isActive() ||
        !device ||
        device.id !== dbDeviceId ||
        !request.connection.connectId
      )
        return { saved: false, reason: 'skipped' };
      if (
        !matchesVerifiedDeviceIdentity(
          {
            vendor: device.vendor,
            deviceId: device.deviceId,
            connectId: device.connectId,
            chainFingerprints: device.settings?.chainFingerprints,
          },
          verifiedDeviceIdentity,
        )
      )
        return { saved: false, reason: 'mismatch' };
      if (
        vendor === EHardwareVendor.trezor &&
        request.identity.type === 'deviceId'
      ) {
        await localDb.updateDeviceBleConnectIdAndCleanStaleAliases({
          dbDeviceId,
          bleConnectId: request.connection.connectId,
          verifiedDeviceId: request.identity.value,
          assertBindingActive,
        });
      } else {
        await localDb.updateDeviceConnectId({
          dbDeviceId,
          connectId: request.connection.connectId,
          bleConnectId: request.connection.connectId,
          verifiedDeviceIdentity,
          assertBindingActive,
        });
      }
      // A committed binding stays saved even if its dialog closes afterwards.
      await onSaved?.(request).catch(() => {
        defaultLogger.hardware.sdkLog.log(
          '[3rdPartyHW] BLE credential persistence failed',
        );
      });
      // The DB write emits nothing on its own; device details and the wallet
      // list still show the pre-binding transport until this lands.
      appEventBus.emit(EAppEventBusNames.HardwareFeaturesUpdate, {
        deviceId: dbDeviceId,
      });
      return { saved: true };
    };
    const previous = dbDeviceId ? writes.get(dbDeviceId) : undefined;
    const write = (previous ?? Promise.resolve())
      .then(persist)
      .then(
        (result) =>
          hw.uiResponse({
            type: UI_RESPONSE.RECEIVE_SAVE_DEVICE_BINDING,
            payload: {
              requestId: request.requestId,
              ...result,
            },
          }),
        () =>
          hw.uiResponse({
            type: UI_RESPONSE.RECEIVE_SAVE_DEVICE_BINDING,
            payload: { requestId: request.requestId, saved: false },
          }),
      )
      .catch(() => {
        defaultLogger.hardware.sdkLog.log(
          '[3rdPartyHW] BLE binding response failed',
        );
      });
    if (dbDeviceId) {
      writes.set(dbDeviceId, write);
      void write.finally(() => {
        if (writes.get(dbDeviceId) === write) writes.delete(dbDeviceId);
      });
    }
  });

  return (bindingSessionId: string) => {
    const owner = active;
    if (!owner || owner.bindingSessionId !== bindingSessionId) return;
    // SDK events and cancellation share the background runtime. Do not await
    // between checking ownership, invalidating pending writes and cancelling.
    if (
      !owner.cancelled &&
      (owner.status === 'scanning' || owner.status === 'verifying')
    ) {
      owner.cancelled = true;
      hw.cancel();
    }
    void updateUi((state) =>
      state?.vendor === vendor && state.bindingSessionId === bindingSessionId
        ? undefined
        : state,
    ).catch(() => undefined);
  };
}
