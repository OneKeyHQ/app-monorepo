import { OneKeyLocalError } from '../errors/errors/localError';

export function normalizeFullWalletXfp(walletXfp: string): string {
  const parts = /^([\da-fA-F]{1,8})--([1-9A-HJ-NP-Za-km-z]{100,120})$/.exec(
    walletXfp,
  );
  if (!parts) throw new OneKeyLocalError('Invalid wallet identity');
  return `${parts[1].toLowerCase().padStart(8, '0')}--${parts[2]}`;
}
