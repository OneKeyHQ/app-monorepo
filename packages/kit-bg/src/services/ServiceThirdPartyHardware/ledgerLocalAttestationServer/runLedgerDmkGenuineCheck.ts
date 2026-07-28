/* eslint-disable no-restricted-syntax */
import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  GenuineCheckDeviceAction,
} from '@ledgerhq/device-management-kit';
import { firstValueFrom, take, timeout } from 'rxjs';

import {
  LEDGER_ATTESTATION_RELAY_TRANSPORT_ID,
  createLedgerRelayTransportFactory,
} from './relayTransport';

import type { ILedgerRelayApduBridge } from './relayTransport';
import type { ILedgerRelayDevice } from './protocol';

export type ILedgerServerGenuineCheckResult = {
  isGenuine: boolean;
  deviceId?: string;
};

export const runLedgerDmkGenuineCheck = async (
  bridge: ILedgerRelayApduBridge,
  device: ILedgerRelayDevice,
  options?: {
    ledgerWebSocketUrl?: string;
    timeoutMs?: number;
  },
): Promise<ILedgerServerGenuineCheckResult> => {
  const timeoutMs = options?.timeoutMs ?? 5 * 60_000;
  const builder = new DeviceManagementKitBuilder().addTransport(
    createLedgerRelayTransportFactory({ bridge, device }),
  );
  if (options?.ledgerWebSocketUrl) {
    builder.addConfig({ webSocketUrl: options.ledgerWebSocketUrl });
  }
  const dmk = builder.build();
  let sessionId: string | undefined;
  try {
    const discoveredDevice = await firstValueFrom(
      dmk
        .startDiscovering({
          transport: LEDGER_ATTESTATION_RELAY_TRANSPORT_ID,
        })
        .pipe(take(1), timeout({ first: 5000 })),
    );
    sessionId = await dmk.connect({
      device: discoveredDevice,
      sessionRefresherOptions: { isRefresherDisabled: true },
    });
    const action = dmk.executeDeviceAction({
      sessionId,
      deviceAction: new GenuineCheckDeviceAction({ input: {} }),
    });
    let deviceId: string | undefined;

    return await new Promise<ILedgerServerGenuineCheckResult>(
      (resolve, reject) => {
        let settled = false;
        let subscription: { unsubscribe: () => void } | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          subscription?.unsubscribe();
          fn();
        };
        timer = setTimeout(() => {
          settle(() => {
            action.cancel();
            reject(new Error('Ledger server Genuine Check timed out'));
          });
        }, timeoutMs);
        subscription = action.observable.subscribe({
          next: (state) => {
            if (state.status === DeviceActionStatus.Pending) {
              const intermediate = state.intermediateValue as
                | {
                    deviceId?: Uint8Array;
                    requiredUserInteraction?: string;
                  }
                | undefined;
              if (intermediate?.deviceId instanceof Uint8Array && !deviceId) {
                deviceId = Buffer.from(intermediate.deviceId).toString('hex');
              }
              if (intermediate?.requiredUserInteraction) {
                bridge.onInteraction?.(intermediate.requiredUserInteraction);
              }
              return;
            }
            if (state.status === DeviceActionStatus.Completed) {
              const output = state.output as { isGenuine?: boolean };
              settle(() => {
                if (output.isGenuine && !deviceId) {
                  reject(
                    new Error(
                      'Ledger server Genuine Check succeeded without a physical-device DSID',
                    ),
                  );
                  return;
                }
                resolve({
                  isGenuine: output.isGenuine === true,
                  deviceId: output.isGenuine === true ? deviceId : undefined,
                });
              });
              return;
            }
            if (state.status === DeviceActionStatus.Error) {
              settle(() => reject(state.error));
            }
          },
          error: (error) => settle(() => reject(error)),
        });
      },
    );
  } finally {
    try {
      await dmk.stopDiscovering();
    } catch {
      // Discovery may have stopped after the first emitted device.
    }
    if (sessionId) {
      try {
        await dmk.disconnect({ sessionId });
      } catch {
        // Best-effort cleanup; the result has already been decided.
      }
    }
    dmk.close();
  }
};
