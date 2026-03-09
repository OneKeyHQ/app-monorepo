import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { hexToBytes } from '@noble/hashes/utils';
import { PolyfillCryptoProvider, SIV } from 'miscreant';

import { decryptAsync } from '@onekeyhq/core/src/secret/encryptors/aes256';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

// Consensus seed from Secret Network mainnet genesis, used as HKDF salt.
// This value is hardcoded in secret.js as well — it never changes.
const MAINNET_CONSENSUS_SEED = hexToBytes(
  '000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d',
);

export class SecretNetworkEncryption {
  /**
   * Derive enigma seed from an encrypted private key.
   * Shared by KeyringHd and KeyringImported.
   */
  static async deriveEnigmaSeed(params: {
    encryptedPrivateKeyHex: string;
    password: string;
  }): Promise<Uint8Array> {
    const decryptedPrivateKey = await decryptAsync({
      password: params.password,
      data: bufferUtils.toBuffer(params.encryptedPrivateKeyHex, 'hex'),
    });
    return hkdf(
      sha256,
      new Uint8Array(decryptedPrivateKey),
      'secret-network-enigma',
      '',
      32,
    );
  }

  private privkey: Uint8Array;

  public pubkey: Uint8Array;

  private consensusIoPubKey?: Uint8Array;

  private fetchConsensusIoPubKeyFn: () => Promise<Uint8Array>;

  constructor(
    seed: Uint8Array,
    fetchConsensusIoPubKey: () => Promise<Uint8Array>,
  ) {
    if (seed.length !== 32) {
      throw new OneKeyLocalError('Seed must be 32 bytes');
    }
    this.privkey = seed;
    this.pubkey = x25519.getPublicKey(this.privkey);
    this.fetchConsensusIoPubKeyFn = fetchConsensusIoPubKey;
  }

  async getPubkey(): Promise<Uint8Array> {
    return this.pubkey;
  }

  async getTxEncryptionKey(nonce: Uint8Array): Promise<Uint8Array> {
    const consensusIoPubKey = await this.getConsensusIoPubKey();
    const sharedSecret = x25519.getSharedSecret(
      this.privkey,
      consensusIoPubKey,
    );
    const ikm = new Uint8Array(sharedSecret.length + nonce.length);
    ikm.set(sharedSecret, 0);
    ikm.set(nonce, sharedSecret.length);
    return hkdf(sha256, ikm, MAINNET_CONSENSUS_SEED, '', 32);
  }

  async encrypt(contractCodeHash: string, msg: object): Promise<Uint8Array> {
    const nonce = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const txEncryptionKey = await this.getTxEncryptionKey(nonce);

    const siv = await SIV.importKey(
      txEncryptionKey,
      'AES-SIV',
      new PolyfillCryptoProvider(),
    );
    const plaintext = new TextEncoder().encode(
      contractCodeHash + JSON.stringify(msg),
    );
    const ciphertext: Uint8Array = await siv.seal(plaintext, [
      new Uint8Array(),
    ]);

    // Output layout: nonce(32) || pubkey(32) || ciphertext
    const result = new Uint8Array(32 + 32 + ciphertext.length);
    result.set(nonce, 0);
    result.set(this.pubkey, 32);
    result.set(ciphertext, 64);
    return result;
  }

  async decrypt(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
  ): Promise<Uint8Array> {
    const txEncryptionKey = await this.getTxEncryptionKey(nonce);

    const siv = await SIV.importKey(
      txEncryptionKey,
      'AES-SIV',
      new PolyfillCryptoProvider(),
    );
    return siv.open(ciphertext, [new Uint8Array()]);
  }

  private async getConsensusIoPubKey(): Promise<Uint8Array> {
    if (this.consensusIoPubKey) {
      return this.consensusIoPubKey;
    }

    this.consensusIoPubKey = await this.fetchConsensusIoPubKeyFn();
    return this.consensusIoPubKey;
  }
}
