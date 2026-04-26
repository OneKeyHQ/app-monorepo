import { validateMnemonic } from '@onekeyhq/core/src/secret';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AppError, ERROR_CODES } from '../../errors';

export function normalizeMnemonic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function assertValidMnemonic(mnemonic: string): void {
  if (validateMnemonic(mnemonic)) {
    return;
  }

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_MNEMONIC.code,
    'Invalid BIP39 mnemonic phrase',
    'Verify all words are correct and in the right order',
  );
}

export function buildHdWalletHashFromMnemonic(rawMnemonic: string): string {
  const normalizedMnemonic = normalizeMnemonic(rawMnemonic);
  return accountUtils.buildHdWalletHash({
    mnemonic: normalizedMnemonic,
  });
}
