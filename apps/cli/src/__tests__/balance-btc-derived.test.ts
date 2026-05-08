import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { registerBalanceCommand } from '../commands/balance';
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

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;

describe('balance BTC/TBTC derived wallet reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates all canonical tbtc address types when address is omitted', async () => {
    const getAddress = jest
      .fn()
      .mockResolvedValueOnce({ address: 'tb1ptaproot' })
      .mockResolvedValueOnce({ address: 'tb1qnative' })
      .mockResolvedValueOnce({ address: '2Nnested' })
      .mockResolvedValueOnce({ address: 'mlegacy' });
    mockGetSignerByImpl.mockResolvedValue({
      getAddress,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
    });
    mockGet.mockResolvedValue({
      balance: '1000',
      balanceParsed: '0.00001',
    });

    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('tbtc');
    expect(mockGetSignerByImpl).toHaveBeenCalledTimes(1);
    expect(getAddress).toHaveBeenNthCalledWith(1, 'tbtc--0', {
      addressType: 'taproot',
    });
    expect(getAddress).toHaveBeenNthCalledWith(2, 'tbtc--0', {
      addressType: 'native-segwit',
    });
    expect(getAddress).toHaveBeenNthCalledWith(3, 'tbtc--0', {
      addressType: 'nested-segwit',
    });
    expect(getAddress).toHaveBeenNthCalledWith(4, 'tbtc--0', {
      addressType: 'legacy',
    });
    expect(mockGet).toHaveBeenCalledTimes(4);

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data).toEqual({
      chain: 'tbtc',
      aggregate: {
        symbol: 'TBTC',
        balance: '0.00004',
        contractAddress: '',
        isNative: true,
      },
      items: [
        {
          addressType: 'taproot',
          label: 'Taproot',
          deriveType: 'BIP86',
          addressEncoding: EAddressEncodings.P2TR,
          address: 'tb1ptaproot',
          path: "m/86'/1'/0'/0/0",
          balance: '0.00001',
          balanceRaw: '1000',
        },
        {
          addressType: 'native-segwit',
          label: 'Native SegWit',
          deriveType: 'BIP84',
          addressEncoding: EAddressEncodings.P2WPKH,
          address: 'tb1qnative',
          path: "m/84'/1'/0'/0/0",
          balance: '0.00001',
          balanceRaw: '1000',
        },
        {
          addressType: 'nested-segwit',
          label: 'Nested SegWit',
          deriveType: 'default',
          addressEncoding: EAddressEncodings.P2SH_P2WPKH,
          address: '2Nnested',
          path: "m/49'/1'/0'/0/0",
          balance: '0.00001',
          balanceRaw: '1000',
        },
        {
          addressType: 'legacy',
          label: 'Legacy',
          deriveType: 'BIP44',
          addressEncoding: EAddressEncodings.P2PKH,
          address: 'mlegacy',
          path: "m/44'/1'/0'/0/0",
          balance: '0.00001',
          balanceRaw: '1000',
        },
      ],
    });
  });

  it('derives only the requested tbtc address type', async () => {
    const getAddress = jest.fn().mockResolvedValue({ address: 'tb1ptaproot' });
    mockGetSignerByImpl.mockResolvedValue({
      getAddress,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
    });
    mockGet.mockResolvedValue({
      balance: '1000',
      balanceParsed: '0.00001',
    });

    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(getAddress).toHaveBeenCalledTimes(1);
    expect(getAddress).toHaveBeenCalledWith('tbtc--0', {
      addressType: 'taproot',
    });

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data.items).toHaveLength(1);
    expect(parsed.data.items[0].addressType).toBe('taproot');
    expect(parsed.data.aggregate.balance).toBe('0.00001');
  });

  it('rejects address and address-type together', async () => {
    const program = createTestProgram();
    registerBalanceCommand(program);

    const result = await runCommand(program, [
      'balance',
      '--chain',
      'tbtc',
      '--address',
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      '--address-type',
      'taproot',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);
    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.error.message).toContain(
      '--address cannot be used with --address-type',
    );
  });
});
