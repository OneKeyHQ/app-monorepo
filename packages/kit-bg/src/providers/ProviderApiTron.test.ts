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
  const provider = new ProviderApiTron({ backgroundApi: { serviceDApp } });
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

  it('returns undefined chainId when no network is connected or chainId cannot be parsed', async () => {
    const emptySetup = setup({ networks: [] });
    await expect(
      emptySetup.provider.tron_chainId(emptySetup.request('tron_chainId')),
    ).resolves.toBeUndefined();
    await expect(
      emptySetup.provider.eth_chainId(emptySetup.request('eth_chainId')),
    ).resolves.toBeUndefined();

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
    ).resolves.toBeUndefined();
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
});
