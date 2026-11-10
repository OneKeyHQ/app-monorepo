/* eslint-disable import/first */
// cspell:ignore lightd stagenet
jest.mock('../../dbs/local/localDbInstance');
jest.mock('@onekeyhq/shared/src/utils/streamingFetch', () => ({
  streamingFetch: jest.fn(),
}));
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    ...jest.requireActual<
      typeof import('@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect')
    >('@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect'),
    fetchZcashLightdInfoDirect: jest.fn(),
    fetchZcashChainTipDirect: jest.fn(),
  }),
);

import {
  XMR_MAINNET_GENESIS_HASH,
  XMR_STAGENET_GENESIS_HASH,
  XMR_TESTNET_GENESIS_HASH,
} from '@onekeyhq/core/src/chains/xmr/xmrNodeDirect';
import { ZCASH_LIGHTWALLETD_MAINNET } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import {
  fetchZcashChainTipDirect,
  fetchZcashLightdInfoDirect,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { XMR_BUILT_IN_NODE_URLS } from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { streamingFetch } from '@onekeyhq/shared/src/utils/streamingFetch';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';

import ServiceCustomRpc from '../../services/ServiceCustomRpc';
import XmrVault from '../impls/xmr/Vault';
import ZcashVault from '../impls/zcash/Vault';

import { localWalletText } from './messages';
import { setLocalWalletRemoteConfigs } from './remoteConfig';

// The platform fetch under the shared node request, so the request's own rules run too.
const nodeFetch = jest.mocked(streamingFetch);
const jsonReply = (body: unknown) => new Response(JSON.stringify(body));
const requestedUrls = () => nodeFetch.mock.calls.map(([url]) => String(url));
const lightdInfo = jest.mocked(fetchZcashLightdInfoDirect);
const directTip = jest.mocked(fetchZcashChainTipDirect);
const HEIGHT = 3_512_327;
// `/get_height` counts blocks; the app reports the top block's number.
const TOP_BLOCK = HEIGHT - 1;

beforeEach(() => setLocalWalletRemoteConfigs({}));

afterEach(() => {
  jest.restoreAllMocks();
  nodeFetch.mockReset();
  lightdInfo.mockReset();
  directTip.mockReset();
  setLocalWalletRemoteConfigs({});
});

// The real resolver over an in-memory custom RPC store; every write path is a
// spy so a test can prove resolving never writes, syncs, or emits.
function createNodeStore(rows: Record<string, IDBCustomRpc | undefined>) {
  const store = { ...rows };
  const writes = {
    addCustomRpc: jest.fn(),
    deleteCustomRpc: jest.fn(),
    updateCustomRpcEnabledStatus: jest.fn(),
    addAndUpdateFreshSyncItems: jest.fn(),
  };
  const service = Object.create(ServiceCustomRpc.prototype) as ServiceCustomRpc;
  Object.assign(service, {
    localWalletRemoteConfigLoaded: true,
    backgroundApi: {
      simpleDb: {
        customRpc: {
          getCustomRpcForNetwork: async (networkId: string) => store[networkId],
          addCustomRpc: writes.addCustomRpc,
          deleteCustomRpc: writes.deleteCustomRpc,
          updateCustomRpcEnabledStatus: writes.updateCustomRpcEnabledStatus,
        },
      },
      localDb: {
        addAndUpdateFreshSyncItems: writes.addAndUpdateFreshSyncItems,
      },
    },
  });
  return { service, store, writes };
}

function customRpcRow(
  networkId: string,
  rpc: string,
  enabled: boolean,
): IDBCustomRpc {
  return {
    rpc,
    networkId,
    enabled,
    updatedAt: undefined,
    isCustomNetwork: undefined,
  };
}

describe('privacy chain node resolution', () => {
  function vaultWith<T extends XmrVault | ZcashVault>(
    vault: T,
    networkId: string,
    service: ServiceCustomRpc,
  ): T {
    return Object.assign(vault, {
      networkId,
      backgroundApi: { serviceCustomRpc: service },
    });
  }

  const cases = [
    {
      name: 'XMR',
      networkId: 'xmr--0',
      builtIn: XMR_BUILT_IN_NODE_URLS[0],
      resolve: (service: ServiceCustomRpc) =>
        vaultWith(
          Object.create(XmrVault.prototype) as XmrVault,
          'xmr--0',
          service,
        ).resolveXmrNodeUrl(),
    },
    {
      name: 'Zcash',
      networkId: 'zec--0',
      builtIn: ZCASH_LIGHTWALLETD_MAINNET,
      resolve: (service: ServiceCustomRpc) =>
        vaultWith(
          Object.create(ZcashVault.prototype) as ZcashVault,
          'zec--0',
          service,
        ).zcashResolveLightwalletdUrl(),
    },
  ];

  describe.each(cases)('$name', ({ networkId, builtIn, resolve }) => {
    it('uses the built-in node without writing, syncing, or emitting', async () => {
      const emit = jest.spyOn(appEventBus, 'emit');
      const { service, writes } = createNodeStore({});
      await expect(resolve(service)).resolves.toBe(builtIn);
      Object.values(writes).forEach((write) =>
        expect(write).not.toHaveBeenCalled(),
      );
      expect(emit).not.toHaveBeenCalledWith(
        EAppEventBusNames.CustomRpcChanged,
        expect.anything(),
      );
    });

    it('uses an enabled custom node', async () => {
      const { service } = createNodeStore({
        [networkId]: customRpcRow(networkId, 'https://custom.example', true),
      });
      await expect(resolve(service)).resolves.toBe('https://custom.example');
    });

    it('uses the remote default when the custom node is disabled', async () => {
      setLocalWalletRemoteConfigs({
        [networkId]: { nodeUrls: ['https://remote.example'] },
      });
      const { service, writes } = createNodeStore({
        [networkId]: customRpcRow(networkId, 'https://custom.example', false),
      });
      await expect(resolve(service)).resolves.toBe('https://remote.example');
      Object.values(writes).forEach((write) =>
        expect(write).not.toHaveBeenCalled(),
      );
    });

    it('keeps an enabled custom node ahead of the remote default', async () => {
      setLocalWalletRemoteConfigs({
        [networkId]: { nodeUrls: ['https://remote.example'] },
      });
      const { service } = createNodeStore({
        [networkId]: customRpcRow(networkId, 'https://custom.example', true),
      });
      await expect(resolve(service)).resolves.toBe('https://custom.example');
    });

    it('reads a remote default update or removal on the next call', async () => {
      const { service } = createNodeStore({});
      setLocalWalletRemoteConfigs({
        [networkId]: { nodeUrls: ['https://first.example'] },
      });
      await expect(resolve(service)).resolves.toBe('https://first.example');
      setLocalWalletRemoteConfigs({
        [networkId]: { nodeUrls: ['https://second.example'] },
      });
      await expect(resolve(service)).resolves.toBe('https://second.example');
      setLocalWalletRemoteConfigs({});
      await expect(resolve(service)).resolves.toBe(builtIn);
    });

    // The default shown beside a custom node is the one used once it is off.
    it('names the default a custom node replaces by the same rule', async () => {
      const { service } = createNodeStore({
        [networkId]: customRpcRow(networkId, 'https://custom.example', true),
      });
      await expect(service.resolveDefaultRpcUrl({ networkId })).resolves.toBe(
        builtIn,
      );
      setLocalWalletRemoteConfigs({
        [networkId]: { nodeUrls: ['https://remote.example'] },
      });
      await expect(service.resolveDefaultRpcUrl({ networkId })).resolves.toBe(
        'https://remote.example',
      );
    });

    it('falls back to the built-in node when the custom node is off', async () => {
      const { service } = createNodeStore({
        [networkId]: customRpcRow(networkId, 'https://custom.example', false),
      });
      await expect(resolve(service)).resolves.toBe(builtIn);
    });

    it('keeps an already seeded built-in row working unchanged', async () => {
      const { service, writes } = createNodeStore({
        [networkId]: customRpcRow(networkId, builtIn, true),
      });
      await expect(resolve(service)).resolves.toBe(builtIn);
      expect(writes.addCustomRpc).not.toHaveBeenCalled();
    });

    it('reads a node switch or deletion on the next call', async () => {
      const { service, store } = createNodeStore({
        [networkId]: customRpcRow(networkId, 'https://first.example', true),
      });
      await expect(resolve(service)).resolves.toBe('https://first.example');
      store[networkId] = customRpcRow(
        networkId,
        'https://second.example',
        true,
      );
      await expect(resolve(service)).resolves.toBe('https://second.example');
      delete store[networkId];
      await expect(resolve(service)).resolves.toBe(builtIn);
    });
  });

  it('gives no node to a chain without a built-in one', async () => {
    const { service } = createNodeStore({});
    await expect(
      service.resolveRpcUrlWithBuiltIn({ networkId: 'evm--1' }),
    ).resolves.toBeUndefined();
  });

  it('reports no node only when nothing resolves', async () => {
    const vault = vaultWith(
      Object.create(XmrVault.prototype) as XmrVault,
      'xmr--0',
      {
        resolveRpcUrlWithBuiltIn: async () => undefined,
      } as unknown as ServiceCustomRpc,
    );
    await expect(vault.resolveXmrNodeUrl()).rejects.toThrow(
      localWalletText(ETranslations.privacy_error_no_node__msg),
    );
  });
});

describe('XMR custom RPC', () => {
  const createVault = () => Object.create(XmrVault.prototype) as XmrVault;

  it('probes the configured URL through the node transport', async () => {
    const vault = createVault();
    jest.spyOn(vault, 'getXmrNetwork').mockResolvedValue('mainnet');
    nodeFetch.mockImplementation(async (url) =>
      jsonReply(
        String(url).endsWith('/get_height')
          ? { height: HEIGHT }
          : { result: XMR_MAINNET_GENESIS_HASH },
      ),
    );
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: ' https://node.example/proxy/// ',
        validateChainId: true,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: TOP_BLOCK });
    expect(requestedUrls()).toEqual([
      'https://node.example/proxy/get_height',
      'https://node.example/proxy/json_rpc',
    ]);
  });

  it('rejects non-HTTP protocols before any request', async () => {
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'file:///tmp/node',
        validateChainId: true,
      }),
    ).rejects.toThrow('http or https');
    expect(nodeFetch).not.toHaveBeenCalled();
  });

  it.each([{}, { height: 0 }, { height: -1 }, { height: '100' }])(
    'rejects a response without a usable height: %j',
    async (body) => {
      nodeFetch.mockResolvedValue(jsonReply(body));
      await expect(
        createVault().getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example',
          validateChainId: true,
        }),
      ).rejects.toThrow(
        localWalletText(ETranslations.privacy_error_node_unreachable__msg),
      );
    },
  );

  it('reports a node error status as unreachable', async () => {
    nodeFetch.mockResolvedValue(new Response('', { status: 502 }));
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).rejects.toThrow(
      localWalletText(ETranslations.privacy_error_node_unreachable__msg),
    );
  });

  it('preserves a transport failure as is', async () => {
    const failure = new Error('node certificate rejected');
    nodeFetch.mockRejectedValue(failure);
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).rejects.toBe(failure);
  });

  // Phones block cleartext, which arrives as a bare network error.
  it('asks for https when a phone cannot reach a plain http node', async () => {
    jest.replaceProperty(platformEnv, 'isNative', true);
    nodeFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'http://node.example:18081',
      }),
    ).rejects.toThrow('needs an https node');
    nodeFetch.mockResolvedValue(new Response('', { status: 404 }));
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'http://node.example:18081',
      }),
    ).rejects.toThrow(
      localWalletText(ETranslations.privacy_error_node_unreachable__msg),
    );
  });

  describe('network check', () => {
    // Serves the height, and the genesis reply or failure for the network check.
    function mockNode(genesis: (() => Response) | Record<string, unknown>) {
      nodeFetch.mockImplementation(async (url, init) => {
        if (String(url).endsWith('/get_height')) {
          return jsonReply({ height: HEIGHT });
        }
        expect(String(url)).toMatch(/\/json_rpc$/);
        expect(JSON.parse(String(init?.body))).toMatchObject({
          method: 'on_get_block_hash',
          params: [0],
        });
        if (typeof genesis === 'function') return genesis();
        return jsonReply(genesis);
      });
    }

    function createMainnetVault() {
      const vault = createVault();
      jest.spyOn(vault, 'getXmrNetwork').mockResolvedValue('mainnet');
      return vault;
    }

    it.each([XMR_MAINNET_GENESIS_HASH, XMR_MAINNET_GENESIS_HASH.toUpperCase()])(
      'accepts a node whose genesis block is mainnet: %s',
      async (result) => {
        mockNode({ result });
        await expect(
          createMainnetVault().getCustomRpcEndpointStatus({
            rpcUrl: 'https://node.example',
            validateChainId: true,
          }),
        ).resolves.toMatchObject({ bestBlockNumber: TOP_BLOCK });
      },
    );

    it.each([XMR_TESTNET_GENESIS_HASH, XMR_STAGENET_GENESIS_HASH])(
      'rejects a node on another network: %s',
      async (result) => {
        mockNode({ result });
        await expect(
          createMainnetVault().getCustomRpcEndpointStatus({
            rpcUrl: 'https://node.example/',
            validateChainId: true,
          }),
        ).rejects.toThrow('different network');
      },
    );

    // The runtime refuses such a node, so the form does too.
    it('rejects a node that does not confirm its network', async () => {
      for (const genesis of [
        { result: 'ab'.repeat(32) },
        { error: { code: -32_601 } },
        {},
        () => {
          throw new OneKeyLocalError('offline');
        },
        () => new Response('', { status: 404 }),
        () => new Response('<html>not found</html>'),
      ]) {
        mockNode(genesis);
        // eslint-disable-next-line no-await-in-loop
        await expect(
          createMainnetVault().getCustomRpcEndpointStatus({
            rpcUrl: 'https://node.example',
            validateChainId: true,
          }),
        ).rejects.toThrow('did not confirm');
      }
    });

    it('skips the check when chain validation is not requested', async () => {
      mockNode({ result: XMR_STAGENET_GENESIS_HASH });
      await expect(
        createMainnetVault().getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example',
        }),
      ).resolves.toMatchObject({ bestBlockNumber: TOP_BLOCK });
      expect(nodeFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('latest height', () => {
    function createNodeVault() {
      const vault = createVault();
      jest
        .spyOn(vault, 'resolveXmrNodeUrl')
        .mockResolvedValue('https://node.example/');
      return vault;
    }

    it('reads the configured node height with a plain request', async () => {
      nodeFetch.mockResolvedValue(jsonReply({ height: HEIGHT }));
      await expect(
        createNodeVault().getLocalWalletLatestHeight(),
      ).resolves.toBe(TOP_BLOCK);
      expect(requestedUrls()).toEqual(['https://node.example/get_height']);
    });

    it('reports no height for a reply without one', async () => {
      nodeFetch.mockResolvedValue(jsonReply({}));
      await expect(
        createNodeVault().getLocalWalletLatestHeight(),
      ).resolves.toBeNull();
    });
  });
});

describe('Zcash custom RPC', () => {
  const createVault = () => Object.create(ZcashVault.prototype) as ZcashVault;

  it('measures a root lightwalletd endpoint', async () => {
    const vault = createVault();
    directTip.mockResolvedValue(HEIGHT);
    lightdInfo.mockResolvedValue({ chainName: 'main' });
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: ' https://node.example:8443/ ',
        validateChainId: true,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    expect(directTip).toHaveBeenCalledWith({
      lightwalletdUrl: 'https://node.example:8443',
    });
  });

  it('preserves the reverse-proxy path used by the scanner', async () => {
    const vault = createVault();
    directTip.mockResolvedValue(HEIGHT);
    await expect(
      vault.zcashTestLightwalletdUrl(' https://node.example/proxy/// '),
    ).resolves.toMatchObject({ ok: true });
    expect(directTip).toHaveBeenCalledWith({
      lightwalletdUrl: 'https://node.example/proxy',
    });
  });

  it.each([
    'http://node.example',
    'file:///tmp/node',
    'not-a-url',
    'https://node.example/?key=example',
    'https://node.example/#fragment',
  ])('rejects an unsupported endpoint before any request: %s', async (url) => {
    const vault = createVault();
    await expect(vault.zcashTestLightwalletdUrl(url)).resolves.toMatchObject({
      ok: false,
    });
    expect(directTip).not.toHaveBeenCalled();
  });

  it('rejects an endpoint returning no chain tip', async () => {
    const vault = createVault();
    directTip.mockResolvedValue(null);
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).rejects.toThrow('unreachable');
  });

  it('rejects a height below mainnet shielded-pool activation', async () => {
    const vault = createVault();
    directTip.mockResolvedValue(100);
    await expect(
      vault.zcashTestLightwalletdUrl('https://node.example'),
    ).resolves.toEqual({
      ok: false,
      chainTip: 100,
      reason: 'wrong-chain',
    });
  });

  it.each(['test', 'regtest'])(
    'rejects a lightwalletd reporting chain %s',
    async (chainName) => {
      const vault = createVault();
      directTip.mockResolvedValue(HEIGHT);
      lightdInfo.mockResolvedValue({ chainName });
      await expect(
        vault.getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example/proxy/',
          validateChainId: true,
        }),
      ).rejects.toThrow('wrong-chain');
      expect(lightdInfo).toHaveBeenCalledWith({
        lightwalletdUrl: 'https://node.example/proxy',
      });
    },
  );

  it('accepts a lightwalletd that confirms mainnet', async () => {
    const vault = createVault();
    directTip.mockResolvedValue(HEIGHT);
    lightdInfo.mockResolvedValue({ chainName: 'main' });
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
  });

  // The runtime refuses a node whose chain it cannot confirm, so the form does too.
  it.each([
    [{ chainName: 'mainnet' }, 'wrong-chain'],
    [null, 'unconfirmed-chain'],
  ])('rejects an unknown chain name or no answer: %j', async (info, reason) => {
    const vault = createVault();
    directTip.mockResolvedValue(HEIGHT);
    lightdInfo.mockResolvedValue(info);
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).rejects.toThrow(reason);
  });

  it('skips the chain name check when validation is not requested', async () => {
    const vault = createVault();
    directTip.mockResolvedValue(HEIGHT);
    lightdInfo.mockResolvedValue({ chainName: 'test' });
    await expect(
      vault.getCustomRpcEndpointStatus({ rpcUrl: 'https://node.example' }),
    ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    expect(lightdInfo).not.toHaveBeenCalled();
  });

  it('reads the chain tip from the configured node, without the scanner', async () => {
    const vault = createVault();
    const getApi = jest.spyOn(vault, 'zcashGetApi');
    jest
      .spyOn(vault, 'zcashResolveLightwalletdUrl')
      .mockResolvedValue('https://node.example');
    directTip.mockResolvedValue(HEIGHT);
    await expect(vault.getLocalWalletChainTip()).resolves.toBe(HEIGHT);
    expect(directTip).toHaveBeenCalledWith({
      lightwalletdUrl: 'https://node.example',
    });
    expect(getApi).not.toHaveBeenCalled();
  });
});
