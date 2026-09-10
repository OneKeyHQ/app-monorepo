import * as vendorProfiles from '@onekeyhq/shared/src/hardware/config/vendorProfile';
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
      profile,
      'connectIdRole',
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
        interactionId: 'hwk-trezor-interaction',
      }),
    ).toEqual({
      ...deviceParams,
      deviceCommonParams: {
        ...deviceParams.deviceCommonParams,
        interactionId: 'hwk-trezor-interaction',
      },
    });
    expect(deviceParams.deviceCommonParams).not.toHaveProperty('interactionId');
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
