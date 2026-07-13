import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';

import type {
  IATADetails,
  IEncodedTxSol,
} from '@onekeyhq/core/src/chains/sol/types';

import { AppError, ERROR_CODES } from '../../errors';

import {
  getSolAccountInfo,
  getSolLatestBlockhash,
  getSolRecentMaxPrioritizationFee,
  getSolTokenAccountsByOwner,
} from './rpc-client';

import type { TransactionInstruction } from '@solana/web3.js';

// `ataDetails` flows to the hardware signer so the device can render a
// "create token account" prompt; software signing ignores it.
export interface IBuildSolTransferResult {
  encodedTx: IEncodedTxSol;
  ataDetails?: IATADetails[];
}

export interface IBuildSolTransferParams {
  networkId: string;
  fromAddress: string;
  toAddress: string;
  /** Human-readable amount, e.g. "1.5". Decimals are taken from the chain
   *  config for native or from the SPL token metadata for SPL. */
  amount: string;
  /** Native decimals (9 for SOL) when sending native, token decimals for SPL. */
  decimals: number;
  /** SPL mint address. Omit for native SOL transfer. */
  tokenAddress?: string;
}

// Fungible-only: NFTs / pNFTs / Open Creator Protocol are intentionally
// out of scope for the CLI's `transfer` command.
export async function buildSolTransferTx(
  params: IBuildSolTransferParams,
): Promise<IBuildSolTransferResult> {
  const { networkId, fromAddress, toAddress, amount, decimals, tokenAddress } =
    params;

  const source = new PublicKey(fromAddress);
  const destination = new PublicKey(toAddress);

  const amountBn = new BigNumber(amount);
  if (!amountBn.isFinite() || amountBn.lte(0)) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `Invalid SOL transfer amount: ${amount}`,
      'Amount must be a positive number.',
    );
  }

  const rawAmount = amountBn.shiftedBy(decimals);
  if (!rawAmount.isInteger()) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `Amount has more decimals than the token supports (decimals=${decimals}).`,
      'Reduce decimal precision or check the token decimals value.',
    );
  }

  const instructions: TransactionInstruction[] = [];
  let ataDetails: IATADetails[] | undefined;

  const [{ recentBlockhash }, prioritizationFee] = await Promise.all([
    getSolLatestBlockhash(networkId),
    getSolRecentMaxPrioritizationFee(networkId, [fromAddress]),
  ]);

  // Priority fee is unconditional in the CLI (no disableSolanaPriorityFee flag).
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: prioritizationFee,
    }),
  );

  if (!tokenAddress) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: source,
        toPubkey: destination,
        lamports: BigInt(rawAmount.toFixed()),
      }),
    );
  } else {
    const mint = new PublicKey(tokenAddress);
    const programId = await resolveSplTokenProgramId({
      networkId,
      mint,
      owner: source,
    });
    const sourceAta = getAssociatedTokenAddressSync(
      mint,
      source,
      true,
      programId,
    );
    const destinationAta = getAssociatedTokenAddressSync(
      mint,
      destination,
      true,
      programId,
    );
    const destinationAtaInfo = await getSolAccountInfo(
      networkId,
      destinationAta.toBase58(),
    );

    if (destinationAtaInfo === null) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          source,
          destinationAta,
          destination,
          mint,
          programId,
        ),
      );
      ataDetails = [
        {
          owner: destination.toBase58(),
          programId: programId.toBase58(),
          mintAddress: mint.toBase58(),
          associatedTokenAddress: destinationAta.toBase58(),
        },
      ];
    }

    instructions.push(
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        source,
        BigInt(rawAmount.toFixed()),
        decimals,
        [],
        programId,
      ),
    );
  }

  const messageV0 = new TransactionMessage({
    payerKey: source,
    recentBlockhash,
    instructions,
  }).compileToV0Message([]);
  const versionedTx = new VersionedTransaction(messageV0);
  const encodedTx = bs58.encode(Buffer.from(versionedTx.serialize()));

  return ataDetails ? { encodedTx, ataDetails } : { encodedTx };
}

// Falls back to the original SPL Token program when the source has no
// account for the mint yet (matches App default).
async function resolveSplTokenProgramId(args: {
  networkId: string;
  mint: PublicKey;
  owner: PublicKey;
}): Promise<PublicKey> {
  const { networkId, mint, owner } = args;
  const ownerAddress = owner.toBase58();
  const [legacyAccounts, token2022Accounts] = await Promise.all([
    getSolTokenAccountsByOwner(
      networkId,
      ownerAddress,
      TOKEN_PROGRAM_ID.toBase58(),
    ),
    getSolTokenAccountsByOwner(
      networkId,
      ownerAddress,
      TOKEN_2022_PROGRAM_ID.toBase58(),
    ),
  ]);
  const match = [...legacyAccounts, ...token2022Accounts].find(
    (item) => item.account.data.parsed.info.mint === mint.toBase58(),
  );
  if (!match) {
    return TOKEN_PROGRAM_ID;
  }
  return match.account.data.program === 'spl-token'
    ? TOKEN_PROGRAM_ID
    : TOKEN_2022_PROGRAM_ID;
}
