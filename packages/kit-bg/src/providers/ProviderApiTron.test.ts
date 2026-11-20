import { consts } from '@onekeyfe/cross-inpage-provider-core';
import { IJsBridgeMessageTypes } from '@onekeyfe/cross-inpage-provider-types';
import { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';
import { TronWeb } from 'tronweb';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import ProviderApiTron from './ProviderApiTron';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('./ProviderApiBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

function setup({
  networks = [],
  accountsInfo = [],
}: {
  networks?: Array<Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>>;
  accountsInfo?: Array<{ account?: { address: string } }>;
} = {}) {
  const serviceDApp = {
    getConnectedNetworks: jest.fn().mockResolvedValue(networks),
    dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue(accountsInfo),
  };
  const provider = new ProviderApiTron({
    backgroundApi: { serviceDApp },
  });
  const request = (method: string): IJsBridgeMessagePayload =>
    ({
      origin: 'https://dapp.example',
      scope: 'tron',
      data: { method },
    }) as IJsBridgeMessagePayload;

  return { provider, serviceDApp, request };
}

describe('ProviderApiTron network and chainId resolution', () => {
  it('returns Nile node URL for preset Tron Nile Testnet with prefixed chainId', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0xcd8690dc',
          chainId: 'tron--0xcd8690dc',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://nile.trongrid.io',
      fullNode: 'https://nile.trongrid.io',
      solidityNode: 'https://nile.trongrid.io',
      eventServer: 'https://nile.trongrid.io',
    });
  });

  it('returns Nile node URL for Nile network with plain hex chainId', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0xcd8690dc',
          chainId: '0xcd8690dc',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://nile.trongrid.io',
      fullNode: 'https://nile.trongrid.io',
      solidityNode: 'https://nile.trongrid.io',
      eventServer: 'https://nile.trongrid.io',
    });
  });

  it('returns Shasta node URL for Shasta network', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0x94a9059e',
          chainId: '0x94a9059e',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://api.shasta.trongrid.io',
      fullNode: 'https://api.shasta.trongrid.io',
      solidityNode: 'https://api.shasta.trongrid.io',
      eventServer: 'https://api.shasta.trongrid.io',
    });
  });

  it('falls back to Shasta node URL for unknown testnet without hex chainId', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--custom-testnet',
          chainId: 'custom-testnet',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://api.shasta.trongrid.io',
      fullNode: 'https://api.shasta.trongrid.io',
      solidityNode: 'https://api.shasta.trongrid.io',
      eventServer: 'https://api.shasta.trongrid.io',
    });
  });

  it('returns Mainnet node URL for Mainnet and when no network is connected', async () => {
    const mainnetSetup = setup({
      networks: [
        {
          id: 'tron--0x2b6653dc',
          chainId: '0x2b6653dc',
          isTestnet: false,
        },
      ],
    });
    await expect(
      mainnetSetup.provider.tron_nodes(mainnetSetup.request('tron_nodes')),
    ).resolves.toEqual({
      fullHost: 'https://api.trongrid.io',
      fullNode: 'https://api.trongrid.io',
      solidityNode: 'https://api.trongrid.io',
      eventServer: 'https://api.trongrid.io',
    });

    const emptySetup = setup({ networks: [] });
    await expect(
      emptySetup.provider.tron_nodes(emptySetup.request('tron_nodes')),
    ).resolves.toEqual({
      fullHost: 'https://api.trongrid.io',
      fullNode: 'https://api.trongrid.io',
      solidityNode: 'https://api.trongrid.io',
      eventServer: 'https://api.trongrid.io',
    });
  });

  it.each([
    {
      name: 'Nile with prefixed chainId',
      network: {
        id: 'tron--0xcd8690dc',
        chainId: 'tron--0xcd8690dc',
        isTestnet: true,
      },
      expected: '0xcd8690dc',
    },
    {
      name: 'Nile falling back from chainId 0 to network id',
      network: {
        id: 'tron--0xcd8690dc',
        chainId: '0',
        isTestnet: true,
      },
      expected: '0xcd8690dc',
    },
    {
      name: 'Mainnet',
      network: {
        id: 'tron--0x2b6653dc',
        chainId: '0x2b6653dc',
        isTestnet: false,
      },
      expected: '0x2b6653dc',
    },
    {
      name: 'Shasta',
      network: {
        id: 'tron--0x94a9059e',
        chainId: '0x94a9059e',
        isTestnet: true,
      },
      expected: '0x94a9059e',
    },
  ])(
    'resolves tron_chainId and eth_chainId for $name',
    async ({ network, expected }) => {
      const { provider, request } = setup({ networks: [network] });

      await expect(
        provider.tron_chainId(request('tron_chainId')),
      ).resolves.toBe(expected);
      await expect(provider.eth_chainId(request('eth_chainId'))).resolves.toBe(
        expected,
      );
    },
  );

  it('returns 0x00 chainId when no network is connected or chainId cannot be parsed', async () => {
    const emptySetup = setup({ networks: [] });
    await expect(
      emptySetup.provider.tron_chainId(emptySetup.request('tron_chainId')),
    ).resolves.toBe('0x00');
    await expect(
      emptySetup.provider.eth_chainId(emptySetup.request('eth_chainId')),
    ).resolves.toBe('0x00');

    const invalidSetup = setup({
      networks: [
        {
          id: 'tron--custom-testnet',
          chainId: 'custom-testnet',
          isTestnet: true,
        },
      ],
    });
    await expect(
      invalidSetup.provider.tron_chainId(invalidSetup.request('tron_chainId')),
    ).resolves.toBe('0x00');
  });

  it('never leaks wallet custom RPC URLs to pages and rejects custom numeric chainId without public TronGrid URL', async () => {
    const getCustomRpcForNetwork = jest.fn().mockResolvedValue({
      enabled: true,
      rpc: 'https://private-rpc.example/v3/secret-api-key',
    });
    const resolveDefaultRpcUrl = jest
      .fn()
      .mockResolvedValue('https://default-custom-tron.example/secret');
    const customNileProvider = new ProviderApiTron({
      backgroundApi: {
        serviceDApp: {
          getConnectedNetworks: jest.fn().mockResolvedValue([
            {
              id: 'tron--0xcd8690dc',
              chainId: '0xcd8690dc',
              isTestnet: true,
            },
          ]),
          dAppGetConnectedAccountsInfo: jest
            .fn()
            .mockResolvedValue([
              { account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' } },
            ]),
        },
        serviceCustomRpc: {
          getCustomRpcForNetwork,
          resolveDefaultRpcUrl,
        },
      },
    });
    const nileReq = {
      origin: 'https://dapp.example',
      scope: 'tron',
      data: { method: 'tron_getProviderState' },
    } as IJsBridgeMessagePayload;
    await expect(
      customNileProvider.tron_getProviderState(nileReq),
    ).resolves.toEqual({
      accounts: ['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3'],
      nodes: {
        fullHost: 'https://nile.trongrid.io',
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
      },
    });
    expect(getCustomRpcForNetwork).not.toHaveBeenCalled();
    expect(resolveDefaultRpcUrl).not.toHaveBeenCalled();

    const missingRpcCustom = setup({
      networks: [
        {
          id: 'tron--0x1',
          chainId: '0x1',
          isTestnet: true,
        },
      ],
    });
    await expect(
      missingRpcCustom.provider.tron_chainId(
        missingRpcCustom.request('tron_chainId'),
      ),
    ).resolves.toBe('0x01');
    await expect(
      missingRpcCustom.provider.tron_nodes(
        missingRpcCustom.request('tron_nodes'),
      ),
    ).rejects.toThrow('RPC URL is not configured for custom Tron network');
  });

  it('returns Nile nodes with connected accounts in tron_getProviderState', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0xcd8690dc',
          chainId: 'tron--0xcd8690dc',
          isTestnet: true,
        },
      ],
      accountsInfo: [
        { account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' } },
      ],
    });

    await expect(
      provider.tron_getProviderState(request('tron_getProviderState')),
    ).resolves.toEqual({
      accounts: ['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3'],
      nodes: {
        fullHost: 'https://nile.trongrid.io',
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
      },
    });
  });
});

describe('ProviderApiTron first-time connection node sync', () => {
  it('syncs injected Nile nodes before resolving tron_requestAccounts on extension bridge', async () => {
    const originalChrome = (globalThis as { chrome?: unknown }).chrome;
    const connectListeners: Array<(port: chrome.runtime.Port) => void> = [];
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        onConnect: {
          addListener: jest.fn(
            (listener: (port: chrome.runtime.Port) => void) => {
              connectListeners.push(listener);
            },
          ),
        },
      },
    };

    try {
      const origin = 'https://dapp.example';
      const otherOrigin = 'https://other.example';
      const address = 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3';
      const connectedNetworks = new Map<
        string,
        Array<Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>>
      >();
      const connectedAccounts = new Map<
        string,
        Array<{ account?: { address: string } }>
      >();

      const serviceDApp = {
        getConnectedNetworks: jest.fn(async (req: IJsBridgeMessagePayload) =>
          Promise.resolve(connectedNetworks.get(req.origin ?? '') ?? []),
        ),
        dAppGetConnectedAccountsInfo: jest.fn(
          async (req: IJsBridgeMessagePayload) =>
            Promise.resolve(connectedAccounts.get(req.origin ?? '') ?? []),
        ),
        openConnectionModal: jest.fn(async (req: IJsBridgeMessagePayload) => {
          const target = req.origin ?? '';
          connectedNetworks.set(target, [
            {
              id: 'tron--0xcd8690dc',
              chainId: 'tron--0xcd8690dc',
              isTestnet: true,
            },
          ]);
          connectedAccounts.set(target, [{ account: { address } }]);
        }),
      };

      const backgroundApi: {
        serviceDApp: typeof serviceDApp;
        bridgeExtBg: JsBridgeExtBackground | null;
      } = {
        serviceDApp,
        bridgeExtBg: null,
      };
      const provider = new ProviderApiTron({ backgroundApi });
      const bridgeExtBg = new JsBridgeExtBackground({
        receiveHandler: async (payload: IJsBridgeMessagePayload) => {
          const rpc = payload.data as { method?: string } | undefined;
          switch (rpc?.method) {
            case 'tron_getProviderState':
              return provider.tron_getProviderState(payload);
            case 'tron_requestAccounts':
              return provider.tron_requestAccounts(payload);
            case 'eth_chainId':
              return provider.eth_chainId(payload);
            default:
              throw new OneKeyLocalError(
                `Unexpected method: ${String(rpc?.method)}`,
              );
          }
        },
      });
      backgroundApi.bridgeExtBg = bridgeExtBg;

      const initialState = await provider.tron_getProviderState({
        origin,
        scope: 'tron',
        data: { method: 'tron_getProviderState' },
      } as IJsBridgeMessagePayload);
      const tronWeb = new TronWeb(initialState.nodes);
      expect(tronWeb.fullNode.host).toBe('https://api.trongrid.io');

      const events: string[] = [];
      let hostAtResponse: string | undefined;
      let resolveResponse!: (value: unknown) => void;
      let rejectResponse!: (reason?: unknown) => void;
      const responsePromise = new Promise((resolve, reject) => {
        resolveResponse = resolve;
        rejectResponse = reject;
      });

      const registerPort = (
        url: string,
        postMessage: (msg: IJsBridgeMessagePayload) => void,
      ): string => {
        const port = {
          name: consts.EXT_PORT_CS_TO_BG,
          sender: { url },
          postMessage,
          onMessage: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
          },
          onDisconnect: {
            addListener: jest.fn(),
            removeListener: jest.fn(),
          },
        } as unknown as chrome.runtime.Port;

        connectListeners.forEach((listener) => listener(port));
        const entry = Object.entries(bridgeExtBg.ports).find(
          ([, candidate]) => candidate === port,
        );
        if (!entry) {
          throw new OneKeyLocalError(`Port not registered for ${url}`);
        }
        return entry[0];
      };

      const dappPortId = registerPort(`${origin}/app`, (msg) => {
        const data = msg.data as
          | {
              method?: string;
              params?: {
                nodes?: {
                  fullHost: string;
                  fullNode?: string;
                  solidityNode?: string;
                  eventServer?: string;
                };
              };
            }
          | undefined;
        if (
          msg.type === IJsBridgeMessageTypes.REQUEST &&
          data?.method === 'wallet_events_nodesChanged'
        ) {
          const nextNodes = data.params?.nodes;
          if (nextNodes) {
            tronWeb.setFullNode(nextNodes.fullNode ?? nextNodes.fullHost);
            tronWeb.setSolidityNode(
              nextNodes.solidityNode ?? nextNodes.fullHost,
            );
            tronWeb.setEventServer(nextNodes.eventServer ?? nextNodes.fullHost);
          }
          events.push('nodesChanged');
          return;
        }
        if (msg.type === IJsBridgeMessageTypes.RESPONSE && msg.id === 1) {
          events.push('requestAccountsResponse');
          hostAtResponse = tronWeb.fullNode.host;
          if (msg.error) {
            rejectResponse(new OneKeyLocalError(JSON.stringify(msg.error)));
          } else {
            resolveResponse(msg.data);
          }
        }
      });

      const otherPortPostMessage = jest.fn();
      registerPort(`${otherOrigin}/app`, otherPortPostMessage);

      bridgeExtBg.receive(
        {
          id: 1,
          type: IJsBridgeMessageTypes.REQUEST,
          scope: 'tron',
          remoteId: dappPortId,
          data: { method: 'tron_requestAccounts' },
        },
        { origin, internal: false },
      );

      await expect(responsePromise).resolves.toEqual([address]);
      expect(events).toEqual(['nodesChanged', 'requestAccountsResponse']);
      expect(hostAtResponse).toBe('https://nile.trongrid.io');
      expect(tronWeb.fullNode.host).toBe('https://nile.trongrid.io');
      expect(tronWeb.solidityNode.host).toBe('https://nile.trongrid.io');
      expect(tronWeb.eventServer?.host).toBe('https://nile.trongrid.io');
      await expect(
        provider.eth_chainId({
          origin,
          scope: 'tron',
          data: { method: 'eth_chainId' },
        } as IJsBridgeMessagePayload),
      ).resolves.toBe('0xcd8690dc');
      expect(otherPortPostMessage).not.toHaveBeenCalled();
    } finally {
      if (originalChrome === undefined) {
        delete (globalThis as { chrome?: unknown }).chrome;
      } else {
        (globalThis as { chrome?: unknown }).chrome = originalChrome;
      }
    }
  });

  it('awaits sendForProvider node sync in non-extension runtimes before resolving', async () => {
    const order: string[] = [];
    const connectedNetworks: Array<
      Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>
    > = [];
    const connectedAccounts: Array<{ account?: { address: string } }> = [];

    const serviceDApp = {
      getConnectedNetworks: jest.fn(async () => connectedNetworks),
      dAppGetConnectedAccountsInfo: jest.fn(async () => connectedAccounts),
      openConnectionModal: jest.fn(async () => {
        connectedNetworks.push({
          id: 'tron--0xcd8690dc',
          chainId: 'tron--0xcd8690dc',
          isTestnet: true,
        });
        connectedAccounts.push({
          account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' },
        });
      }),
    };

    const send = jest.fn(async () => {
      order.push('sendStart');
      await Promise.resolve();
      order.push('sendDone');
    });
    const sendForProvider = jest.fn(() => send);

    const provider = new ProviderApiTron({
      backgroundApi: {
        serviceDApp,
        bridgeExtBg: null,
        sendForProvider,
      },
    });

    const accounts = await provider.tron_requestAccounts({
      origin: 'https://dapp.example',
      scope: 'tron',
      data: { method: 'tron_requestAccounts' },
    } as IJsBridgeMessagePayload);
    order.push('resolved');

    expect(accounts).toEqual(['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3']);
    expect(order).toEqual(['sendStart', 'sendDone', 'resolved']);
    expect(sendForProvider).toHaveBeenCalledWith('tron');
    expect(send).toHaveBeenCalledWith(
      {
        method: 'wallet_events_nodesChanged',
        params: {
          nodes: {
            fullHost: 'https://nile.trongrid.io',
            fullNode: 'https://nile.trongrid.io',
            solidityNode: 'https://nile.trongrid.io',
            eventServer: 'https://nile.trongrid.io',
          },
          chainId: '0xcd8690dc',
        },
      },
      'https://dapp.example',
    );
  });

  it('skips node sync when already connected, cancelled, or WalletConnect', async () => {
    const requestToAllCS = jest.fn();

    const alreadyConnectedService = {
      getConnectedNetworks: jest.fn(),
      dAppGetConnectedAccountsInfo: jest.fn(async () => [
        { account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' } },
      ]),
      openConnectionModal: jest.fn(),
    };
    const alreadyConnected = new ProviderApiTron({
      backgroundApi: {
        serviceDApp: alreadyConnectedService,
        bridgeExtBg: { requestToAllCS },
      },
    });
    await expect(
      alreadyConnected.tron_requestAccounts({
        origin: 'https://dapp.example',
        scope: 'tron',
        data: { method: 'tron_requestAccounts' },
      } as IJsBridgeMessagePayload),
    ).resolves.toEqual(['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3']);
    expect(alreadyConnectedService.openConnectionModal).not.toHaveBeenCalled();
    expect(requestToAllCS).not.toHaveBeenCalled();

    const cancelledService = {
      getConnectedNetworks: jest.fn(async () => []),
      dAppGetConnectedAccountsInfo: jest.fn(async () => []),
      openConnectionModal: jest.fn(async () => undefined),
    };
    const cancelled = new ProviderApiTron({
      backgroundApi: {
        serviceDApp: cancelledService,
        bridgeExtBg: { requestToAllCS },
      },
    });
    await expect(
      cancelled.tron_requestAccounts({
        origin: 'https://dapp.example',
        scope: 'tron',
        data: { method: 'tron_requestAccounts' },
      } as IJsBridgeMessagePayload),
    ).resolves.toEqual([]);
    expect(requestToAllCS).not.toHaveBeenCalled();

    const wcAccounts: Array<{ account?: { address: string } }> = [];
    const wcService = {
      getConnectedNetworks: jest.fn(),
      dAppGetConnectedAccountsInfo: jest.fn(async () => wcAccounts),
      openConnectionModal: jest.fn(async () => {
        wcAccounts.push({
          account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' },
        });
      }),
    };
    const wc = new ProviderApiTron({
      backgroundApi: {
        serviceDApp: wcService,
        bridgeExtBg: { requestToAllCS },
      },
    });
    await expect(
      wc.tron_requestAccounts({
        origin: 'https://dapp.example',
        scope: 'tron',
        isWalletConnectRequest: true,
        data: { method: 'tron_requestAccounts' },
      } as IJsBridgeMessagePayload),
    ).resolves.toEqual(['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3']);
    expect(requestToAllCS).not.toHaveBeenCalled();
  });

  it('reads connected network once in notifyDappChainChanged and syncConnectedNodes', async () => {
    const nile = {
      id: 'tron--0xcd8690dc',
      chainId: '0xcd8690dc',
      isTestnet: true,
    };
    const mainnet = {
      id: 'tron--0x2b6653dc',
      chainId: '0x2b6653dc',
      isTestnet: false,
    };
    const getConnectedNetworks = jest
      .fn()
      .mockResolvedValueOnce([nile])
      .mockResolvedValueOnce([mainnet]);

    const provider = new ProviderApiTron({
      backgroundApi: {
        serviceDApp: { getConnectedNetworks },
      },
    });

    const sent: unknown[] = [];
    let sendPromise!: Promise<void>;
    provider.notifyDappChainChanged({
      targetOrigin: 'https://dapp.example',
      send: (data: (params: { origin: string }) => Promise<unknown>) => {
        sendPromise = data({ origin: 'https://dapp.example' }).then((res) => {
          sent.push(res);
        });
      },
    });
    await sendPromise;

    expect(getConnectedNetworks).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      {
        method: 'wallet_events_nodesChanged',
        params: {
          nodes: {
            fullHost: 'https://nile.trongrid.io',
            fullNode: 'https://nile.trongrid.io',
            solidityNode: 'https://nile.trongrid.io',
            eventServer: 'https://nile.trongrid.io',
          },
          chainId: '0xcd8690dc',
        },
      },
    ]);
  });

  it('skips node-change push on first connect to default Mainnet', async () => {
    const requestToAllCS = jest.fn();
    const mainnetConnected = {
      id: 'tron--0x2b6653dc',
      chainId: '0x2b6653dc',
      isTestnet: false,
    };
    const accounts: Array<{ account?: { address: string } }> = [];
    const networks: Array<
      Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>
    > = [];
    const serviceDApp = {
      getConnectedNetworks: jest.fn(async () => networks),
      dAppGetConnectedAccountsInfo: jest.fn(async () => accounts),
      openConnectionModal: jest.fn(async () => {
        networks.push(mainnetConnected);
        accounts.push({
          account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' },
        });
      }),
    };
    const provider = new ProviderApiTron({
      backgroundApi: {
        serviceDApp,
        bridgeExtBg: { requestToAllCS },
      },
    });

    await expect(
      provider.tron_requestAccounts({
        origin: 'https://dapp.example',
        scope: 'tron',
        data: { method: 'tron_requestAccounts' },
      } as IJsBridgeMessagePayload),
    ).resolves.toEqual(['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3']);
    expect(requestToAllCS).not.toHaveBeenCalled();
  });

  it('keeps tron_requestAccounts succeeding if initial sync fails and retries on next call', async () => {
    const requestToAllCS = jest.fn();
    const accounts: Array<{ account?: { address: string } }> = [];
    const nile = {
      id: 'tron--0xcd8690dc',
      chainId: '0xcd8690dc',
      isTestnet: true,
    };
    const serviceDApp = {
      getConnectedNetworks: jest
        .fn()
        .mockRejectedValueOnce(new Error('transient db error'))
        .mockResolvedValue([nile]),
      dAppGetConnectedAccountsInfo: jest.fn(async () => accounts),
      openConnectionModal: jest.fn(async () => {
        accounts.push({
          account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' },
        });
      }),
    };
    const provider = new ProviderApiTron({
      backgroundApi: {
        serviceDApp,
        bridgeExtBg: { requestToAllCS },
      },
    });

    const req = {
      origin: 'https://dapp.example',
      scope: 'tron',
      data: { method: 'tron_requestAccounts' },
    } as IJsBridgeMessagePayload;

    // First connect approval succeeds even when sync fails.
    await expect(provider.tron_requestAccounts(req)).resolves.toEqual([
      'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3',
    ]);
    expect(requestToAllCS).not.toHaveBeenCalled();

    // Subsequent connect retries the missed node sync even though accounts are already connected.
    await expect(provider.tron_requestAccounts(req)).resolves.toEqual([
      'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3',
    ]);
    expect(requestToAllCS).toHaveBeenCalledTimes(1);
    expect(requestToAllCS).toHaveBeenCalledWith(
      'tron',
      expect.objectContaining({
        method: 'wallet_events_nodesChanged',
        params: expect.objectContaining({ chainId: '0xcd8690dc' }),
      }),
      'https://dapp.example',
    );
  });

  it('pushes Mainnet node reset when a page connects to Nile, disconnects, and reconnects to Mainnet', async () => {
    const origin = 'https://dapp.example';
    const address = 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3';
    const nile = {
      id: 'tron--0xcd8690dc',
      chainId: '0xcd8690dc',
      isTestnet: true,
    };
    const mainnet = {
      id: 'tron--0x2b6653dc',
      chainId: '0x2b6653dc',
      isTestnet: false,
    };

    let activeNetworks: Array<
      Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>
    > = [];
    let activeAccounts: Array<{ account?: { address: string } }> = [];
    let nextConnectNetwork = nile;

    const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
    const requestToAllCS = jest.fn(
      async (
        _scope: string,
        payload: {
          method?: string;
          params?: { nodes?: { fullHost: string } };
        },
      ) => {
        if (
          payload.method === 'wallet_events_nodesChanged' &&
          payload.params?.nodes
        ) {
          tronWeb.setFullNode(payload.params.nodes.fullHost);
          tronWeb.setSolidityNode(payload.params.nodes.fullHost);
          tronWeb.setEventServer(payload.params.nodes.fullHost);
        }
      },
    );

    const provider = new ProviderApiTron({
      backgroundApi: {
        serviceDApp: {
          getConnectedNetworks: jest.fn(async () => activeNetworks),
          dAppGetConnectedAccountsInfo: jest.fn(async () => activeAccounts),
          openConnectionModal: jest.fn(async () => {
            activeNetworks = [nextConnectNetwork];
            activeAccounts = [{ account: { address } }];
          }),
        },
        bridgeExtBg: { requestToAllCS },
      },
    });

    const req = (method: string) =>
      ({
        origin,
        scope: 'tron',
        data: { method },
      }) as IJsBridgeMessagePayload;

    // 1. Connect on Nile: TronWeb moves to Nile.
    await expect(
      provider.tron_requestAccounts(req('tron_requestAccounts')),
    ).resolves.toEqual([address]);
    expect(tronWeb.fullNode.host).toBe('https://nile.trongrid.io');
    await expect(provider.eth_chainId(req('eth_chainId'))).resolves.toBe(
      '0xcd8690dc',
    );

    // 2. Simulate site disconnect (ServiceDApp clears session without changing page TronWeb).
    activeNetworks = [];
    activeAccounts = [];
    expect(tronWeb.fullNode.host).toBe('https://nile.trongrid.io');

    // 3. Reconnect on Mainnet: node reset event MUST fire so page TronWeb does not stay on Nile.
    nextConnectNetwork = mainnet;
    requestToAllCS.mockClear();
    await expect(
      provider.tron_requestAccounts(req('tron_requestAccounts')),
    ).resolves.toEqual([address]);

    expect(requestToAllCS).toHaveBeenCalledTimes(1);
    expect(requestToAllCS).toHaveBeenCalledWith(
      'tron',
      {
        method: 'wallet_events_nodesChanged',
        params: {
          nodes: {
            fullHost: 'https://api.trongrid.io',
            fullNode: 'https://api.trongrid.io',
            solidityNode: 'https://api.trongrid.io',
            eventServer: 'https://api.trongrid.io',
          },
          chainId: '0x2b6653dc',
        },
      },
      origin,
    );
    expect(tronWeb.fullNode.host).toBe('https://api.trongrid.io');
    await expect(provider.eth_chainId(req('eth_chainId'))).resolves.toBe(
      '0x2b6653dc',
    );
  });

  it('waits for in-flight node sync across concurrent same-origin tabs before resolving tron_requestAccounts', async () => {
    const originalChrome = (globalThis as { chrome?: unknown }).chrome;
    const connectListeners: Array<(port: chrome.runtime.Port) => void> = [];
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        onConnect: {
          addListener: jest.fn(
            (listener: (port: chrome.runtime.Port) => void) => {
              connectListeners.push(listener);
            },
          ),
        },
      },
    };

    try {
      const origin = 'https://dapp.example';
      const address = 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3';
      let activeNetworks: Array<
        Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>
      > = [];
      let activeAccounts: Array<{ account?: { address: string } }> = [];
      let resolveDelayedNodes!: () => void;
      const delayedNodesPromise = new Promise<void>((resolve) => {
        resolveDelayedNodes = resolve;
      });
      let networkReadCount = 0;

      const backgroundApi: {
        serviceDApp: {
          getConnectedNetworks: jest.Mock;
          dAppGetConnectedAccountsInfo: jest.Mock;
          openConnectionModal: jest.Mock;
        };
        bridgeExtBg: JsBridgeExtBackground | null;
      } = {
        serviceDApp: {
          getConnectedNetworks: jest.fn(async () => {
            networkReadCount += 1;
            if (networkReadCount === 1) {
              await delayedNodesPromise;
            }
            return activeNetworks;
          }),
          dAppGetConnectedAccountsInfo: jest.fn(async () => activeAccounts),
          openConnectionModal: jest.fn(async () => {
            activeNetworks = [
              {
                id: 'tron--0xcd8690dc',
                chainId: '0xcd8690dc',
                isTestnet: true,
              },
            ];
            activeAccounts = [{ account: { address } }];
          }),
        },
        bridgeExtBg: null,
      };

      const provider = new ProviderApiTron({ backgroundApi });
      const bridgeExtBg = new JsBridgeExtBackground({
        receiveHandler: async (payload: IJsBridgeMessagePayload) => {
          const rpc = payload.data as { method?: string } | undefined;
          if (rpc?.method === 'tron_requestAccounts') {
            return provider.tron_requestAccounts(payload);
          }
          throw new OneKeyLocalError(
            `Unexpected method: ${String(rpc?.method)}`,
          );
        },
      });
      backgroundApi.bridgeExtBg = bridgeExtBg;

      const createTabPort = (path: string, requestId: number) => {
        const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
        const events: string[] = [];
        let hostAtResponse: string | undefined;
        let settled = false;
        let resolveResp!: (value: unknown) => void;
        let rejectResp!: (reason?: unknown) => void;
        const responsePromise = new Promise((resolve, reject) => {
          resolveResp = (value) => {
            settled = true;
            resolve(value);
          };
          rejectResp = (reason) => {
            settled = true;
            reject(reason);
          };
        });

        const port = {
          name: consts.EXT_PORT_CS_TO_BG,
          sender: { url: `${origin}/${path}` },
          postMessage: (msg: IJsBridgeMessagePayload) => {
            const data = msg.data as
              | {
                  method?: string;
                  params?: { nodes?: { fullHost: string } };
                }
              | undefined;
            if (
              msg.type === IJsBridgeMessageTypes.REQUEST &&
              data?.method === 'wallet_events_nodesChanged' &&
              data.params?.nodes
            ) {
              tronWeb.setFullNode(data.params.nodes.fullHost);
              tronWeb.setSolidityNode(data.params.nodes.fullHost);
              tronWeb.setEventServer(data.params.nodes.fullHost);
              events.push('nodesChanged');
              return;
            }
            if (
              msg.type === IJsBridgeMessageTypes.RESPONSE &&
              msg.id === requestId
            ) {
              hostAtResponse = tronWeb.fullNode.host;
              events.push('response');
              if (msg.error) {
                rejectResp(new OneKeyLocalError(JSON.stringify(msg.error)));
              } else {
                resolveResp(msg.data);
              }
            }
          },
          onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
          onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
        } as unknown as chrome.runtime.Port;

        connectListeners.forEach((listener) => listener(port));
        const entry = Object.entries(bridgeExtBg.ports).find(
          ([, candidate]) => candidate === port,
        );
        if (!entry) {
          throw new OneKeyLocalError(`Port not registered for ${path}`);
        }
        return {
          portId: entry[0],
          tronWeb,
          events,
          responsePromise,
          getHostAtResponse: () => hostAtResponse,
          isSettled: () => settled,
        };
      };

      const tabA = createTabPort('tab-a', 1);
      const tabB = createTabPort('tab-b', 2);

      // Tab A initiates connection on Nile; getConnectedNetworks stays pending.
      bridgeExtBg.receive(
        {
          id: 1,
          type: IJsBridgeMessageTypes.REQUEST,
          scope: 'tron',
          remoteId: tabA.portId,
          data: { method: 'tron_requestAccounts' },
        },
        { origin, internal: false },
      );
      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
      }

      // Session is saved, but Tab A's node sync is still delayed; Tab B requests accounts now.
      expect(activeAccounts).toHaveLength(1);
      bridgeExtBg.receive(
        {
          id: 2,
          type: IJsBridgeMessageTypes.REQUEST,
          scope: 'tron',
          remoteId: tabB.portId,
          data: { method: 'tron_requestAccounts' },
        },
        { origin, internal: false },
      );
      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
      }

      // Neither tab may resolve while node sync is still in flight.
      expect(tabA.isSettled()).toBe(false);
      expect(tabB.isSettled()).toBe(false);

      resolveDelayedNodes();
      await expect(tabA.responsePromise).resolves.toEqual([address]);
      await expect(tabB.responsePromise).resolves.toEqual([address]);

      expect(tabA.events).toEqual(['nodesChanged', 'response']);
      expect(tabB.events).toEqual(['nodesChanged', 'response']);
      expect(tabA.getHostAtResponse()).toBe('https://nile.trongrid.io');
      expect(tabB.getHostAtResponse()).toBe('https://nile.trongrid.io');
      expect(tabA.tronWeb.fullNode.host).toBe('https://nile.trongrid.io');
      expect(tabB.tronWeb.fullNode.host).toBe('https://nile.trongrid.io');
    } finally {
      if (originalChrome === undefined) {
        delete (globalThis as { chrome?: unknown }).chrome;
      } else {
        (globalThis as { chrome?: unknown }).chrome = originalChrome;
      }
    }
  });
});
