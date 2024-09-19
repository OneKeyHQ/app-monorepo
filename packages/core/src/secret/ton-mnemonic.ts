import {
  mnemonicToKeyPair as tonMnemonicToKeyPair,
  validateMnemonic as tonValidateMnemonic,
} from 'tonweb-mnemonic';

import { InvalidMnemonic } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type { IBip39RevealableSeed } from './bip39';

function tonMnemonicToRevealableSeed(mnemonic: string): IBip39RevealableSeed {
  try {
    return {
      entropyWithLangPrefixed: bufferUtils.bytesToHex(
        Buffer.from(mnemonic, 'utf-8'),
      ),
      seed: bufferUtils.bytesToHex(Buffer.from(mnemonic, 'utf-8')),
    };
  } catch {
    throw new InvalidMnemonic();
  }
}

function tonRevealEntropyToMnemonic(
  entropyWithLangPrefixed: Buffer | string,
): string {
  const entropyWithLangPrefixedBuffer = bufferUtils.toBuffer(
    entropyWithLangPrefixed,
  );
  return entropyWithLangPrefixedBuffer.toString('utf-8');
}

export {
  tonValidateMnemonic,
  tonMnemonicToKeyPair,
  tonMnemonicToRevealableSeed,
  tonRevealEntropyToMnemonic,
};
