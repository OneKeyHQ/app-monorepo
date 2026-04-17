import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { extractBotWalletMnemonicFromTransferData } from '../core/auth/app-transfer-payload';
import { ERROR_CODES } from '../errors';

function makeTransferData(): IPrimeTransferData {
  return {
    privateData: {
      credentials: {},
      decryptedCredentials: {},
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {
        'hd-bot--parent-1--0': {
          id: 'hd-bot--parent-1--0',
        },
      },
    },
    publicData: undefined,
    isEmptyData: false,
    isWatchingOnly: false,
    appVersion: '1.0.0',
  } as unknown as IPrimeTransferData;
}

describe('extractBotWalletMnemonicFromTransferData', () => {
  it('rejects payloads that include more than one imported wallet shape', () => {
    const transferData = makeTransferData();
    transferData.privateData.importedAccounts = {
      'imported-1': {},
    } as never;

    expect(() =>
      extractBotWalletMnemonicFromTransferData(transferData),
    ).toThrow(
      expect.objectContaining({
        code: ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
        message:
          'CLI only supports importing a single Bot Wallet from App Transfer',
      }),
    );
  });

  it('rejects payloads without an importable bot wallet credential', () => {
    const transferData = makeTransferData();

    expect(() =>
      extractBotWalletMnemonicFromTransferData(transferData),
    ).toThrow(
      expect.objectContaining({
        code: ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
        message:
          'App Transfer payload did not include an importable Bot Wallet credential',
      }),
    );
  });
});
