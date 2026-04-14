import { revealEntropyToMnemonic } from '@onekeyhq/core/src/secret';
import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { AppError, ERROR_CODES } from '../../errors';

function isRevealableSeed(value: unknown): value is IBip39RevealableSeed {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as IBip39RevealableSeed).entropyWithLangPrefixed ===
      'string' &&
    typeof (value as IBip39RevealableSeed).seed === 'string'
  );
}

export function extractBotWalletMnemonicFromTransferData(
  transferData: IPrimeTransferData,
): string {
  const walletIds = Object.keys(transferData.privateData.wallets ?? {});
  const importedAccountIds = Object.keys(
    transferData.privateData.importedAccounts ?? {},
  );
  const watchingAccountIds = Object.keys(
    transferData.privateData.watchingAccounts ?? {},
  );

  if (
    walletIds.length !== 1 ||
    importedAccountIds.length > 0 ||
    watchingAccountIds.length > 0 ||
    transferData.privateData.deviceKeyPack
  ) {
    throw new AppError(
      ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
      'CLI only supports importing a single Bot Wallet from App Transfer',
      'Retry the transfer from OneKey App using one Bot Wallet only',
    );
  }

  const [walletId] = walletIds;
  if (!accountUtils.isBotWallet({ walletId })) {
    throw new AppError(
      ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
      'CLI App Transfer payload must contain a Bot Wallet',
      'Retry the transfer from OneKey App using a Bot Wallet export',
    );
  }

  const credential = transferData.privateData.decryptedCredentials?.[walletId];

  if (!isRevealableSeed(credential)) {
    throw new AppError(
      ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
      'App Transfer payload did not include an importable Bot Wallet credential',
      'Retry the transfer from OneKey App after updating the sender-side transfer payload',
    );
  }

  return revealEntropyToMnemonic(
    bufferUtils.toBuffer(credential.entropyWithLangPrefixed),
  );
}
