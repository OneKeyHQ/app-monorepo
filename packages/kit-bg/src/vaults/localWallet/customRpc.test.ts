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
import { fetchZcashLightdInfoDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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

  it('reads a node switch from the existing store on the next call', async () => {
    const ensureBuiltInRpc = jest
      .fn()
      .mockResolvedValueOnce({ rpc: 'https://first.example', enabled: true })
      .mockResolvedValueOnce({ rpc: 'https://second.example', enabled: true });
    const vault = Object.assign(createVault(), {
      networkId: 'xmr--0',
      backgroundApi: { serviceCustomRpc: { ensureBuiltInRpc } },
    });
    await expect(vault.resolveXmrNodeUrl()).resolves.toBe(
      'https://first.example',
    );
    await expect(vault.resolveXmrNodeUrl()).resolves.toBe(
      'https://second.example',
    );
    expect(ensureBuiltInRpc).toHaveBeenNthCalledWith(2, {
      networkId: 'xmr--0',
    });
  });

  it('honors a disabled node instead of using an implicit fallback', async () => {
    const vault = Object.assign(createVault(), {
      networkId: 'xmr--0',
      backgroundApi: {
        serviceCustomRpc: {
          ensureBuiltInRpc: async () => ({
            rpc: 'https://node.example',
            enabled: false,
          }),
        },
      },
    });
    await expect(vault.resolveXmrNodeUrl()).rejects.toThrow(
      localWalletText(ETranslations.privacy_error_no_node__msg),
    );
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

  it('honors the disabled sync node in the existing store', async () => {
    const vault = Object.assign(createVault(), {
      networkId: 'zec--0',
      backgroundApi: {
        serviceCustomRpc: {
          ensureBuiltInRpc: async () => ({
            rpc: 'https://node.example',
            enabled: false,
          }),
        },
      },
    });
    await expect(vault.zcashResolveLightwalletdUrl()).rejects.toThrow(
      localWalletText(ETranslations.privacy_error_no_node__msg),
    );
  });
});
