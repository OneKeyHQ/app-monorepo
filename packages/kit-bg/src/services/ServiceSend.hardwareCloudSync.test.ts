import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import {
  EMessageTypesBtc,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';

import ServiceSend from './ServiceSend';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const logger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => logger,
  });
  return { defaultLogger: logger };
});
jest.mock('./ServiceBase', () => ({ __esModule: true, default: class {} }));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

function createHarness(path = "m/44'/0'/0'") {
  const service = Object.create(ServiceSend.prototype) as ServiceSend;
  const prompt = jest.fn(async () => ({ password: 'synthetic-test-password' }));
  const signMessage = jest.fn(async (_params: { messages: unknown[] }) => [
    'synthetic-test-result',
  ]);
  const withHardwareProcessing = jest.fn(
    async (operation: () => Promise<unknown>) => operation(),
  );
  Object.defineProperty(service, 'backgroundApi', {
    value: {
      servicePassword: { promptPasswordVerifyByAccount: prompt },
      serviceHardwareUI: { withHardwareProcessing },
    },
  });
  jest.mocked(vaultFactory.getVault).mockResolvedValue({
    getAccount: async () => ({ path }),
    keyring: { signMessage },
  } as unknown as Awaited<ReturnType<typeof vaultFactory.getVault>>);
  return { service, prompt, signMessage };
}

describe('final background Cloud key signing boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects root text even when a request declares itself internal', async () => {
    const h = createHarness();
    await expect(
      h.service.signMessage({
        accountId: "hd-1--m/44'/0'/0'/0/0",
        networkId: 'btc--0',
        unsignedMessage: {
          type: EMessageTypesBtc.ECDSA,
          message: buildHardwareCloudSyncMessage('0123456789abcdef'),
          payload: { isFromDApp: false },
        },
      }),
    ).rejects.toThrow('OneKey Cloud key operations');
    expect(vaultFactory.getVault).not.toHaveBeenCalled();
    expect(h.prompt).not.toHaveBeenCalled();
    expect(h.signMessage).not.toHaveBeenCalled();
  });

  test('allows an ordinary message at BTC Legacy account index 100', async () => {
    const h = createHarness(HARDWARE_CLOUD_SYNC_PATH);
    await expect(
      h.service.signMessage({
        accountId: "hd-1--m/44'/0'/100'/0/0",
        networkId: 'btc--0',
        unsignedMessage: {
          type: EMessageTypesBtc.ECDSA,
          message: 'ordinary message',
        },
      }),
    ).resolves.toBe('synthetic-test-result');
    expect(h.prompt).toHaveBeenCalledTimes(1);
    expect(h.signMessage).toHaveBeenCalledTimes(1);
  });

  test.each(['string', 'object'] as const)(
    'permits large EIP-712 %s messages after normal JSON serialization',
    async (representation) => {
      const h = createHarness();
      const typedData = {
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }],
          PublicMemo: [{ name: 'body', type: 'string' }],
        },
        primaryType: 'PublicMemo',
        domain: { name: 'Example Memo' },
        message: { body: 'a'.repeat(17 * 1024) },
      };
      // The provider accepts both representations despite the narrower RPC type.
      const message = (representation === 'string'
        ? JSON.stringify(typedData)
        : typedData) as unknown as string;
      await expect(
        h.service.signMessage({
          accountId: "hd-1--m/44'/60'/0'/0/0",
          networkId: 'evm--1',
          unsignedMessage: { type: EMessageTypesEth.TYPED_DATA_V4, message },
        }),
      ).resolves.toBe('synthetic-test-result');
      expect(h.signMessage).toHaveBeenCalledTimes(1);
      expect(h.signMessage.mock.calls[0][0]).toMatchObject({
        messages: [{ message: JSON.stringify(typedData) }],
      });
    },
  );

  test('does not inspect unsigned-message metadata as actual BTC bytes', async () => {
    const h = createHarness(HARDWARE_CLOUD_SYNC_PATH);
    const payload = {
      isFromDApp: true,
      message: buildHardwareCloudSyncMessage('0123456789abcdef'),
      path: HARDWARE_CLOUD_SYNC_PATH,
    };
    await expect(
      h.service.signMessage({
        accountId: "hd-1--m/44'/0'/100'/0/0",
        networkId: 'btc--0',
        unsignedMessage: {
          type: EMessageTypesBtc.ECDSA,
          message: 'ordinary message',
          payload,
        },
      }),
    ).resolves.toBe('synthetic-test-result');
    expect(h.signMessage).toHaveBeenCalledTimes(1);
  });
});
