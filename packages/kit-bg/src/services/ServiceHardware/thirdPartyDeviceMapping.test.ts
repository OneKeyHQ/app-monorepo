import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  mapThirdPartyDeviceToSearchDevice,
  mapThirdPartySearchTargetToSearchDevice,
  normalizeThirdPartySearchDevicesForTransport,
} from './thirdPartyDeviceMapping';

import type { DeviceInfo } from './adapters/types';

describe('mapThirdPartySearchTargetToSearchDevice', () => {
  it.each([
    EHardwareVendor.ledger,
    EHardwareVendor.trezor,
    EHardwareVendor.keystone,
  ])('preserves %s routing before a database record exists', (vendor) => {
    expect(
      mapThirdPartySearchTargetToSearchDevice({
        target: {
          searchTargetId: 'fresh-target',
          searchTargetReusePolicy: 'current-discovery',
          vendor,
          connectionType: 'usb',
          kind: 'physical',
        },
      }),
    ).toMatchObject({ vendor });
  });

  it('keeps an ephemeral Ledger USB target out of legacy ids', () => {
    const target = {
      searchTargetId: 'ledger-usb-ephemeral',
      searchTargetReusePolicy: 'current-discovery' as const,
      vendor: EHardwareVendor.ledger,
      connectionType: 'usb' as const,
      kind: 'physical' as const,
      model: 'nanoX',
    };

    const mapped = mapThirdPartySearchTargetToSearchDevice({
      target,
      defaultDeviceName: 'Ledger',
    });

    expect(mapped.connectId).toBeNull();
    expect(mapped.deviceId).toBeNull();
    expect(mapped.name).toBe('Ledger nanoX');
    expect(
      (mapped as typeof mapped & { raw?: Record<string, unknown> }).raw,
    ).toEqual(expect.objectContaining({ searchTarget: target }));
  });

  it('keeps only reconnectable search handles in the legacy connectId slot', () => {
    const mapped = mapThirdPartySearchTargetToSearchDevice({
      target: {
        searchTargetId: 'trezor-usb-serial',
        searchTargetReusePolicy: 'reconnectable',
        vendor: EHardwareVendor.trezor,
        connectionType: 'usb',
        kind: 'physical',
      },
    });

    expect(mapped.connectId).toBe('trezor-usb-serial');
    expect(mapped.deviceId).toBeNull();
  });
});

function createDevice({
  connectionType,
  availableChannels,
}: {
  connectionType: 'usb' | 'ble' | 'qr';
  availableChannels?: Array<'usb' | 'ble' | 'qr'>;
}): DeviceInfo {
  return {
    vendor: 'keystone',
    model: 'Keystone',
    firmwareVersion: '1.0.0',
    deviceId: 'device-id',
    connectId: 'connect-id',
    connectionType,
    capabilities: { persistentDeviceIdentity: true },
    raw: { availableChannels },
  } as DeviceInfo;
}

describe('normalizeThirdPartySearchDevicesForTransport', () => {
  it('keeps a multi-channel device and attributes the requested QR transport', () => {
    const device = createDevice({
      connectionType: 'usb',
      availableChannels: ['qr', 'usb'],
    });

    expect(
      normalizeThirdPartySearchDevicesForTransport({
        devices: [device],
        transportType: 'qr',
      }),
    ).toEqual([{ ...device, connectionType: 'qr' }]);
  });

  it('drops a device that cannot use the requested transport', () => {
    const device = createDevice({
      connectionType: 'usb',
      availableChannels: ['usb'],
    });

    expect(
      normalizeThirdPartySearchDevicesForTransport({
        devices: [device],
        transportType: 'qr',
      }),
    ).toEqual([]);
  });
});

describe('mapThirdPartyDeviceToSearchDevice', () => {
  it('uses the vendor profile when callers omit identity fallbacks', () => {
    const mapped = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'trezor',
        model: 'T',
        firmwareVersion: '2.8.8',
        deviceId: 'stable-device-id',
        connectId: 'serial',
        connectionType: 'usb',
      },
    });
    expect(mapped.connectId).toBe('serial');
    expect(mapped.deviceId).toBe('stable-device-id');
  });

  it('keeps discovery identifiers routable without showing them in the name', () => {
    const target = {
      searchTargetId: '12345678-1234-1234-1234-123456789abc',
      vendor: EHardwareVendor.keystone,
      connectionType: 'usb' as const,
      kind: 'physical' as const,
      modelName: 'Keystone 3 Pro',
      label: 'Keystone 3 Pro (12345678-1234-1234-1234-123456789abc)',
    };
    const mapped = mapThirdPartySearchTargetToSearchDevice({ target });
    expect(mapped.name).toBe('Keystone 3 Pro');
    expect(mapped).toMatchObject({ raw: { searchTarget: target } });
  });
  it('drops a serialless USB locator when the connector marks it ephemeral', () => {
    const mapped = mapThirdPartyDeviceToSearchDevice({
      device: {
        vendor: 'trezor',
        model: 'T',
        firmwareVersion: '2.8.8',
        deviceId: 'stable-device-id',
        connectId: '0',
        connectionType: 'usb',
        capabilities: { persistentDeviceIdentity: false },
      },
      hasPersistentConnectId: () => true,
      hasPersistentDeviceId: () => true,
    });

    expect(mapped.connectId).toBeNull();
    expect(mapped.deviceId).toBe('stable-device-id');
  });

  it('keeps a QR search target routable without treating it as a wallet identity', () => {
    const target: DeviceInfo = {
      vendor: 'keystone',
      model: '',
      firmwareVersion: '0.0.0',
      deviceId: '',
      connectId: 'keystone-qr:connect',
      connectionType: 'qr',
      capabilities: { persistentDeviceIdentity: false },
    };

    const mapped = mapThirdPartyDeviceToSearchDevice({
      device: target,
      defaultDeviceName: 'Keystone',
      canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
      hasPersistentConnectId: () => true,
      hasPersistentDeviceId: () => true,
    });

    expect(mapped.connectId).toBe(target.connectId);
    expect(mapped.deviceId).toBeNull();
    expect(mapped.name).toBe('Keystone');
    const mappedRaw = (
      mapped as typeof mapped & { raw?: Record<string, unknown> }
    ).raw;
    expect(mappedRaw).toEqual(
      expect.objectContaining({
        connectId: target.connectId,
        deviceId: '',
        connectionType: 'qr',
        capabilities: { persistentDeviceIdentity: false },
      }),
    );
  });
});
