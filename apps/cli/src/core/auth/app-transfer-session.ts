import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';

import { AUTH_LOGIN_METHOD_APP_TRANSFER } from './auth-types';
import { buildHdWalletHashFromMnemonic } from './mnemonic-utils';

import type { AuthSessionMetadata } from './auth-types';

export const APP_TRANSFER_SOURCE_LABEL_PREFIX = 'Bot Wallet';

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
    loginMethod: AUTH_LOGIN_METHOD_APP_TRANSFER,
    walletKind: WALLET_TYPE_HD,
    displayAddress: address,
    importedAt,
    sourceLabel: createAppTransferSourceLabelFromMnemonic(rawMnemonic),
  };
}
