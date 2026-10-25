import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EMessageTypesBtc } from '@onekeyhq/shared/types/message';

import ProviderApiBtc from './ProviderApiBtc';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const dappRequest = jest.fn();
  const logger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: (_target, key) => (key === 'dappRequest' ? dappRequest : logger),
  });
  return { defaultLogger: logger };
});
jest.mock('./backgroundProviders', () => ({ providerApiLoaders: {} }));

function harness() {
  const provider = Object.create(ProviderApiBtc.prototype) as ProviderApiBtc;
  const openSignMessageModal = jest.fn(async () => '00');
  const checkIfEnableConnect = jest.fn(async () => undefined);
  const getAccountsInfo = jest.fn(async () => [
    {
      accountInfo: { accountId: 'hd-test', networkId: 'btc--0' },
    },
  ]);
  Object.assign(provider, {
    backgroundApi: { serviceDApp: { openSignMessageModal } },
    checkIfEnableConnect,
    getAccountsInfo,
  });
  const log = jest.spyOn(defaultLogger.discovery.dapp, 'dappRequest');
  return { provider, openSignMessageModal, getAccountsInfo, log };
}

const message = buildHardwareCloudSyncMessage('0123456789abcdef');
const baseRequest: IJsBridgeMessagePayload = {
  origin: 'https://example.com',
  scope: IInjectedProviderNames.btc,
  data: { method: 'signMessage' },
};

describe('BTC provider checks its actual parsed message before logging', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([false, true])(
    'rejects exact JSON-RPC message, WalletConnect=%s',
    async (isWalletConnectRequest) => {
      const h = harness();
      const parsed = JSON.parse(
        JSON.stringify({
          padding: 'a'.repeat(32_768),
          params: {
            message,
            type: EMessageTypesBtc.ECDSA,
            walletInternalSign: true,
          },
        }).replace('WARNING', '\\u0057ARNING'),
      ) as {
        params: { message: string; type: EMessageTypesBtc.ECDSA };
      };
      await expect(
        h.provider.signMessage(
          {
            ...baseRequest,
            isWalletConnectRequest,
          },
          parsed.params,
        ),
      ).rejects.toThrow('OneKey Cloud key operations');
      expect(h.getAccountsInfo).not.toHaveBeenCalled();
      expect(h.openSignMessageModal).not.toHaveBeenCalled();
      expect(h.log).not.toHaveBeenCalled();
    },
  );

  test.each([
    'ordinary message',
    `${message} extra bytes`,
    Buffer.from(message).toString('hex'),
    Buffer.from(message).toString('base64'),
    JSON.stringify({ message }),
    'a'.repeat(32_768),
  ])('preserves different literal BTC messages', async (literal) => {
    const h = harness();
    await expect(
      h.provider.signMessage(baseRequest, {
        message: literal,
        type: EMessageTypesBtc.ECDSA,
      }),
    ).resolves.toBe('AA==');
    expect(h.openSignMessageModal).toHaveBeenCalledWith(
      expect.objectContaining({
        unsignedMessage: expect.objectContaining({ message: literal }),
      }),
    );
  });

  test('does not inspect request metadata in place of the real message', async () => {
    const h = harness();
    await expect(
      h.provider.signMessage(
        {
          ...baseRequest,
          data: { metadata: { message, path: HARDWARE_CLOUD_SYNC_PATH } },
        },
        { message: 'ordinary message', type: EMessageTypesBtc.ECDSA },
      ),
    ).resolves.toBe('AA==');
  });
});
