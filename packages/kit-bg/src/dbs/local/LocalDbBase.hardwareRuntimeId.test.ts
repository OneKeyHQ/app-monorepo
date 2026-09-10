import {
  createHardwareInteractionId,
  createHardwareSearchTargetId,
} from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';

import type { IDBCreateHwWalletParams } from './types';

function buildParams(
  field: 'connectId' | 'deviceId',
  value: string,
): IDBCreateHwWalletParams {
  return {
    device: {
      connectId: 'keystone-wallet:stable-wallet-id',
      deviceId: 'stable-wallet-id',
      name: 'Keystone',
      [field]: value,
    },
    features: {},
    vendor: EHardwareVendor.keystone,
  } as IDBCreateHwWalletParams;
}

describe('LocalDbBase hardware runtime id persistence guard', () => {
  it.each([
    [
      'search target',
      buildParams(
        'connectId',
        createHardwareSearchTargetId({
          vendor: 'keystone',
          connectionType: 'usb',
        }),
      ),
      'device.connectId',
    ],
    [
      'interaction',
      buildParams('deviceId', createHardwareInteractionId('keystone')),
      'device.deviceId',
    ],
  ])(
    'rejects a %s before opening a DB transaction',
    async (_, params, field) => {
      const db = Object.create(LocalDbBase.prototype) as LocalDbBase;

      await expect(db.createHwWallet(params)).rejects.toThrow(
        `runtime hardware id cannot be persisted in ${field}`,
      );
    },
  );

  it('rejects runtime ids from direct transport locator updates', async () => {
    const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
    const interactionId = createHardwareInteractionId('trezor');

    await expect(
      db.updateDeviceConnectId({
        dbDeviceId: 'db-device-id',
        connectId: interactionId,
      }),
    ).rejects.toThrow(
      'updateDeviceConnectId ERROR: runtime hardware id cannot be persisted in connectId',
    );

    await expect(
      db.updateDeviceConnectId({
        dbDeviceId: 'db-device-id',
        usbConnectId: interactionId,
      }),
    ).rejects.toThrow(
      'updateDeviceConnectId ERROR: runtime hardware id cannot be persisted in usbConnectId',
    );
    await expect(
      db.updateDeviceBleConnectIdAndCleanStaleAliases({
        dbDeviceId: 'db-device-id',
        bleConnectId: interactionId,
        verifiedDeviceId: 'stable-device-id',
      }),
    ).rejects.toThrow(
      'updateDeviceBleConnectIdAndCleanStaleAliases ERROR: runtime hardware id cannot be persisted in bleConnectId',
    );
  });
});
