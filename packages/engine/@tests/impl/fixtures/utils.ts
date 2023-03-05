import * as bip39 from 'bip39';

import { revealableSeedFromMnemonic } from '../../../src/secret';

async function validateMnemonic(mnemonic: string): Promise<string> {
  const usedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  if (!bip39.validateMnemonic(usedMnemonic)) {
    throw new Error('InvalidMnemonic');
  }
  return Promise.resolve(usedMnemonic);
}

export async function mnemonicToCredential(mnemonic: string, password: string) {
  const usedMnemonic = await validateMnemonic(mnemonic);
  const rs = revealableSeedFromMnemonic(usedMnemonic, password);
  return {
    seed: rs.seed,
  };
}
