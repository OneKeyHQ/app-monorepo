import {
  encodeSensitiveTextAsync,
  revealableSeedFromMnemonic,
} from '@onekeyhq/core/src/secret';

import { decrypt, secureWipe } from '../../core/crypto-utils';
import { AppError, ERROR_CODES } from '../../errors';
import { KeychainStorage } from '../../infra/keychain-storage';
import {
  CLI_PASSWORD,
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
} from '../keychain-keys';

/**
 * Shared base for HD (software) signers. Owns the mnemonic decryption +
 * password helpers every software signer needs. Kit-bg analogue:
 * `KeyringHdBase`.
 */
export class SignerHdBase {
  protected keychain = new KeychainStorage();

  async getEncodedPassword(): Promise<string> {
    return encodeSensitiveTextAsync({ text: CLI_PASSWORD });
  }

  async getHdCredential(): Promise<string> {
    const encryptionKeyBuf = await this.keychain.get(KEYCHAIN_ENCRYPTION_KEY);
    if (!encryptionKeyBuf) {
      throw new AppError(
        ERROR_CODES.AUTH_NO_WALLET.code,
        'No authenticated wallet found. Log in first.',
        'Run: onekey auth login --app-transfer',
      );
    }

    try {
      const encryptedMnemonic = await this.keychain.get(KEYCHAIN_MNEMONIC_KEY);
      if (!encryptedMnemonic) {
        throw new AppError(
          ERROR_CODES.AUTH_NO_WALLET.code,
          'No authenticated wallet found. Log in first.',
          'Run: onekey auth login --app-transfer',
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
