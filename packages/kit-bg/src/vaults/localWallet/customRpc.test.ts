/* eslint-disable import/first */
// cspell:ignore lightd stagenet
jest.mock('../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch', () => ({
  xmrHostFetch: jest.fn(),
}));
jest.mock(
  '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
  () => ({
    ...jest.requireActual(
      '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect',
    ),
    fetchZcashLightdInfoDirect: jest.fn(),
  }),
);

import { xmrHostFetch } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch';
import { ZCASH_LIGHTWALLETD_MAINNET } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashLightdInfoDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { XMR_BUILT_IN_NODE_URLS } from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';

import ServiceCustomRpc from '../../services/ServiceCustomRpc';
import XmrVault from '../impls/xmr/Vault';
import ZcashVault from '../impls/zcash/Vault';

import { localWalletText } from './messages';

const hostFetch = jest.mocked(xmrHostFetch!);
const lightdInfo = jest.mocked(fetchZcashLightdInfoDirect);
const HEIGHT = 3_512_327;

afterEach(() => {
  jest.restoreAllMocks();
  hostFetch.mockReset();
  lightdInfo.mockReset();
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

  it('probes the configured URL through the scanner host relay', async () => {
    const vault = createVault();
    hostFetch.mockResolvedValue(
      bufferUtils.utf8ToBytes(
        JSON.stringify({
          height: HEIGHT,
        }),
      ),
    );
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: ' https://node.example/proxy/// ',
        validateChainId: true,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    expect(hostFetch).toHaveBeenCalledWith(
      'https://node.example/proxy/get_height',
      'application/json',
      new Uint8Array(),
    );
  });

  it('rejects non-HTTP protocols before invoking the relay', async () => {
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'file:///tmp/node',
        validateChainId: true,
      }),
    ).rejects.toThrow('http or https');
    expect(hostFetch).not.toHaveBeenCalled();
  });

  it.each([{}, { height: 0 }, { height: -1 }, { height: '100' }])(
    'rejects a response without a usable height: %j',
    async (body) => {
      hostFetch.mockResolvedValue(
        bufferUtils.utf8ToBytes(JSON.stringify(body)),
      );
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

  it('preserves relay failures without retrying renderer fetch', async () => {
    const failure = new Error('node certificate rejected');
    hostFetch.mockRejectedValue(failure);
    const rendererFetch = jest.spyOn(globalThis, 'fetch');
    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).rejects.toBe(failure);
    expect(rendererFetch).not.toHaveBeenCalled();
  });

  describe('network check', () => {
    function mockNode(info: (() => Uint8Array) | Record<string, unknown>) {
      hostFetch.mockImplementation(async (url) => {
        if (url.endsWith('/get_height')) {
          return bufferUtils.utf8ToBytes(JSON.stringify({ height: HEIGHT }));
        }
        if (typeof info === 'function') return info();
        return bufferUtils.utf8ToBytes(JSON.stringify(info));
      });
    }

    function createMainnetVault() {
      const vault = createVault();
      jest.spyOn(vault, 'getXmrNetwork').mockResolvedValue('mainnet');
      return vault;
    }

    it.each([
      { nettype: 'stagenet' },
      { nettype: 'testnet' },
      { mainnet: false, stagenet: true },
    ])('rejects a node on another network: %j', async (info) => {
      mockNode(info);
      await expect(
        createMainnetVault().getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example/',
          validateChainId: true,
        }),
      ).rejects.toThrow('different network');
      expect(hostFetch).toHaveBeenLastCalledWith(
        'https://node.example/get_info',
        'application/json',
        new Uint8Array(),
      );
    });

    it.each([
      { nettype: 'mainnet', mainnet: true },
      { mainnet: true },
      {},
      { nettype: 'Mainnet' },
    ])('accepts a mainnet or silent node: %j', async (info) => {
      mockNode(info);
      await expect(
        createMainnetVault().getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example',
          validateChainId: true,
        }),
      ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    });

    it('accepts a node whose /get_info is unavailable or not JSON', async () => {
      for (const info of [
        () => {
          throw new OneKeyLocalError('404');
        },
        () => bufferUtils.utf8ToBytes('<html>not found</html>'),
        () => bufferUtils.utf8ToBytes('null'),
      ]) {
        mockNode(info);
        // eslint-disable-next-line no-await-in-loop
        await expect(
          createMainnetVault().getCustomRpcEndpointStatus({
            rpcUrl: 'https://node.example',
            validateChainId: true,
          }),
        ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
      }
    });

    it('skips the check when chain validation is not requested', async () => {
      mockNode({ nettype: 'stagenet' });
      await expect(
        createMainnetVault().getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example',
        }),
      ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
      expect(hostFetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Zcash custom RPC', () => {
  const createVault = () => Object.create(ZcashVault.prototype) as ZcashVault;

  function withTip(vault: ZcashVault, tip: number | null) {
    const getChainTip = jest.fn(async () => tip);
    type IZcashApi = Awaited<ReturnType<ZcashVault['zcashGetApi']>>;
    const api: Pick<IZcashApi, 'getChainTip'> = { getChainTip };
    jest.spyOn(vault, 'zcashGetApi').mockResolvedValue(api as IZcashApi);
    return getChainTip;
  }

  it('uses the scanner SDK to measure a root lightwalletd endpoint', async () => {
    const vault = createVault();
    const getChainTip = withTip(vault, HEIGHT);
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: ' https://node.example:8443/ ',
        validateChainId: true,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    expect(getChainTip).toHaveBeenCalledWith({
      network: 'main',
      lightwalletdUrl: 'https://node.example:8443',
    });
  });

  it('preserves the reverse-proxy path used by the scanner', async () => {
    const vault = createVault();
    const getChainTip = withTip(vault, HEIGHT);
    await expect(
      vault.zcashTestLightwalletdUrl(' https://node.example/proxy/// '),
    ).resolves.toMatchObject({ ok: true });
    expect(getChainTip).toHaveBeenCalledWith({
      network: 'main',
      lightwalletdUrl: 'https://node.example/proxy',
    });
  });

  it.each([
    'http://node.example',
    'file:///tmp/node',
    'not-a-url',
    'https://node.example/?key=example',
    'https://node.example/#fragment',
  ])(
    'rejects an unsupported endpoint before loading the SDK: %s',
    async (url) => {
      const vault = createVault();
      const getApi = jest.spyOn(vault, 'zcashGetApi');
      await expect(vault.zcashTestLightwalletdUrl(url)).resolves.toMatchObject({
        ok: false,
      });
      expect(getApi).not.toHaveBeenCalled();
    },
  );

  it('rejects an endpoint returning no chain tip', async () => {
    const vault = createVault();
    withTip(vault, null);
    await expect(
      vault.getCustomRpcEndpointStatus({
        rpcUrl: 'https://node.example',
        validateChainId: true,
      }),
    ).rejects.toThrow('unreachable');
  });

  it('rejects a height below mainnet shielded-pool activation', async () => {
    const vault = createVault();
    withTip(vault, 100);
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
      withTip(vault, HEIGHT);
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

  it.each([{ chainName: 'main' }, { chainName: 'mainnet' }, null])(
    'accepts main, an unknown name, or no answer: %j',
    async (info) => {
      const vault = createVault();
      withTip(vault, HEIGHT);
      lightdInfo.mockResolvedValue(info);
      await expect(
        vault.getCustomRpcEndpointStatus({
          rpcUrl: 'https://node.example',
          validateChainId: true,
        }),
      ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    },
  );

  it('skips the chain name check when validation is not requested', async () => {
    const vault = createVault();
    withTip(vault, HEIGHT);
    lightdInfo.mockResolvedValue({ chainName: 'test' });
    await expect(
      vault.getCustomRpcEndpointStatus({ rpcUrl: 'https://node.example' }),
    ).resolves.toMatchObject({ bestBlockNumber: HEIGHT });
    expect(lightdInfo).not.toHaveBeenCalled();
  });
});
