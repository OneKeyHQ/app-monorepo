import ClientSol from './ClientSol';

const ASSET_ID = 'Hk561CaUF6EeSQQus7b6U2eiSi1cafW2NvrCZEB4grT2';

function buildClient() {
  const sendProxyRequest = jest.fn();
  const client = new ClientSol({
    networkId: 'sol--101',
    backgroundApi: {
      serviceAccountProfile: { sendProxyRequest },
    },
  });
  return { client, sendProxyRequest };
}

describe('ClientSol DAS methods', () => {
  it('getAsset sends the DAS getAsset rpc through the proxy', async () => {
    const { client, sendProxyRequest } = buildClient();
    const asset = { id: ASSET_ID, compression: { compressed: true } };
    sendProxyRequest.mockResolvedValue([asset]);

    await expect(client.getAsset(ASSET_ID)).resolves.toBe(asset);
    expect(sendProxyRequest).toHaveBeenCalledWith({
      networkId: 'sol--101',
      body: [
        {
          route: 'rpc',
          params: { method: 'getAsset', params: { id: ASSET_ID } },
        },
      ],
    });
  });

  it('getAssetProof sends the DAS getAssetProof rpc through the proxy', async () => {
    const { client, sendProxyRequest } = buildClient();
    const proof = {
      root: 'r',
      proof: ['a'],
      node_index: 1,
      leaf: 'l',
      tree_id: 't',
    };
    sendProxyRequest.mockResolvedValue([proof]);

    await expect(client.getAssetProof(ASSET_ID)).resolves.toBe(proof);
    expect(sendProxyRequest).toHaveBeenCalledWith({
      networkId: 'sol--101',
      body: [
        {
          route: 'rpc',
          params: { method: 'getAssetProof', params: { id: ASSET_ID } },
        },
      ],
    });
  });

  it('propagates proxy errors (e.g. Method not found on backends without DAS)', async () => {
    const { client, sendProxyRequest } = buildClient();
    sendProxyRequest.mockRejectedValue(new Error('Method not found'));
    await expect(client.getAsset(ASSET_ID)).rejects.toThrow('Method not found');
  });
});

describe('ClientSol.getMinimumBalanceForRentExemption', () => {
  // The cache is shared per network, so each test uses its own network id.
  function buildRentClient(networkId: string) {
    const sendProxyRequest = jest.fn();
    const client = new ClientSol({
      networkId,
      backgroundApi: {
        serviceAccountProfile: { sendProxyRequest },
      },
    });
    return { client, sendProxyRequest };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses a recent result for the same network and data length', async () => {
    const { client, sendProxyRequest } = buildRentClient('sol--rent-reuse');
    sendProxyRequest.mockResolvedValue([1_488_440]);

    await expect(client.getMinimumBalanceForRentExemption(165)).resolves.toBe(
      1_488_440,
    );
    await expect(client.getMinimumBalanceForRentExemption(165)).resolves.toBe(
      1_488_440,
    );
    expect(sendProxyRequest).toHaveBeenCalledTimes(1);
  });

  it('queries each data length separately', async () => {
    const { client, sendProxyRequest } = buildRentClient('sol--rent-sizes');
    sendProxyRequest
      .mockResolvedValueOnce([650_240])
      .mockResolvedValueOnce([1_488_440]);

    await expect(client.getMinimumBalanceForRentExemption(0)).resolves.toBe(
      650_240,
    );
    await expect(client.getMinimumBalanceForRentExemption(165)).resolves.toBe(
      1_488_440,
    );
    expect(sendProxyRequest).toHaveBeenCalledTimes(2);
  });

  it('queries again once the cached value is ten minutes old', async () => {
    const { client, sendProxyRequest } = buildRentClient('sol--rent-expiry');
    sendProxyRequest
      .mockResolvedValueOnce([1_488_440])
      .mockResolvedValueOnce([754_475]);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    await client.getMinimumBalanceForRentExemption(165);
    now.mockReturnValue(1_000_000 + 10 * 60 * 1000 - 1);
    await expect(client.getMinimumBalanceForRentExemption(165)).resolves.toBe(
      1_488_440,
    );
    now.mockReturnValue(1_000_000 + 10 * 60 * 1000);
    await expect(client.getMinimumBalanceForRentExemption(165)).resolves.toBe(
      754_475,
    );
    expect(sendProxyRequest).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed or malformed lookup', async () => {
    const { client, sendProxyRequest } = buildRentClient('sol--rent-failure');
    sendProxyRequest
      .mockRejectedValueOnce(new Error('rpc down'))
      .mockResolvedValueOnce([undefined])
      .mockResolvedValueOnce([1_488_440]);

    await expect(client.getMinimumBalanceForRentExemption(165)).rejects.toThrow(
      'rpc down',
    );
    await client.getMinimumBalanceForRentExemption(165);
    await expect(client.getMinimumBalanceForRentExemption(165)).resolves.toBe(
      1_488_440,
    );
    expect(sendProxyRequest).toHaveBeenCalledTimes(3);
  });
});
