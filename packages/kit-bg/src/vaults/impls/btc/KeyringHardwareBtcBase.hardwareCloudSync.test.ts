import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EMessageTypesBtc } from '@onekeyhq/shared/types/message';

import { KeyringHardware as KeyringLightning } from '../lightning/KeyringHardware';

import { KeyringHardwareBtcBase } from './KeyringHardwareBtcBase';
import { KeyringHardwareKeystone } from './KeyringHardwareKeystone';
import { KeyringHardwareLedger } from './KeyringHardwareLedger';
import {
  KeyringHardwareTrezor,
  buildTrezorBtcSignMessageParams,
} from './KeyringHardwareTrezor';

import type { ISignMessageParams } from '../../types';

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const logger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => logger,
  });
  return { defaultLogger: logger };
});
jest.mock('../../../providers/backgroundProviders', () => ({
  providerApiLoaders: {},
}));

const message = buildHardwareCloudSyncMessage(
  '0123456789abcdef',
  '0123456789abcdef0123456789abcdef',
);
const deviceParams: IDeviceSharedCallParams = {
  dbDevice: {
    id: 'public-test-device',
    name: 'Synthetic test device',
    connectId: 'public-test-connect',
    deviceId: 'public-test-device-id',
    deviceType: EDeviceType.Classic1s,
    uuid: 'public-test-uuid',
    features: '{}',
    settingsRaw: '{}',
    createdAt: 0,
    updatedAt: 0,
  },
  deviceCommonParams: {
    passphraseState: undefined,
    useEmptyPassphrase: true,
    connectProtocol: 'V1',
  },
};

function params(text: string) {
  return {
    messages: [
      {
        type: EMessageTypesBtc.ECDSA,
        message: text,
        payload: { isFromDApp: false },
      },
    ],
    password: '',
    deviceParams,
  } satisfies ISignMessageParams;
}

function oneKeyHarness() {
  const btcSignMessage = jest.fn(async () => ({
    success: true,
    payload: { signature: 'synthetic-test-result' },
  }));
  const sdk = jest.fn(async () => ({ btcSignMessage }));
  const keyring = Object.assign(
    Object.create(KeyringHardwareBtcBase.prototype) as KeyringHardwareBtcBase,
    {
      getNetwork: async () => ({ isTestnet: false }),
      coreApi: { getCoinName: async () => 'Bitcoin' },
      vault: {
        getAccount: async () => ({ path: "m/44'/0'/100'", relPath: '0/0' }),
      },
      getHardwareSDKInstance: sdk,
    },
  );
  return { keyring, btcSignMessage, sdk };
}

describe('BTC hardware boundaries compare the actual signed message', () => {
  test.each([
    { name: 'OneKey', prototype: KeyringHardwareBtcBase.prototype },
    { name: 'Trezor', prototype: KeyringHardwareTrezor.prototype },
    { name: 'Ledger', prototype: KeyringHardwareLedger.prototype },
    { name: 'Keystone', prototype: KeyringHardwareKeystone.prototype },
    { name: 'Lightning', prototype: KeyringLightning.prototype },
  ])(
    '$name rejects root text before resolving a device or SDK',
    async ({ prototype }) => {
      const keyring = Object.create(prototype) as KeyringHardwareBtcBase;
      const sdk = jest.fn();
      Object.assign(keyring, { getHardwareSDKInstance: sdk });
      // No vault/device methods are supplied: the guard must run first.
      await expect(keyring.signMessage(params(message))).rejects.toThrow(
        'OneKey Cloud key operations',
      );
      expect(sdk).not.toHaveBeenCalled();
    },
  );

  test.each(
    [
      { type: 'Buffer', data: [...Buffer.from(message)] },
      new Uint16Array(Buffer.from(message)),
    ].map((value) => ({ value })),
  )(
    'the final OneKey messageHex guard catches untyped values normalized by Buffer.from',
    async ({ value }) => {
      const h = oneKeyHarness();
      const request = params('placeholder');
      // An untyped bridge may carry Buffer's JSON representation instead of text.
      request.messages[0].message = value as unknown as string;
      await expect(h.keyring.signMessage(request)).rejects.toThrow(
        'OneKey Cloud key operations',
      );
      expect(h.btcSignMessage).not.toHaveBeenCalled();
    },
  );

  test.each([
    'ordinary message',
    `${message} extra bytes`,
    Buffer.from(message).toString('hex'),
    Buffer.from(message).toString('base64'),
    JSON.stringify({ message }),
    'a'.repeat(32_768),
  ])(
    'passes different literal bytes unchanged at account index 100',
    async (literal) => {
      const h = oneKeyHarness();
      await expect(h.keyring.signMessage(params(literal))).resolves.toEqual([
        'synthetic-test-result',
      ]);
      expect(h.btcSignMessage).toHaveBeenCalledWith(
        'public-test-connect',
        'public-test-device-id',
        expect.objectContaining({
          // The ordinary 101st Legacy account, not the Cloud key path.
          path: "m/44'/0'/100'/0/0",
          coin: 'Bitcoin',
          messageHex: Buffer.from(literal).toString('hex'),
        }),
      );
    },
  );

  test('does not permit an external internal-sign flag to bypass the final Trezor encoding guard', () => {
    expect(() =>
      buildTrezorBtcSignMessageParams({
        path: HARDWARE_CLOUD_SYNC_PATH,
        coin: 'Bitcoin',
        message: params(message).messages[0],
      }),
    ).toThrow('OneKey Cloud key operations');
  });
});
