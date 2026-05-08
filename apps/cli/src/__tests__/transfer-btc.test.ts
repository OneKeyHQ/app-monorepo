import { registerTransferCommand } from '../commands/transfer';
import { buildBtcTransferTx } from '../core/btc/tx-builder';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

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

jest.mock('../core/btc/tx-builder', () => ({
  buildBtcTransferTx: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;
const mockBuildBtcTransferTx = buildBtcTransferTx as jest.MockedFunction<
  typeof buildBtcTransferTx
>;

const recipientAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const senderAddress = 'tb1qsenderaddress';
const senderAccountPath = "m/86'/1'/0'";
const senderReceivePath = "m/86'/1'/0'/0/0";

function createBtcSigner() {
  return {
    getAddress: jest.fn().mockResolvedValue({
      address: senderAddress,
      path: senderAccountPath,
      publicKey: '02abcdef',
    }),
    signTransaction: jest.fn().mockResolvedValue({
      rawTx: '02000000000100',
    }),
    signMessage: jest.fn(),
  };
}

function mockBuiltTx() {
  mockBuildBtcTransferTx.mockResolvedValue({
    encodedTx: {
      inputs: [],
      outputs: [],
      inputsForCoinSelect: [],
      outputsForCoinSelect: [],
      fee: '123',
      txSize: 140,
    },
    btcExtraInfo: {
      pathToAddresses: {},
      addressToPath: {},
      inputAddressesEncodings: [],
      nonWitnessPrevTxs: {},
    },
    relPaths: ['0/0'],
    summary: {
      fee: '123',
      txSize: 140,
      inputCount: 1,
      outputCount: 2,
    },
  } as Awaited<ReturnType<typeof buildBtcTransferTx>>);
}

describe('BTC/TBTC transfer command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
  });

  it('requires --address-type before building a tbtc transfer', async () => {
    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--chain',
      'tbtc',
      '--to',
      recipientAddress,
      '--amount',
      '0.00001',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();
    expect(mockBuildBtcTransferTx).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toContain('--address-type');
  });

  it('builds tbtc dry-run without signing or broadcasting', async () => {
    const signer = createBtcSigner();
    mockGetSignerByImpl.mockResolvedValue(signer);
    mockBuiltTx();

    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
      '--to',
      recipientAddress,
      '--amount',
      '0.00001',
      '--fee-rate',
      '1',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('tbtc');
    expect(signer.getAddress).toHaveBeenCalledWith('tbtc--0', {
      addressType: 'taproot',
    });
    expect(mockBuildBtcTransferTx).toHaveBeenCalledWith(
      expect.objectContaining({
        impl: 'tbtc',
        networkId: 'tbtc--0',
        fromAddress: senderAddress,
        fromPath: senderReceivePath,
        toAddress: recipientAddress,
        amount: '0.00001',
        nativeDecimals: 8,
        feeRate: '1',
      }),
    );
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data).toEqual(
      expect.objectContaining({
        chain: 'tbtc',
        addressType: 'taproot',
        from: senderAddress,
        to: recipientAddress,
        amount: '0.00001',
        fee: '123',
        txSize: 140,
        inputCount: 1,
        outputCount: 2,
        dryRun: true,
      }),
    );
  });

  it('rejects token transfers for tbtc', async () => {
    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      'transfer',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
      '--to',
      recipientAddress,
      '--amount',
      '0.00001',
      '--token',
      '0x0000000000000000000000000000000000000001',
      '--dry-run',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(mockGetSignerByImpl).not.toHaveBeenCalled();
    expect(mockBuildBtcTransferTx).not.toHaveBeenCalled();

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.code).toBe('PARAM_INVALID_TOKEN');
  });

  it('signs and broadcasts tbtc transfer with a 64 hex txid', async () => {
    const signer = createBtcSigner();
    mockGetSignerByImpl.mockResolvedValue(signer);
    mockBuiltTx();
    const txid = 'a'.repeat(64);
    mockPost.mockResolvedValueOnce({ result: txid });

    const program = createTestProgram();
    registerTransferCommand(program);

    const result = await runCommand(program, [
      '--yes',
      'transfer',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
      '--to',
      recipientAddress,
      '--amount',
      '0.00001',
      '--fee-rate',
      '1',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(signer.signTransaction).toHaveBeenCalledWith({
      networkId: 'tbtc--0',
      account: {
        address: senderAddress,
        path: senderAccountPath,
        pub: '02abcdef',
      },
      unsignedTx: {
        encodedTx: expect.objectContaining({
          fee: '123',
          txSize: 140,
        }),
      },
      btcExtraInfo: expect.any(Object),
      relPaths: ['0/0'],
      addressType: 'taproot',
    });
    expect(mockPost).toHaveBeenCalledWith(
      'wallet',
      '/wallet/v1/account/send-transaction',
      {
        networkId: 'tbtc--0',
        accountAddress: senderAddress,
        tx: '02000000000100',
      },
    );

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data).toEqual({
      txid,
      from: senderAddress,
      to: recipientAddress,
      amount: '0.00001',
      chain: 'tbtc',
      addressType: 'taproot',
    });
  });
});
