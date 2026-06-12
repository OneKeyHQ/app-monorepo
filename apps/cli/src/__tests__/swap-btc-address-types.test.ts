import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { registerSwapBuildCommand } from '../commands/swap/swap-build';
import { _resetSwapNetworksCache } from '../commands/swap/swap-networks';
import { registerSwapQuoteCommand } from '../commands/swap/swap-quote';
import { _resetPendingDir, _setPendingDirForTest, loadPending } from '../core';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

import type { fetchSwapNetworks } from '../commands/swap/swap-networks';

const SOL_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_SYSTEM_PROGRAM = '11111111111111111111111111111111';

jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: Record<string, string>) => headers,
  ),
}));

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

jest.mock('../commands/command-guards', () => {
  const actual = jest.requireActual<
    typeof import('../commands/command-guards')
  >('../commands/command-guards');
  return {
    ...actual,
    requireAuthenticatedCommand: jest.fn(async () => undefined),
  };
});

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;

const originalFetch = globalThis.fetch;

function registerSwapCommands() {
  const program = createTestProgram();
  const swap = program.command('swap');
  registerSwapQuoteCommand(swap);
  registerSwapBuildCommand(swap);
  return program;
}

function mockSwapNetworks(): void {
  mockGet.mockImplementation(async (service) => {
    if (service === 'swap') {
      return [
        {
          networkId: 'evm--1',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: true,
        },
        {
          networkId: 'btc--0',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: false,
        },
        {
          networkId: 'tbtc--0',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: false,
        },
      ] as Awaited<ReturnType<typeof fetchSwapNetworks>>;
    }
    throw new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      `Unexpected GET service: ${service}`,
      'Test fixture mismatch',
    );
  });
}

function mockSolSwapNetworks(): void {
  mockGet.mockImplementation(async (service) => {
    if (service === 'swap') {
      return [
        {
          networkId: 'sol--101',
          supportSingleSwap: true,
          supportCrossChainSwap: true,
          supportLimit: false,
        },
      ] as Awaited<ReturnType<typeof fetchSwapNetworks>>;
    }
    if (service === 'utility') {
      return [
        {
          name: 'USD Coin',
          price: '1',
          symbol: 'USDC',
          address: SOL_USDC,
          network: 'sol--101',
          logoUrl: '',
          isNative: false,
          decimals: 6,
          liquidity: '1000000',
        },
      ];
    }
    throw new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      `Unexpected GET service: ${service}`,
      'Test fixture mismatch',
    );
  });
}

function quoteItem(params: {
  fromNetworkId: string;
  toNetworkId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
}) {
  return {
    info: {
      provider: 'test-provider',
      providerName: 'Test Provider',
    },
    fromAmount: '1',
    toAmount: '0.99',
    minToAmount: '0.98',
    estimatedTime: 60,
    instantRate: '0.99',
    isBest: true,
    fee: null,
    quoteResultCtx: { route: 'mock' },
    fromTokenInfo: {
      networkId: params.fromNetworkId,
      contractAddress: params.fromTokenAddress,
      symbol: 'FROM',
      decimals: 8,
    },
    toTokenInfo: {
      networkId: params.toNetworkId,
      contractAddress: params.toTokenAddress,
      symbol: 'TO',
      decimals: 18,
    },
  };
}

function mockQuoteSse(params: Parameters<typeof quoteItem>[0]): void {
  globalThis.fetch = jest.fn(async () => {
    const body = [
      'data: {"totalQuoteCount":1,"eventId":"event-1"}',
      '',
      `data: ${JSON.stringify({ data: [quoteItem(params)] })}`,
      '',
    ].join('\n');
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as typeof fetch;
}

function createSigner(address: string, path: string) {
  return {
    getAddress: jest.fn().mockResolvedValue({
      address,
      path,
      publicKey: '02abcdef',
    }),
    signTransaction: jest.fn(),
    signMessage: jest.fn(),
  };
}

function mockSolSecurityAndBuildTx(): void {
  mockPost.mockImplementation(async (service, path) => {
    if (
      service === 'utility' &&
      path === '/utility/v2/market/token/security/batch'
    ) {
      return {
        [SOL_USDC]: {
          trusted_token: {
            value: 'Yes',
            content: 'trusted token',
            riskType: 'safe',
          },
        },
      };
    }
    if (service === 'swap' && path === '/swap/v1/build-tx') {
      return {
        result: {
          info: {
            provider: 'test-provider',
            providerName: 'Test Provider',
          },
          fromTokenInfo: {
            networkId: 'sol--101',
            contractAddress: SOL_SYSTEM_PROGRAM,
          },
          toTokenInfo: {
            networkId: 'sol--101',
            contractAddress: SOL_USDC,
          },
        },
        OKXTxObject: {
          data: 'sol-bs58-encoded-tx',
        },
      };
    }
    throw new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      `Unexpected POST ${service}${path}`,
      'Test fixture mismatch',
    );
  });
}

describe('swap BTC address type metadata', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    _resetSwapNetworksCache();
    tempDir = mkdtempSync(join(tmpdir(), 'swap-btc-address-types-'));
    _setPendingDirForTest(tempDir);
    mockSwapNetworks();
    mockGetSignerByImpl.mockImplementation(async (impl) => {
      if (impl === 'evm') {
        return createSigner(
          '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          "m/44'/60'/0'/0/0",
        );
      }
      if (impl === 'btc') {
        return createSigner('bc1psourceaddress', "m/86'/0'/0'");
      }
      if (impl === 'tbtc') {
        return createSigner('tb1pdestaddress', "m/86'/1'/0'");
      }
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CHAIN.code,
        `Unexpected signer impl: ${impl}`,
        'Test fixture mismatch',
      );
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    _resetPendingDir();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('quote requires --from-address-type when source is btc', async () => {
    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'quote',
      '--chain',
      'btc',
      '--to-chain',
      'eth',
      '--from',
      'BTC',
      '--to',
      'ETH',
      '--amount',
      '0.01',
      '--to-address-type',
      'taproot',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toContain('--from-address-type');
  });

  it('build accepts SOL native system-program token info and persists solSwapTx', async () => {
    mockSolSwapNetworks();
    mockSolSecurityAndBuildTx();
    mockGetSignerByImpl.mockResolvedValue(
      createSigner(
        '9RfWUGz4vKhLgjfQVzNPJEqwBd8oGnTwNjU9q5Vk8ces',
        "m/44'/501'/0'/0'",
      ),
    );
    mockQuoteSse({
      fromNetworkId: 'sol--101',
      toNetworkId: 'sol--101',
      fromTokenAddress: '',
      toTokenAddress: SOL_USDC,
    });

    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'build',
      '--chain',
      'sol',
      '--from',
      'SOL',
      '--to',
      SOL_USDC,
      '--amount',
      '0.001',
    ]);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.hasTxData).toBe(true);

    const pending = loadPending(parsed.data.orderId);
    expect(pending?.txData.solSwapTx).toEqual({
      encodedTx: 'sol-bs58-encoded-tx',
    });
  });

  it('quote rejects tbtc source before BTC address type validation', async () => {
    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'quote',
      '--chain',
      'tbtc',
      '--to-chain',
      'eth',
      '--from',
      'TBTC',
      '--to',
      'ETH',
      '--amount',
      '0.01',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_CHAIN');
    expect(parsed.error.message).toContain('does not support chain "tbtc"');
    expect(parsed.error.message).not.toContain('--from-address-type');
  });

  it('quote requires --to-address-type when destination is btc', async () => {
    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'quote',
      '--chain',
      'eth',
      '--to-chain',
      'btc',
      '--from',
      'ETH',
      '--to',
      'BTC',
      '--amount',
      '0.01',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toContain('--to-address-type');
  });

  it('build rejects tbtc destination before BTC address type validation', async () => {
    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'build',
      '--chain',
      'eth',
      '--to-chain',
      'tbtc',
      '--from',
      'ETH',
      '--to',
      'TBTC',
      '--amount',
      '0.01',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_CHAIN');
    expect(parsed.error.message).toContain('does not support chain "tbtc"');
    expect(parsed.error.message).not.toContain('--to-address-type');
  });

  it('quote BTC source plus EVM destination uses BTC source as userAddress and destination as receivingAddress', async () => {
    mockQuoteSse({
      fromNetworkId: 'btc--0',
      toNetworkId: 'evm--1',
      fromTokenAddress: '',
      toTokenAddress: '',
    });

    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'quote',
      '--chain',
      'btc',
      '--to-chain',
      'eth',
      '--from',
      'BTC',
      '--to',
      'ETH',
      '--amount',
      '0.01',
      '--from-address-type',
      'taproot',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('btc');
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('evm');
    const btcSigner = await mockGetSignerByImpl.mock.results[0].value;
    const evmSigner = await mockGetSignerByImpl.mock.results[1].value;
    expect(btcSigner.getAddress).toHaveBeenCalledWith('btc--0', {
      addressType: 'taproot',
    });
    expect(evmSigner.getAddress).toHaveBeenCalledWith('evm--1');
    const fetchUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    const params = new URL(fetchUrl).searchParams;
    expect(params.get('userAddress')).toBe('bc1psourceaddress');
    expect(params.get('receivingAddress')).toBe(
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.metadata.btcAddressing).toEqual({
      from: expect.objectContaining({
        addressType: 'taproot',
        addressEncoding: EAddressEncodings.P2TR,
        deriveType: 'BIP86',
        address: 'bc1psourceaddress',
        path: "m/86'/0'/0'/0/0",
      }),
      to: null,
    });
  });

  it('build EVM source plus BTC destination uses BTC destination as receivingAddress and persists metadata', async () => {
    mockQuoteSse({
      fromNetworkId: 'evm--1',
      toNetworkId: 'btc--0',
      fromTokenAddress: '',
      toTokenAddress: '',
    });
    mockPost.mockResolvedValueOnce({
      result: {
        info: {
          provider: 'test-provider',
          providerName: 'Test Provider',
        },
      },
      tx: { to: '0xrouter', data: '0x1234' },
    });

    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'build',
      '--chain',
      'eth',
      '--to-chain',
      'btc',
      '--from',
      'ETH',
      '--to',
      'BTC',
      '--amount',
      '0.01',
      '--to-address-type',
      'taproot',
    ]);

    expect(result.exitCode).toBe(0);
    const buildBody = mockPost.mock.calls[0][2] as Record<string, unknown>;
    expect(buildBody.userAddress).toBe(
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );
    expect(buildBody.receivingAddress).toBe('bc1psourceaddress');

    const parsed = JSON.parse(extractJson(result.stdout));
    const order = loadPending(parsed.data.orderId);
    expect(order.btcAddressing?.to).toEqual(
      expect.objectContaining({
        addressType: 'taproot',
        address: 'bc1psourceaddress',
        path: "m/86'/0'/0'/0/0",
      }),
    );
  });

  it('build BTC source uses --from-address-type and full receive path metadata', async () => {
    mockQuoteSse({
      fromNetworkId: 'btc--0',
      toNetworkId: 'evm--1',
      fromTokenAddress: '',
      toTokenAddress: '',
    });
    mockPost.mockResolvedValueOnce({
      result: {
        info: {
          provider: 'test-provider',
          providerName: 'Test Provider',
        },
      },
      btcData: {
        hexStr: '70736274ff0100',
        addressType: ['taproot'],
      },
    });

    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'build',
      '--chain',
      'btc',
      '--to-chain',
      'eth',
      '--from',
      'BTC',
      '--to',
      'ETH',
      '--amount',
      '0.01',
      '--from-address-type',
      'taproot',
    ]);

    expect(result.exitCode).toBe(0);
    const btcSigner = await mockGetSignerByImpl.mock.results[0].value;
    const evmSigner = await mockGetSignerByImpl.mock.results[1].value;
    expect(btcSigner.getAddress).toHaveBeenCalledTimes(1);
    expect(btcSigner.getAddress).toHaveBeenCalledWith('btc--0', {
      addressType: 'taproot',
    });
    expect(btcSigner.getAddress).not.toHaveBeenCalledWith('btc--0');
    expect(evmSigner.getAddress).toHaveBeenCalledWith('evm--1');

    const buildBody = mockPost.mock.calls[0][2] as Record<string, unknown>;
    expect(buildBody.userAddress).toBe('bc1psourceaddress');
    expect(buildBody.receivingAddress).toBe(
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.hasTxData).toBe(true);
    const order = loadPending(parsed.data.orderId);
    expect(order.txData.btcData).toEqual({
      hexStr: '70736274ff0100',
      addressType: ['taproot'],
    });
    expect(order.btcAddressing?.from).toEqual(
      expect.objectContaining({
        addressType: 'taproot',
        address: 'bc1psourceaddress',
        path: "m/86'/0'/0'/0/0",
      }),
    );
  });

  it('rejects BTC source build response without tx or valid btcData', async () => {
    mockQuoteSse({
      fromNetworkId: 'btc--0',
      toNetworkId: 'evm--1',
      fromTokenAddress: '',
      toTokenAddress: '',
    });
    mockPost.mockResolvedValueOnce({
      result: {
        info: {
          provider: 'test-provider',
          providerName: 'Test Provider',
        },
      },
      btcData: {
        addressType: ['taproot'],
      },
    });

    const result = await runCommand(registerSwapCommands(), [
      'swap',
      'build',
      '--chain',
      'btc',
      '--to-chain',
      'eth',
      '--from',
      'BTC',
      '--to',
      'ETH',
      '--amount',
      '0.01',
      '--from-address-type',
      'taproot',
    ]);

    expect(result.exitCode).not.toBe(0);

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_SWAP_FAILED');
    expect(parsed.error.message).toContain('provider deposit data');
  });

  it('rejects corrupted pending orders with non-object btcAddressing', () => {
    writeFileSync(
      join(tempDir, 'corrupt-btc-addressing.json'),
      JSON.stringify(
        {
          orderId: 'corrupt-btc-addressing',
          status: 'pending',
          chain: 'eth',
          networkId: 'evm--1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          fromToken: { contractAddress: '', symbol: 'ETH', decimals: 18 },
          toToken: { contractAddress: '', symbol: 'BTC', decimals: 8 },
          amount: '0.01',
          txData: { tx: {} },
          btcAddressing: 'bad',
        },
        null,
        2,
      ),
    );

    expect(() => loadPending('corrupt-btc-addressing')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_FAILED',
      }),
    );
  });
});
