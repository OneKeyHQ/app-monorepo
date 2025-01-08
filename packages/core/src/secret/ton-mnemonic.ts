import {
  mnemonicToKeyPair as tonMnemonicToKeyPairFn,
  validateMnemonic as tonValidateMnemonicFn,
} from 'tonweb-mnemonic';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { InvalidMnemonic } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type { IBip39RevealableSeed } from './bip39';

function tonMnemonicToRevealableSeed(mnemonic: string): IBip39RevealableSeed {
  try {
    // TODO: should validate mnemonic before return, make function to async first
    // tonValidateMnemonicFn(mnemonic);
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

async function tonValidateMnemonic(mnemonicArray: string[]): Promise<boolean> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.secret.tonValidateMnemonic(
      mnemonicArray,
    );
  }
  return tonValidateMnemonicFn(mnemonicArray);
}

async function tonMnemonicToKeyPair(
  mnemonicArray: string[],
): Promise<ReturnType<typeof tonMnemonicToKeyPairFn>> {
  if (platformEnv.isNative) {
    return appGlobals.$webembedApiProxy.secret.tonMnemonicToKeyPair(
      mnemonicArray,
    );
  }
  return tonMnemonicToKeyPairFn(mnemonicArray);
}

export {
  tonMnemonicToKeyPair,
  tonMnemonicToKeyPairFn,
  tonMnemonicToRevealableSeed,
  tonRevealEntropyToMnemonic,
  tonValidateMnemonic,
  tonValidateMnemonicFn,
};
