import {
  ApduResponse,
  GeneralDmkError,
  TransportConnectedDevice,
  UnknownDeviceError,
} from '@ledgerhq/device-management-kit';
import { Left, Right } from 'purify-ts';
import { of } from 'rxjs';

import type {
  DeviceModelId,
  Transport,
  TransportFactory,
} from '@ledgerhq/device-management-kit';

import type { ILedgerRelayDevice } from './protocol';

export const LEDGER_ATTESTATION_RELAY_TRANSPORT_ID =
  'ONEKEY_LEDGER_ATTESTATION_RELAY';

export type ILedgerRelayApduResponse = {
  data: Uint8Array;
  statusCode: Uint8Array;
};

export type ILedgerRelayApduBridge = {
  exchangeApdu: (
    apdu: Uint8Array,
    timeoutMs?: number,
  ) => Promise<ILedgerRelayApduResponse>;
  onInteraction?: (requiredUserInteraction: string) => void;
};

export const createLedgerRelayTransportFactory =
  ({
    bridge,
    device,
  }: {
    bridge: ILedgerRelayApduBridge;
    device: ILedgerRelayDevice;
  }): TransportFactory =>
  (args) => {
    const deviceModel = args.deviceModelDataSource.getDeviceModel({
      id: device.modelId as DeviceModelId,
    });
    const discoveredDevice = {
      id: device.id,
      deviceModel,
      transport: LEDGER_ATTESTATION_RELAY_TRANSPORT_ID,
      name: device.name,
    };
    let connectedDevice: TransportConnectedDevice | undefined;

    const transport: Transport = {
      getIdentifier: () => LEDGER_ATTESTATION_RELAY_TRANSPORT_ID,
      isSupported: () => true,
      startDiscovering: () => of(discoveredDevice),
      stopDiscovering: () => undefined,
      listenToAvailableDevices: () => of([discoveredDevice]),
      connect: async ({ deviceId }) => {
        if (deviceId !== device.id) {
          return Left(new UnknownDeviceError());
        }
        if (!connectedDevice) {
          connectedDevice = new TransportConnectedDevice({
            id: device.id,
            deviceModel,
            type: device.connectionType ?? 'USB',
            transport: LEDGER_ATTESTATION_RELAY_TRANSPORT_ID,
            name: device.name,
            sendApdu: async (apdu, _triggersDisconnection, abortTimeout) => {
              try {
                const response = await bridge.exchangeApdu(apdu, abortTimeout);
                return Right(new ApduResponse(response));
              } catch (error) {
                return Left(new GeneralDmkError(error));
              }
            },
          });
        }
        return Right(connectedDevice);
      },
      disconnect: async () => {
        connectedDevice = undefined;
        return Right(undefined);
      },
    };
    return transport;
  };
