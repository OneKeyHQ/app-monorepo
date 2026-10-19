import {
  ExtensionType,
  MintLayout,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccountLen,
  getMintLen,
  getTypeLen,
} from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';

import { getSolanaSwapRent } from './solanaRentUtils';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('./sdkSol/ClientSol', () => ({
  EParamsEncodings: { BASE64: 'base64' },
}));

const payer = new PublicKey(Buffer.alloc(32, 1));
const mint = new PublicKey(Buffer.alloc(32, 2));
const ata = new PublicKey(Buffer.alloc(32, 3));
const other = new PublicKey(Buffer.alloc(32, 4));
const create = (program = TOKEN_PROGRAM_ID, funding = payer, address = ata) =>
  createAssociatedTokenAccountIdempotentInstruction(
    funding,
    address,
    other,
    mint,
    program,
  );
const accountInfo = (
  owner = SystemProgram.programId,
  lamports = 0,
  data = Buffer.alloc(0),
) => ({
  owner,
  lamports,
  executable: false,
  data: [data.toString('base64'), 'base64'] as [string, string],
});

function fixture() {
  return {
    getMultipleAccountsInfo: jest.fn().mockResolvedValue([null, accountInfo()]),
    getAccountInfo: jest.fn(),
    getMinimumBalanceForRentExemption: jest.fn(async (size: number) =>
      size === 0 ? 650_240 : 1_488_440,
    ),
  };
}

describe('getSolanaSwapRent', () => {
  it.each([Buffer.alloc(0), Buffer.from([0]), Buffer.from([1])])(
    'queries rent for Create/CreateIdempotent, deduplicating creations: %p',
    async (data) => {
      const client = fixture();
      const instruction = create();
      instruction.data = data;
      await expect(
        getSolanaSwapRent({
          instructions: [instruction, instruction],
          accountAddress: payer.toBase58(),
          client,
        }),
      ).resolves.toBe('0.00148844');
      expect(client.getMinimumBalanceForRentExemption.mock.calls).toEqual([
        [165],
      ]);
      expect(client.getMultipleAccountsInfo).toHaveBeenCalledWith({
        addresses: [ata.toBase58()],
        encoding: 'base64',
      });
    },
  );

  it('does not charge an existing idempotent ATA', async () => {
    const client = fixture();
    client.getMultipleAccountsInfo.mockResolvedValue([
      accountInfo(TOKEN_PROGRAM_ID, 1_488_440),
      accountInfo(),
    ]);
    await expect(
      getSolanaSwapRent({
        instructions: [create()],
        accountAddress: payer.toBase58(),
        client,
      }),
    ).resolves.toBeUndefined();
    expect(client.getMinimumBalanceForRentExemption).not.toHaveBeenCalled();
  });

  it('subtracts prefunded system account lamports and sums distinct ATAs', async () => {
    const client = fixture();
    client.getMultipleAccountsInfo.mockResolvedValue([
      accountInfo(SystemProgram.programId, 100_000),
      null,
      accountInfo(),
    ]);
    await expect(
      getSolanaSwapRent({
        instructions: [create(), create(TOKEN_PROGRAM_ID, payer, other)],
        accountAddress: payer.toBase58(),
        client,
      }),
    ).resolves.toBe('0.00287688');
    expect(client.getMinimumBalanceForRentExemption.mock.calls).toEqual([
      [165],
    ]);
  });

  it('ignores another payer and RecoverNested instructions', async () => {
    const client = fixture();
    const recover = create();
    recover.data = Buffer.from([2]);
    client.getMultipleAccountsInfo.mockResolvedValue([accountInfo()]);
    await expect(
      getSolanaSwapRent({
        instructions: [create(TOKEN_PROGRAM_ID, other), recover],
        accountAddress: payer.toBase58(),
        client,
      }),
    ).resolves.toBeUndefined();
    expect(client.getMultipleAccountsInfo).not.toHaveBeenCalled();
  });

  it('does not charge rent already covered by prefunded lamports', async () => {
    const client = fixture();
    client.getMultipleAccountsInfo.mockResolvedValue([
      accountInfo(SystemProgram.programId, 1_488_440),
    ]);
    await expect(
      getSolanaSwapRent({
        instructions: [create()],
        accountAddress: payer.toBase58(),
        client,
      }),
    ).resolves.toBeUndefined();
  });

  it.each([false, true])(
    'includes Token-2022 immutable owner and required extensions: %s',
    async (hasTransferFee) => {
      const client = fixture();
      const data = Buffer.alloc(
        hasTransferFee
          ? getMintLen([ExtensionType.TransferFeeConfig])
          : MintLayout.span,
      );
      if (hasTransferFee) {
        data[165] = 1;
        data.writeUInt16LE(ExtensionType.TransferFeeConfig, 166);
        data.writeUInt16LE(getTypeLen(ExtensionType.TransferFeeConfig), 168);
      }
      MintLayout.encode(
        {
          mintAuthorityOption: 0,
          mintAuthority: payer,
          supply: 0n,
          decimals: 6,
          isInitialized: true,
          freezeAuthorityOption: 0,
          freezeAuthority: payer,
        },
        data,
      );
      client.getAccountInfo.mockResolvedValue(
        accountInfo(TOKEN_2022_PROGRAM_ID, 1, data),
      );
      await getSolanaSwapRent({
        instructions: [create(TOKEN_2022_PROGRAM_ID)],
        accountAddress: payer.toBase58(),
        client,
      });
      expect(client.getMinimumBalanceForRentExemption).toHaveBeenCalledWith(
        getAccountLen([
          ExtensionType.ImmutableOwner,
          ...(hasTransferFee ? [ExtensionType.TransferFeeAmount] : []),
        ]),
      );
    },
  );

  it('propagates RPC failure instead of treating unknown rent as zero', async () => {
    const client = fixture();
    client.getMinimumBalanceForRentExemption.mockRejectedValue(
      new Error('rpc unavailable'),
    );
    await expect(
      getSolanaSwapRent({
        instructions: [create()],
        accountAddress: payer.toBase58(),
        client,
      }),
    ).rejects.toThrow('rpc unavailable');
  });

  it.each([
    [ExtensionType.ConfidentialTransferMint, 65, 170],
    [ExtensionType.NonTransferable, 0, 174],
    [ExtensionType.TransferHook, 64, 175],
    [26, 33, 174],
    [25, 56, 170],
  ])(
    'uses required initialization size for mint extension %s',
    async (type, length, size) => {
      const client = fixture();
      const data = Buffer.alloc(170 + length);
      data[165] = 1;
      data.writeUInt16LE(type, 166);
      data.writeUInt16LE(length, 168);
      client.getAccountInfo.mockResolvedValue(
        accountInfo(TOKEN_2022_PROGRAM_ID, 1, data),
      );
      await getSolanaSwapRent({
        instructions: [create(TOKEN_2022_PROGRAM_ID)],
        accountAddress: payer.toBase58(),
        client,
      });
      expect(client.getMinimumBalanceForRentExemption).toHaveBeenCalledWith(
        size,
      );
    },
  );

  it('rejects unknown mint extensions instead of assuming zero extra size', async () => {
    const client = fixture();
    const data = Buffer.alloc(170);
    data[165] = 1;
    data.writeUInt16LE(99, 166);
    client.getAccountInfo.mockResolvedValue(
      accountInfo(TOKEN_2022_PROGRAM_ID, 1, data),
    );
    await expect(
      getSolanaSwapRent({
        instructions: [create(TOKEN_2022_PROGRAM_ID)],
        accountAddress: payer.toBase58(),
        client,
      }),
    ).rejects.toThrow('Unsupported Solana mint extension');
  });
});
