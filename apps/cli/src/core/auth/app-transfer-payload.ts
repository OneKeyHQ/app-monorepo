import type { IPersistAuthSessionInput } from '@onekeyhq/shared/src/types/cliBotWallet';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { AppError, ERROR_CODES } from '../../errors';

export function extractBotWalletAuthSessionInputFromTransferData(
  transferData: IPrimeTransferData,
): IPersistAuthSessionInput {
  const payload = transferData.privateData.cliBotWalletEncryptedCredential;
  if (payload) {
    return {
      kind: 'cli-bot-wallet',
      payload,
    };
  }

  throw new AppError(
    ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
    'App Transfer payload did not include a CLI Bot Wallet credential',
    'Retry the transfer from OneKey App after updating the sender-side transfer payload',
  );
}
