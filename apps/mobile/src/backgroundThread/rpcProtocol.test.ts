import {
  parseBackgroundThreadResponse,
  serializeBackgroundThreadResponse,
} from './rpcProtocol';

describe('background thread RPC protocol', () => {
  it('preserves error payload metadata across response serialization', () => {
    const payload = {
      connectId: 'CE:1F:0C:F1:CA:A9',
      deviceId: 'device-1',
      params: {
        walletId: 'wallet-1',
      },
    };
    const error = {
      name: 'OneKeyHardwareError',
      message: 'Please enable Passphrase',
      className: 'DeviceNotOpenedPassphrase',
      code: 801,
      payload,
    };

    const response = parseBackgroundThreadResponse(
      serializeBackgroundThreadResponse({
        ok: false,
        error,
      }),
    );

    expect(response?.error?.payload).toEqual(payload);
  });
});
