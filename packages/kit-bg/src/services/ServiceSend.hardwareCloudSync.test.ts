import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EMessageTypesBtc } from '@onekeyhq/shared/types/message';

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
  const prompt = jest.fn();
  const signMessage = jest.fn();
  Object.defineProperty(service, 'backgroundApi', {
    value: { servicePassword: { promptPasswordVerifyByAccount: prompt } },
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

  test('checks the actual DB path before password prompt or keyring signing', async () => {
    const h = createHarness(HARDWARE_CLOUD_SYNC_PATH);
    await expect(
      h.service.signMessage({
        accountId: 'hd-1--opaque-account-id',
        networkId: 'btc--0',
        unsignedMessage: {
          type: EMessageTypesBtc.ECDSA,
          message: 'ordinary message',
        },
      }),
    ).rejects.toThrow('OneKey Cloud key operations');
    expect(h.prompt).not.toHaveBeenCalled();
    expect(h.signMessage).not.toHaveBeenCalled();
  });
});
