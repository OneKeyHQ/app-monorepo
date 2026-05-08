import type { ICliBotWalletEncryptedCredential } from '@onekeyhq/shared/src/types/cliBotWallet';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { extractBotWalletAuthSessionInputFromTransferData } from '../core/auth/app-transfer-payload';
import { ERROR_CODES } from '../errors';

const ENCRYPTED_CREDENTIAL: ICliBotWalletEncryptedCredential = {
  version: 1,
  walletId: 'hd-bot--parent-1--0',
  keyId: 'key-aaaa',
  accessToken: 'access-token',
  ciphertextBase64: Buffer.from('ciphertext').toString('base64'),
  sourceLabel: 'Bot Wallet (parent-1 / 0)',
  algorithm: 'aes-256-gcm',
};

function makeTransferData(
  payload?: ICliBotWalletEncryptedCredential,
): IPrimeTransferData {
  return {
    privateData: {
      credentials: {},
      decryptedCredentials: {},
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {},
      ...(payload ? { cliBotWalletEncryptedCredential: payload } : {}),
    },
    publicData: undefined,
    isEmptyData: false,
    isWatchingOnly: false,
    appVersion: '1.0.0',
  } as unknown as IPrimeTransferData;
}

describe('extractBotWalletAuthSessionInputFromTransferData', () => {
  it('returns the cli-bot-wallet input when the encrypted credential is present', () => {
    const transferData = makeTransferData(ENCRYPTED_CREDENTIAL);

    expect(
      extractBotWalletAuthSessionInputFromTransferData(transferData),
    ).toEqual({
      kind: 'cli-bot-wallet',
      payload: ENCRYPTED_CREDENTIAL,
    });
  });

  it('throws AUTH_TRANSFER_INVALID_PAYLOAD when the credential is missing', () => {
    const transferData = makeTransferData();

    expect(() =>
      extractBotWalletAuthSessionInputFromTransferData(transferData),
    ).toThrow(
      expect.objectContaining({
        code: ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
        message:
          'App Transfer payload did not include a CLI Bot Wallet credential',
      }),
    );
  });
});
