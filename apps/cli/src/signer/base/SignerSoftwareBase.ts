import {
  encodeSensitiveTextAsync,
  revealableSeedFromMnemonic,
} from '@onekeyhq/core/src/secret';
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { decrypt, secureWipe } from '../../core/crypto-utils';
import { AppError, ERROR_CODES } from '../../errors';
import { KeychainStorage } from '../../infra/keychain-storage';
import {
  CLI_PASSWORD,
  KEYCHAIN_ENCRYPTION_KEY,
  KEYCHAIN_MNEMONIC_KEY,
} from '../keychain-keys';

import type { ISignTransactionPayload, ISigner } from '../types';

/**
 * Shared base for software signers (HD today; imported / watching in the
 * future). Owns the mnemonic decryption + password helpers every software
 * signer needs. Concrete chain implementations live under
 * `signer/impls/<chain>/SignerHd.ts` and only implement the three
 * `ISigner` methods.
 *
 * Kit-bg analogue: `KeyringSoftwareBase`. The kit-bg pattern keeps a
 * separate marker subclass per wallet kind (`KeyringHdBase`,
 * `KeyringImportedBase`); we don't have a wallet-kind enum yet, so HD
 * extends this base directly until a second software wallet kind lands.
 */
export abstract class SignerSoftwareBase implements ISigner {
  protected keychain = new KeychainStorage();

  abstract getAddress(networkId: string): Promise<ICoreApiGetAddressItem>;

  abstract signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;

  protected async baseGetEncodedPassword(): Promise<string> {
    return encodeSensitiveTextAsync({ text: CLI_PASSWORD });
  }

  protected async baseGetHdCredential(): Promise<string> {
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
