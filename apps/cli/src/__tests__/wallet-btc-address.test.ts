import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { registerWalletCommands } from '../commands/wallet';
import { getSignerByImpl } from '../signer';

import { createTestProgram, extractJson, runCommand } from './test-helpers';

jest.mock('../signer', () => ({
  getSignerByImpl: jest.fn(),
}));

const mockGetSignerByImpl = getSignerByImpl as jest.MockedFunction<
  typeof getSignerByImpl
>;

describe('wallet BTC address commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
  });

  it('lists btc address types in canonical order', async () => {
    const program = createTestProgram();
    registerWalletCommands(program);

    const result = await runCommand(program, [
      'wallet',
      'address-types',
      '--chain',
      'btc',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(extractJson(result.stdout)) as {
      data: { addressType: string }[];
    };
    expect(parsed.data.map((item) => item.addressType)).toEqual([
      'taproot',
      'native-segwit',
      'nested-segwit',
      'legacy',
    ]);
    expect(parsed.data[0]).toEqual(
      expect.objectContaining({
        chain: 'btc',
        networkId: 'btc--0',
        addressType: 'taproot',
        label: 'Taproot',
        deriveType: 'BIP86',
        addressEncoding: EAddressEncodings.P2TR,
        path: "m/86'/0'/0'/0/0",
        accountPath: "m/86'/0'/0'",
        relPath: '0/0',
      }),
    );
  });

  it('derives tbtc address with explicit address type', async () => {
    const getAddress = jest.fn().mockResolvedValue({
      address: 'tb1ptestaddress',
      publicKey: '02abcdef',
    });
    mockGetSignerByImpl.mockResolvedValue({
      getAddress,
      signTransaction: jest.fn(),
      signMessage: jest.fn(),
    });

    const program = createTestProgram();
    registerWalletCommands(program);

    const result = await runCommand(program, [
      'wallet',
      'address',
      '--chain',
      'tbtc',
      '--address-type',
      'taproot',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(mockGetSignerByImpl).toHaveBeenCalledWith('tbtc');
    expect(getAddress).toHaveBeenCalledWith('tbtc--0', {
      addressType: 'taproot',
    });

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.data).toEqual(
      expect.objectContaining({
        chain: 'tbtc',
        networkId: 'tbtc--0',
        addressType: 'taproot',
        label: 'Taproot',
        deriveType: 'BIP86',
        addressEncoding: EAddressEncodings.P2TR,
        path: "m/86'/1'/0'/0/0",
        accountPath: "m/86'/1'/0'",
        relPath: '0/0',
        address: 'tb1ptestaddress',
        publicKey: '02abcdef',
      }),
    );
  });

  it('requires address type for wallet address', async () => {
    const program = createTestProgram();
    registerWalletCommands(program);

    const result = await runCommand(program, [
      'wallet',
      'address',
      '--chain',
      'btc',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toEqual(
      expect.objectContaining({
        code: 'PARAM_MISSING_REQUIRED',
      }),
    );
    expect(parsed.error.message).toContain('--address-type');
  });

  it('rejects non-BTC chains for wallet address commands', async () => {
    const program = createTestProgram();
    registerWalletCommands(program);

    const result = await runCommand(program, [
      'wallet',
      'address-types',
      '--chain',
      'eth',
      '--json',
    ]);

    expect(result.exitCode).not.toBe(0);

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toEqual(
      expect.objectContaining({
        code: 'PARAM_INVALID_CHAIN',
      }),
    );
    expect(parsed.error.message).toContain('Unsupported BTC chain');
  });
});
