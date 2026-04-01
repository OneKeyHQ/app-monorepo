import {
  encodeSensitiveTextAsync,
  revealableSeedFromMnemonic,
} from '@onekeyhq/core/src/secret';

import { decrypt, secureWipe } from '../../core/crypto-utils';
import { AppError, ERROR_CODES } from '../../errors';
import { KeychainStorage } from '../../infra/keychain-storage';

const CLI_PASSWORD = 'onekey';
const WALLET_NAME = 'default';

export const KEYCHAIN_MNEMONIC_KEY = `wallet:${WALLET_NAME}/mnemonic`;
export const KEYCHAIN_ENCRYPTION_KEY = `wallet:${WALLET_NAME}/encryption-key`;
export { CLI_PASSWORD };

export class SignerBase {
  protected keychain = new KeychainStorage();

  async getEncodedPassword(): Promise<string> {
    return encodeSensitiveTextAsync({ text: CLI_PASSWORD });
  }

  async getHdCredential(): Promise<string> {
    const encryptionKeyBuf = await this.keychain.get(KEYCHAIN_ENCRYPTION_KEY);
    if (!encryptionKeyBuf) {
      throw new AppError(
        ERROR_CODES.AUTH_NO_WALLET.code,
        'No wallet found. Import a wallet first.',
        'Run: onekey import --mnemonic',
      );
    }

    try {
      const encryptedMnemonic = await this.keychain.get(KEYCHAIN_MNEMONIC_KEY);
      if (!encryptedMnemonic) {
        throw new AppError(
          ERROR_CODES.AUTH_NO_WALLET.code,
          'No wallet found. Import a wallet first.',
          'Run: onekey import --mnemonic',
        );
      }

      const encryptionKey = encryptionKeyBuf.toString('utf-8');
      let mnemonicBuf: Buffer | null = null;

      try {
        mnemonicBuf = await decrypt(encryptedMnemonic, encryptionKey);
        const mnemonic = mnemonicBuf.toString('utf-8');
        return await revealableSeedFromMnemonic(mnemonic, CLI_PASSWORD);
      } finally {
        if (mnemonicBuf) secureWipe(mnemonicBuf);
      }
    } finally {
      secureWipe(encryptionKeyBuf);
    }
  }
}
