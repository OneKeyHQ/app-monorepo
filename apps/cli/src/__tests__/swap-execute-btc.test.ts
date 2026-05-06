import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import { Psbt } from 'bitcoinjs-lib';
import {
  getBtcForkNetwork,
  getInputsToSignFromPsbt,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { formatPsbtHex } from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';

import { registerSwapExecuteCommand } from '../commands/swap/swap-execute';
import {
  _resetPendingDir,
  _setPendingDirForTest,
  loadPending,
  savePending,
} from '../core';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';
import { createTestProgram, extractJson, runCommand } from './test-helpers';

import type { IPendingOrder } from '../core';

jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: Record<string, string>) => headers,
  ),
}));

jest.mock('bitcoinjs-lib', () => ({
  Psbt: {
    fromHex: jest.fn(() => ({ mockPsbt: true })),
  },
}));

jest.mock('@onekeyhq/core/src/chains/btc/sdkBtc', () => ({
  getBtcForkNetwork: jest.fn(() => ({ networkChainCode: 'btc' })),
  getInputsToSignFromPsbt: jest.fn(() => [
    {
      index: 0,
      publicKey: '02abcdef',
      address: 'bc1psourceaddress',
    },
  ]),
}));

jest.mock('@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils', () => ({
  formatPsbtHex: jest.fn((psbtHex: string) => `formatted-${psbtHex}`),
}));

jest.mock('../infra', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    setEnv: jest.fn(),
  },
}));

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;
const mockPsbtFromHex = Psbt.fromHex as jest.MockedFunction<
  typeof Psbt.fromHex
>;
const mockGetBtcForkNetwork = getBtcForkNetwork as jest.MockedFunction<
  typeof getBtcForkNetwork
>;
const mockGetInputsToSignFromPsbt =
  getInputsToSignFromPsbt as jest.MockedFunction<
    typeof getInputsToSignFromPsbt
  >;
const mockFormatPsbtHex = formatPsbtHex as jest.MockedFunction<
  typeof formatPsbtHex
>;

function registerSwapCommands() {
  const program = createTestProgram();
  const swap = program.command('swap');
  registerSwapExecuteCommand(swap);
  return program;
}

function makeSigner(address = 'bc1psourceaddress') {
  return {
    getAddress: jest.fn().mockResolvedValue({
      address,
      path: "m/86'/0'/0'/0/0",
      publicKey: '02abcdef',
    }),
    signTransaction: jest.fn().mockResolvedValue({
      rawTx: 'signed-btc-raw-tx',
    }),
    signMessage: jest.fn(),
  };
}

function makePendingOrder(
  overrides: Partial<IPendingOrder> = {},
): IPendingOrder {
  const now = Date.now();
  return {
    orderId: 'btc_order',
    status: 'pending',
    chain: 'btc',
    networkId: 'btc--0',
    createdAt: now,
    updatedAt: now,
    fromToken: { contractAddress: '', symbol: 'BTC', decimals: 8 },
    toToken: { contractAddress: '', symbol: 'ETH', decimals: 18 },
    amount: '0.01',
    txData: {
      btcData: {
        hexStr: '70736274ff0100',
        addressType: [EAddressEncodings.P2TR],
      },
    },
    provider: 'test-provider',
    toNetworkId: 'evm--1',
    protocolType: 'Bridge',
    btcAddressing: {
      from: {
        addressType: 'taproot',
        addressEncoding: EAddressEncodings.P2TR,
        deriveType: 'BIP86',
        address: 'bc1psourceaddress',
        path: "m/86'/0'/0'/0/0",
      },
      to: null,
    },
    ...overrides,
  };
}

async function runExecute(args: string[] = []) {
  return runCommand(registerSwapCommands(), [
    '--yes',
    'swap',
    'execute',
    '--chain',
    'btc',
    '--order',
    'btc_order',
    ...args,
  ]);
}

describe('swap execute BTC PSBT path', () => {
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    tempDir = mkdtempSync(join(tmpdir(), 'swap-execute-btc-'));
    _setPendingDirForTest(tempDir);
    mockGetSignerByImpl.mockResolvedValue(makeSigner());
    mockPost.mockResolvedValue({
      result:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });

  afterEach(() => {
    _resetPendingDir();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects PSBT address encoding mismatch', async () => {
    savePending(
      'btc_order',
      makePendingOrder({
        txData: {
          btcData: {
            hexStr: '70736274ff0100',
            addressType: [EAddressEncodings.P2WPKH],
          },
        },
      }),
    );

    const result = await runExecute();

    expect(result.exitCode).not.toBe(0);
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_SWAP_FAILED');
    expect(parsed.error.message).toMatch(/derivation|path|address type/i);
  });

  it('executes valid BTC PSBT with explicit address type', async () => {
    savePending('btc_order', makePendingOrder());

    const result = await runExecute(['--from-address-type', 'taproot']);

    expect(result.exitCode).toBe(0);
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('btc');
    const signer = await mockGetSignerByImpl.mock.results[0].value;
    expect(signer.getAddress).toHaveBeenCalledWith('btc--0', {
      addressType: 'taproot',
    });
    expect(signer.signTransaction).toHaveBeenCalledWith({
      networkId: 'btc--0',
      account: {
        address: 'bc1psourceaddress',
        path: "m/86'/0'/0'/0/0",
        pub: '02abcdef',
      },
      unsignedTx: {
        encodedTx: {
          psbtHex: 'formatted-70736274ff0100',
          inputsToSign: [
            {
              index: 0,
              publicKey: '02abcdef',
              address: 'bc1psourceaddress',
            },
          ],
        },
      },
      relPaths: ['0/0'],
      addressType: 'taproot',
      signOnly: false,
    });
    expect(mockFormatPsbtHex).toHaveBeenCalledWith('70736274ff0100');
    expect(mockGetBtcForkNetwork).toHaveBeenCalledWith('btc');
    expect(mockPsbtFromHex).toHaveBeenCalledWith('formatted-70736274ff0100', {
      network: { networkChainCode: 'btc' },
    });
    expect(mockGetInputsToSignFromPsbt).toHaveBeenCalledWith({
      psbt: { mockPsbt: true },
      psbtNetwork: { networkChainCode: 'btc' },
      account: {
        address: 'bc1psourceaddress',
        path: "m/86'/0'/0'/0/0",
        pub: '02abcdef',
      },
      isBtcWalletProvider: true,
    });
    expect(mockPost).toHaveBeenCalledWith(
      'wallet',
      '/wallet/v1/account/send-transaction',
      {
        networkId: 'btc--0',
        accountAddress: 'bc1psourceaddress',
        tx: 'signed-btc-raw-tx',
      },
    );

    const updated = loadPending('btc_order');
    expect(updated.status).toBe('executed');
    expect(updated.txHash).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.txHash).toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(parsed.data.txHash).not.toMatch(/^0x/);
  });

  it('rejects wallet address mismatch', async () => {
    savePending('btc_order', makePendingOrder());
    mockGetSignerByImpl.mockResolvedValue(makeSigner('bc1pdifferentaddress'));

    const result = await runExecute();

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_SWAP_FAILED');
    expect(parsed.error.message).toContain('Wallet address mismatch');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('rejects PSBT with no signable inputs for selected address', async () => {
    savePending('btc_order', makePendingOrder());
    mockGetInputsToSignFromPsbt.mockReturnValueOnce([]);

    const result = await runExecute();

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_SWAP_FAILED');
    expect(parsed.error.message).toContain('no signable BTC inputs');
    expect(parsed.error.message).toContain('selected address');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('rejects --from-address-type mismatch with pending metadata', async () => {
    savePending('btc_order', makePendingOrder());

    const result = await runExecute(['--from-address-type', 'native-segwit']);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('BIZ_SWAP_FAILED');
    expect(parsed.error.message).toContain('--from-address-type');
    expect(parsed.error.suggestion).toContain('taproot');
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();
  });
});
