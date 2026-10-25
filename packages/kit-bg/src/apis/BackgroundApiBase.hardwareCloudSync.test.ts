import { SignTypedDataVersion, TypedDataUtils } from '@metamask/eth-sig-util';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncMessage,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';

import BackgroundApiBase from './BackgroundApiBase';

jest.mock('./TravelModeDappRequestIngress', () => ({
  travelModeDappRequestIngress: {
    run: <T>({ operation }: { operation: () => T | Promise<T> }) => operation(),
  },
}));

function createHarness() {
  const backgroundApi = Object.create(
    BackgroundApiBase.prototype,
  ) as BackgroundApiBase;
  const handleMethods = jest.fn(async () => 'dispatched');
  const getProviderApi = jest.fn(async () => ({ handleMethods }));
  Object.defineProperty(backgroundApi, 'getProviderApi', {
    value: getProviderApi,
  });
  return { backgroundApi, handleMethods, getProviderApi };
}

const typedData = {
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    PublicMemo: [{ name: 'body', type: 'string' }],
  },
  primaryType: 'PublicMemo' as const,
  domain: { name: 'Example Memo' },
  message: { body: 'a'.repeat(17 * 1024) },
};

describe('provider ingress delegates protocol-specific message validation', () => {
  test.each([typedData, JSON.stringify(typedData)])(
    'dispatches a valid EIP-712 message above 16 KiB in either representation',
    async (message) => {
      const h = createHarness();
      const data =
        typeof message === 'string'
          ? (JSON.parse(message) as typeof typedData)
          : message;
      expect(
        TypedDataUtils.eip712Hash(data, SignTypedDataVersion.V4),
      ).toHaveLength(32);
      expect(Buffer.byteLength(JSON.stringify(typedData))).toBeGreaterThan(
        16_384,
      );
      await expect(
        h.backgroundApi.handleProviderMethods({
          data: {
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_signTypedData_v4',
            params: [`0x${'11'.repeat(20)}`, message],
          },
          origin: 'https://example.com',
          scope: IInjectedProviderNames.ethereum,
        }),
      ).resolves.toMatchObject({ result: 'dispatched' });
      expect(h.handleMethods).toHaveBeenCalledTimes(1);
    },
  );

  test('does not interpret ordinary RPC metadata as a BTC signing message', async () => {
    const h = createHarness();
    await expect(
      h.backgroundApi.handleProviderMethods({
        data: {
          id: 2,
          jsonrpc: '2.0',
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainName: buildHardwareCloudSyncMessage('0123456789abcdef'),
              metadata: { path: HARDWARE_CLOUD_SYNC_PATH },
            },
          ],
        },
        origin: 'https://example.com',
        scope: IInjectedProviderNames.ethereum,
      }),
    ).resolves.toMatchObject({ result: 'dispatched' });
    expect(h.getProviderApi).toHaveBeenCalledTimes(1);
  });
});
