import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { mapThirdPartyDeviceToSearchDevice } from './thirdPartyDeviceMapping';

describe('ServiceHardware Ledger BLE device mapping', () => {
  it('preserves the BLE connectId and actual name when connectionType is missing', () => {
    const ledgerDevice = {
      vendor: 'ledger',
      model: 'nanoX',
      firmwareVersion: '',
      deviceId: '0738',
      connectId: '0738',
      label: 'Leo',
    };

    const result = mapThirdPartyDeviceToSearchDevice({
      device: ledgerDevice as never,
      defaultDeviceName: 'Ledger',
    });

    expect(result).toMatchObject({
      connectId: '0738',
      deviceId: null,
      name: 'Leo',
    });
  });

  it('falls back to the device model when the BLE device has no name', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'ledger',
        model: 'nanoX',
        firmwareVersion: '',
        deviceId: 'A58F',
        connectId: 'A58F',
        connectionType: 'ble',
      } as never,
      defaultDeviceName: 'Ledger',
    });

    expect(result).toMatchObject({
      connectId: 'A58F',
      name: 'nanoX',
    });
  });

  it('treats explicit USB devices as USB even when connectId looks like a BLE id', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'ledger',
        model: 'nanoX',
        firmwareVersion: '',
        deviceId: 'A58F',
        connectId: 'A58F',
        label: 'Andox',
        connectionType: 'usb',
      } as never,
      defaultDeviceName: 'Ledger',
      canMatchDeviceByConnectId: () => true,
    });

    expect(result).toMatchObject({
      connectId: null,
      name: 'Andox',
    });
  });

  it('preserves Trezor USB connectId because it is a stable serial number', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'trezor',
        model: 'T3W1',
        firmwareVersion: '',
        deviceId: 'TREZOR-FEATURES-DEVICE-ID',
        connectId: 'A37803C61D8DCB1542D7AEE7',
        label: 'Trezor Safe 7',
        connectionType: 'usb',
      } as never,
      defaultDeviceName: 'Trezor',
      hasPersistentConnectId: () => true,
      hasPersistentDeviceId: () => true,
    });

    expect(result).toMatchObject({
      connectId: 'A37803C61D8DCB1542D7AEE7',
      deviceId: 'TREZOR-FEATURES-DEVICE-ID',
      name: 'Trezor Safe 7',
    });
  });

  it('preserves Trezor BLE connectId as handle and firmware deviceId as identity', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'trezor',
        model: 'T3W1',
        firmwareVersion: '',
        deviceId: 'TREZOR-FEATURES-DEVICE-ID',
        connectId: '81a6048ecf0d10bcf684e8a0b0b700b8',
        label: 'n',
        connectionType: 'ble',
      } as never,
      defaultDeviceName: 'Trezor',
      hasPersistentConnectId: () => true,
      hasPersistentDeviceId: () => true,
    });

    expect(result).toMatchObject({
      connectId: '81a6048ecf0d10bcf684e8a0b0b700b8',
      deviceId: 'TREZOR-FEATURES-DEVICE-ID',
      name: 'n',
    });
    expect(result.deviceId).not.toBe(result.connectId);
  });

  it('uses firmware device_id instead of Trezor USB serial when creating raw device id', () => {
    const rawDeviceId = deviceUtils.getRawDeviceId({
      device: {
        connectId: 'A37803C61D8DCB1542D7AEE7',
        deviceId: 'A37803C61D8DCB1542D7AEE7',
        name: 'Trezor Safe 7',
        deviceType: 'unknown',
        uuid: '',
      } as never,
      features: {
        vendor: 'trezor',
        device_id: 'TREZOR-FEATURES-DEVICE-ID',
      } as never,
      // Trezor (third-party): prefer firmware device_id over the USB serial.
      isThirdParty: true,
    });

    expect(rawDeviceId).toBe('TREZOR-FEATURES-DEVICE-ID');
  });

  it('rejects explicit BLE devices when connectId is empty', () => {
    expect(() =>
      mapThirdPartyDeviceToSearchDevice({
        device: {
          vendor: 'ledger',
          model: 'nanoX',
          firmwareVersion: '',
          deviceId: '',
          connectId: '',
          label: 'Leo',
          connectionType: 'ble',
        } as never,
        defaultDeviceName: 'Ledger',
      }),
    ).toThrow('Third-party BLE connectId is required');
  });

  it('accepts Android-style BLE MAC connectId', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'ledger',
        model: 'nanoX',
        firmwareVersion: '',
        deviceId: 'D5:75:7D:4B:51:E8',
        connectId: 'D5:75:7D:4B:51:E8',
        label: 'Nano X 1456',
        connectionType: 'ble',
      } as never,
      defaultDeviceName: 'Ledger',
    });

    expect(result).toMatchObject({
      connectId: 'D5:75:7D:4B:51:E8',
      name: 'Nano X 1456',
    });
  });

  it('accepts iOS-style BLE CoreBluetooth UUID connectId', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'ledger',
        model: 'nanoX',
        firmwareVersion: '',
        deviceId: 'ACE4CF88-3DC0-E39F-1E5C-CC707B1E3F64',
        connectId: 'ACE4CF88-3DC0-E39F-1E5C-CC707B1E3F64',
        label: 'Nano X 1456',
        connectionType: 'ble',
      } as never,
      defaultDeviceName: 'Ledger',
    });

    expect(result).toMatchObject({
      connectId: 'ACE4CF88-3DC0-E39F-1E5C-CC707B1E3F64',
      name: 'Nano X 1456',
    });
  });
});
