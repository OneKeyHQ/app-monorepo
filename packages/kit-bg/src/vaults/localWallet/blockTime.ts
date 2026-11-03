import type { IVaultSettings } from '../types';

export type ILocalWalletBlockTime = Pick<
  NonNullable<IVaultSettings['localWallet']>,
  'blockTimeSeconds' | 'blockTimeChange'
>;

// The target block interval at `height`; an unknown height keeps the original one.
export function getLocalWalletBlockSeconds(
  blockTime: ILocalWalletBlockTime,
  height: number | null | undefined,
): number {
  const change = blockTime.blockTimeChange;
  if (change && typeof height === 'number' && height >= change.fromHeight) {
    return change.blockTimeSeconds;
  }
  return blockTime.blockTimeSeconds;
}

// A block count set at the original interval that stands for wall-clock time, at `height`.
export function getLocalWalletTimeWindowBlocks(
  blockTime: ILocalWalletBlockTime | undefined,
  blocks: number,
  height: number | null | undefined,
): number {
  if (!blockTime) return blocks;
  const change = blockTime.blockTimeChange;
  if (!change || typeof height !== 'number' || height < change.fromHeight) {
    return blocks;
  }
  return Math.round(
    (blocks * blockTime.blockTimeSeconds) / change.blockTimeSeconds,
  );
}
