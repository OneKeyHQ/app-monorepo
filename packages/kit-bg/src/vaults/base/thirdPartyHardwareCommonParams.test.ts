import {
  EHardwareVendor,
  type IDeviceSharedCallParams,
} from '@onekeyhq/shared/types/device';

import { withHardwareOperationContext } from './thirdPartyHardwareCommonParams';

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
