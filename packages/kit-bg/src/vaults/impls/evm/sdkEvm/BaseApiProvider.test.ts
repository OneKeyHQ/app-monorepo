import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import { BaseApiProvider } from './BaseApiProvider';

const networkId = 'evm--1118';

function createProvider({
  network,
  storedTokens = [],
}: {
  network?: Partial<IServerNetwork>;
  storedTokens?: IToken[];
}) {
  const tokens = new Map(storedTokens.map((t) => [t.address, t]));
  const getTokens = jest.fn(
    async ({ tokenIdOnNetworkList }: { tokenIdOnNetworkList: string[] }) =>
      tokenIdOnNetworkList
        .map((address) => tokens.get(address))
        .filter((t): t is IToken => !!t),
  );
  const updateTokens = jest.fn(
    async ({ tokens: nextTokens }: { tokens: IToken[] }) => {
      nextTokens.forEach((t) => tokens.set(t.address, t));
    },
  );
  const getNetworkSafe = jest.fn(async () => network);
  const backgroundApi = {
    simpleDb: { localTokens: { getTokens, updateTokens } },
    serviceNetwork: { getNetworkSafe },
  } as unknown as IBackgroundApi;

  const provider = new BaseApiProvider({
    url: 'https://rpc.example.invalid',
    networkId,
    backgroundApi,
  });
  return { provider, updateTokens, getNetworkSafe };
}

describe('BaseApiProvider.getNativeToken', () => {
  it('rebuilds a cleared native token row from the network record', async () => {
    const { provider, updateTokens, getNetworkSafe } = createProvider({
      network: { id: networkId, symbol: 'MARS', decimals: 18 },
    });

    const token = await provider.getNativeToken();

    expect(token.info).toMatchObject({
      symbol: 'MARS',
      name: 'MARS',
      decimals: 18,
      isNative: true,
      address: '',
      networkId,
    });
    expect(updateTokens).toHaveBeenCalledWith({
      networkId,
      tokens: [
        {
          decimals: 18,
          name: 'MARS',
          symbol: 'MARS',
          address: '',
          logoURI: '',
          isNative: true,
        },
      ],
    });

    // The restored row serves later calls without another network lookup.
    await provider.getNativeToken();
    expect(getNetworkSafe).toHaveBeenCalledTimes(1);
    expect(updateTokens).toHaveBeenCalledTimes(1);
  });

  it('keeps the stored native token when the row exists', async () => {
    const { provider, getNetworkSafe } = createProvider({
      network: { id: networkId, symbol: 'MARS', decimals: 18 },
      storedTokens: [
        {
          decimals: 8,
          name: 'Mars Coin',
          symbol: 'MRC',
          address: '',
          isNative: true,
        },
      ],
    });

    const token = await provider.getNativeToken();

    expect(token.info).toMatchObject({
      name: 'Mars Coin',
      symbol: 'MRC',
      decimals: 8,
    });
    expect(getNetworkSafe).not.toHaveBeenCalled();
  });

  it('still fails when neither the row nor the network is available', async () => {
    const { provider, updateTokens } = createProvider({ network: undefined });

    await expect(provider.getNativeToken()).rejects.toThrow(
      'getNativeToken failed',
    );
    expect(updateTokens).not.toHaveBeenCalled();
  });
});
