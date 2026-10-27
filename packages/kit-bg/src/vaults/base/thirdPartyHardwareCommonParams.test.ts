import * as vendorProfiles from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EHardwareVendor,
  type IDeviceSharedCallParams,
} from '@onekeyhq/shared/types/device';

import {
  thirdPartyConnectionContextFromDevice,
  withHardwareOperationContext,
} from './thirdPartyHardwareCommonParams';

describe('thirdPartyConnectionContextFromDevice', () => {
  it('uses the identity role rather than the vendor name', () => {
    const profile = vendorProfiles.getVendorProfile(EHardwareVendor.ledger);
    const role = jest.replaceProperty(
      profile.identity,
      'role',
      'walletIdentity',
    );
    try {
      expect(
        thirdPartyConnectionContextFromDevice({
          vendor: EHardwareVendor.ledger,
          connectId: 'logical-wallet',
          usbConnectId: 'physical-usb',
        }),
      ).toEqual({
        knownConnections: [{ transport: 'usb', connectId: 'physical-usb' }],
      });
    } finally {
      role.restore();
    }
  });
  it('keeps transport hints separate and only puts the exact DB id in extra', () => {
    expect(
      thirdPartyConnectionContextFromDevice({
        id: 'db-device',
        vendor: EHardwareVendor.trezor,
        connectId: 'legacy',
        usbConnectId: 'usb-device',
        bleConnectId: 'ble-device',
      }),
    ).toEqual({
      knownConnections: [
        { transport: 'usb', connectId: 'usb-device' },
        { transport: 'ble', connectId: 'ble-device' },
      ],
      extra: { dbDeviceId: 'db-device' },
    });
  });

  it('does not promote a stale legacy locator once a channel column exists', () => {
    // An old BLE-onboarded wallet had the same address in both columns.
    // After a rebind, the legacy column still holds the previous address, so promoting it would hand a BLE address to the USB slot on desktop.
    expect(
      thirdPartyConnectionContextFromDevice({
        vendor: EHardwareVendor.ledger,
        connectId: 'previous-ble-address',
        bleConnectId: 'rebound-ble-address',
      }),
    ).toEqual({
      knownConnections: [
        { transport: 'ble', connectId: 'rebound-ble-address' },
      ],
    });
  });

  it.each([true, false])(
    'uses the legacy platform fallback only until an explicit channel exists (native=%s)',
    (isNative) => {
      const platform = jest.replaceProperty(platformEnv, 'isNative', isNative);
      try {
        for (const vendor of [EHardwareVendor.trezor, EHardwareVendor.ledger]) {
          const record = { vendor, connectId: 'only-legacy-locator' };
          expect(thirdPartyConnectionContextFromDevice(record)).toEqual({
            knownConnections: [
              {
                transport: isNative ? 'ble' : 'usb',
                connectId: record.connectId,
              },
            ],
          });
          expect(
            thirdPartyConnectionContextFromDevice({
              ...record,
              bleConnectId: 'verified-new-ble',
            }),
          ).toEqual({
            knownConnections: [
              { transport: 'ble', connectId: 'verified-new-ble' },
            ],
          });
        }
      } finally {
        platform.restore();
      }
    },
  );

  it('declares the transports a known model can use and stays silent otherwise', () => {
    expect(
      thirdPartyConnectionContextFromDevice({
        vendor: EHardwareVendor.ledger,
        settings: { vendorModel: 'nanoSP' },
      }),
    ).toEqual({ knownConnections: [], supportedTransports: ['usb'] });
    expect(
      thirdPartyConnectionContextFromDevice({
        vendor: EHardwareVendor.trezor,
        bleConnectId: 'ble-1',
        settings: { vendorModel: 'T3W1' },
      }),
    ).toEqual({
      knownConnections: [{ transport: 'ble', connectId: 'ble-1' }],
    });
    expect(
      thirdPartyConnectionContextFromDevice({ vendor: EHardwareVendor.ledger }),
    ).toEqual({ knownConnections: [] });
  });

  it('does not invent a DB id for legacy calls', () => {
    expect(
      thirdPartyConnectionContextFromDevice({ bleConnectId: 'ble-device' }),
    ).toEqual({
      knownConnections: [{ transport: 'ble', connectId: 'ble-device' }],
    });
    expect(thirdPartyConnectionContextFromDevice()).toEqual({});
  });

  it('does not interpret a Keystone wallet id as a USB address', () => {
    expect(
      thirdPartyConnectionContextFromDevice({
        vendor: EHardwareVendor.keystone,
        connectId: 'wallet-id',
      }),
    ).toEqual({ knownConnections: [] });
  });
});

describe('withHardwareOperationContext', () => {
  it('adds operation context without replacing existing device parameters', () => {
    const deviceParams = {
      dbDevice: {
        id: 'device-1',
        connectId: 'connect-1',
        deviceId: 'device-id-1',
        vendor: EHardwareVendor.trezor,
      },
      deviceCommonParams: {
        passphraseState: 'passphrase-state',
        useEmptyPassphrase: false,
      },
    } as IDeviceSharedCallParams;

    expect(
      withHardwareOperationContext(deviceParams, {
        operationId: 'hwk-trezor-interaction',
      }),
    ).toEqual({
      ...deviceParams,
      deviceCommonParams: {
        ...deviceParams.deviceCommonParams,
        operationId: 'hwk-trezor-interaction',
      },
    });
    expect(deviceParams.deviceCommonParams).not.toHaveProperty('operationId');
  });

  it('returns the original parameters when no operation context is provided', () => {
    const deviceParams = {
      dbDevice: {
        id: 'device-1',
        connectId: 'connect-1',
        deviceId: 'device-id-1',
      },
    } as IDeviceSharedCallParams;

    expect(withHardwareOperationContext(deviceParams, undefined)).toBe(
      deviceParams,
    );
  });
});
