import {
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TYPE_SIZE,
  getAccountLen,
  getExtensionTypes,
  unpackMint,
} from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { EParamsEncodings } from './sdkSol/ClientSol';

import type ClientSol from './sdkSol/ClientSol';
import type { TransactionInstruction } from '@solana/web3.js';

// Mint extension IDs in token-2022's ExtensionType, including newer SDK entries.
const KNOWN_MINT_EXTENSIONS = new Set([
  0, 1, 3, 4, 6, 9, 10, 12, 14, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28,
]);
const PAUSABLE_MINT_EXTENSION = 26;

export async function getSolanaSwapRent({
  instructions,
  accountAddress,
  client,
}: {
  instructions: TransactionInstruction[];
  accountAddress: string;
  client: Pick<
    ClientSol,
    | 'getMultipleAccountsInfo'
    | 'getAccountInfo'
    | 'getMinimumBalanceForRentExemption'
  >;
}): Promise<string | undefined> {
  const creations = new Map<string, TransactionInstruction>();
  for (const instruction of instructions) {
    if (
      instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) &&
      (instruction.data.length === 0 ||
        (instruction.data.length === 1 && instruction.data[0] <= 1)) &&
      instruction.keys[0]?.pubkey.toBase58() === accountAddress &&
      instruction.keys.length >= 6
    ) {
      creations.set(instruction.keys[1].pubkey.toBase58(), instruction);
    }
  }
  if (!creations.size) return undefined;

  const accounts = await client.getMultipleAccountsInfo({
    addresses: [...creations.keys()],
    encoding: EParamsEncodings.BASE64,
  });
  const rents = new Map<number, Promise<number>>();
  const getRent = (size: number) => {
    let rent = rents.get(size);
    if (!rent) {
      rent = client.getMinimumBalanceForRentExemption(size);
      rents.set(size, rent);
    }
    return rent;
  };
  let ataRent = new BigNumber(0);
  for (const [index, instruction] of [...creations.values()].entries()) {
    const account = accounts[index];
    // An existing token account makes CreateIdempotent a no-op. An already funded
    // system account still needs only the missing lamports, not the full rent.
    if (
      !account ||
      new PublicKey(account.owner).equals(SystemProgram.programId)
    ) {
      const programId = instruction.keys[5].pubkey;
      let size = ACCOUNT_SIZE;
      if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
        const mintAddress = instruction.keys[3].pubkey;
        const mintInfo = await client.getAccountInfo({
          address: mintAddress.toBase58(),
          encoding: EParamsEncodings.BASE64,
        });
        if (!mintInfo)
          throw new OneKeyLocalError('Solana mint account is missing');
        const mint = unpackMint(
          mintAddress,
          {
            ...mintInfo,
            owner: new PublicKey(mintInfo.owner),
            data: Buffer.from(mintInfo.data[0], 'base64'),
          },
          programId,
        );
        const extensions = new Set<number>(getExtensionTypes(mint.tlvData));
        if ([...extensions].some((type) => !KNOWN_MINT_EXTENSIONS.has(type))) {
          throw new OneKeyLocalError('Unsupported Solana mint extension');
        }
        // Match required_init_account_extensions: SDK 0.4.8 overstates
        // confidential accounts and predates the zero-sized PausableAccount.
        const required = [ExtensionType.ImmutableOwner];
        if (extensions.has(ExtensionType.TransferFeeConfig)) {
          required.push(ExtensionType.TransferFeeAmount);
        }
        if (extensions.has(ExtensionType.NonTransferable)) {
          required.push(ExtensionType.NonTransferableAccount);
        }
        if (extensions.has(ExtensionType.TransferHook)) {
          required.push(ExtensionType.TransferHookAccount);
        }
        size =
          getAccountLen(required) +
          (extensions.has(PAUSABLE_MINT_EXTENSION)
            ? TYPE_SIZE + LENGTH_SIZE
            : 0);
      } else if (!programId.equals(TOKEN_PROGRAM_ID)) {
        throw new OneKeyLocalError('Unsupported Solana token program');
      }
      const required = new BigNumber(await getRent(size)).minus(
        account?.lamports ?? 0,
      );
      ataRent = ataRent.plus(BigNumber.maximum(required, 0));
    }
  }
  return ataRent.isZero() ? undefined : ataRent.shiftedBy(-9).toFixed();
}
