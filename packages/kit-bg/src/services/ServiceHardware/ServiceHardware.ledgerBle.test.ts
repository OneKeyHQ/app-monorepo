import { mapThirdPartyDeviceToSearchDevice } from './thirdPartyDeviceMapping';

describe('ServiceHardware Ledger BLE device mapping', () => {
  it('preserves the BLE four-character connectId and actual name when connectionType is missing', () => {
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
      name: 'Leo',
    });
  });

  it('uses the actual BLE device name instead of the vendor default', () => {
    const result = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'ledger',
        model: 'nanoX',
        firmwareVersion: '',
        deviceId: 'A58F',
        connectId: 'A58F',
        label: 'Andox',
        connectionType: 'ble',
      } as never,
      defaultDeviceName: 'Ledger',
    });

    expect(result).toMatchObject({
      connectId: 'A58F',
      name: 'Andox',
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

  it('rejects explicit BLE devices without a valid four-character connectId', () => {
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
});
