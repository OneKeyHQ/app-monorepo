import { validateMnemonic } from '@onekeyhq/core/src/secret';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AppError, ERROR_CODES } from '../../errors';

import type { AuthSessionMetadata } from './auth-types';

export const AUTH_DEFAULT_EVM_NETWORK_ID = 'evm--1';
export const MNEMONIC_SOURCE_LABEL = 'Mnemonic Import';
export const APP_TRANSFER_SOURCE_LABEL_PREFIX = 'Bot Wallet';

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

export function createMnemonicSessionMetadata(
  address: string,
  importedAt: string = new Date().toISOString(),
): AuthSessionMetadata {
  return {
    schemaVersion: 1,
    loginMethod: 'mnemonic',
    walletKind: 'hd',
    displayAddress: address,
    importedAt,
    sourceLabel: MNEMONIC_SOURCE_LABEL,
  };
}

export function buildHdWalletHashFromMnemonic(rawMnemonic: string): string {
  const normalizedMnemonic = normalizeMnemonic(rawMnemonic);
  return accountUtils.buildHdWalletHash({
    mnemonic: normalizedMnemonic,
  });
}

export function createAppTransferSourceLabel(botWalletHash: string): string {
  return `${APP_TRANSFER_SOURCE_LABEL_PREFIX} (${botWalletHash.slice(0, 8)})`;
}

export function createAppTransferSourceLabelFromMnemonic(
  rawMnemonic: string,
): string {
  return createAppTransferSourceLabel(
    buildHdWalletHashFromMnemonic(rawMnemonic),
  );
}

export function createAppTransferSessionMetadata(
  address: string,
  rawMnemonic: string,
  importedAt: string = new Date().toISOString(),
): AuthSessionMetadata {
  return {
    schemaVersion: 1,
    loginMethod: 'app_transfer',
    walletKind: 'hd',
    displayAddress: address,
    importedAt,
    sourceLabel: createAppTransferSourceLabelFromMnemonic(rawMnemonic),
  };
}
