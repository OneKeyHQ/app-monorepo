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
