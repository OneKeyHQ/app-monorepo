import { bytesToHex } from '@noble/hashes/utils';
import * as bip39 from 'bip39';

import { mnemonicFromEntropy } from '../../../secret';
import { getBitcoinBip32 } from '../btcForkChain/utils';

import type { BIP32Interface } from 'bip32';

const NOSTR_DERIVATION_PATH = "m/44'/1237'/0'/0/0"; // NIP-06

class Nostr {
  readonly mnemonic: string;

  private node: BIP32Interface;

  constructor(entropy: Buffer, password: string) {
    this.mnemonic = mnemonicFromEntropy(entropy, password);
    const seed = bip39.mnemonicToSeedSync(this.mnemonic);
    const root = getBitcoinBip32().fromSeed(seed);
    this.node = root.derivePath(NOSTR_DERIVATION_PATH);
  }

  getPublicKey() {
    return this.node.publicKey.slice(1, 33);
  }

  getPublicKeyHex() {
    return bytesToHex(this.getPublicKey());
  }
}

export { Nostr };
