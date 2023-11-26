import * as crypto from 'crypto';

import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as secp256k1 from '@noble/secp256k1';
import { AES_CBC } from 'asmcrypto.js';
import { bech32 } from 'bech32';
import * as bip39 from 'bip39';

import { mnemonicFromEntropy } from '../../../secret';
import { getBitcoinBip32 } from '../btcForkChain/utils';

import type { BIP32Interface } from 'bip32';

export type NostrEvent = {
  id?: string;
  kind: EventKind;
  pubkey?: string;
  content: string;
  tags: string[][];
  created_at: number;
  sig?: string;
};

export enum EventKind {
  Metadata = 0,
  Text = 1,
  RelayRec = 2,
  Contacts = 3,
  DM = 4,
  Deleted = 5,
}

export const SupportEventKinds = [
  0, 1, 2, 3, 4, 5, 7, 8, 40, 41, 42, 43, 44, 1984, 9734, 9735, 10002, 22242,
  24133, 30008, 30009, 30023, 30078,
];

const NOSTR_DERIVATION_PATH = "m/44'/1237'/0'/0/0"; // NIP-06

export function validateEvent(event: NostrEvent): boolean {
  if (!(event instanceof Object)) return false;
  if (typeof event.kind !== 'number') return false;
  if (typeof event.content !== 'string') return false;
  if (typeof event.created_at !== 'number') return false;
  // ignore pubkey checks because if the pubkey is not set we add it to the event. same for the ID.

  if (!Array.isArray(event.tags)) return false;
  for (let i = 0; i < event.tags.length; i += 1) {
    const tag = event.tags[i];
    if (!Array.isArray(tag)) return false;
    for (let j = 0; j < tag.length; j += 1) {
      if (typeof tag[j] === 'object') return false;
    }
  }

  return true;
}

export function serializeEvent(event: NostrEvent): string {
  if (!validateEvent(event))
    throw new Error("can't serialize event with wrong or missing properties");

  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function getEventHash(event: NostrEvent): string {
  return bytesToHex(sha256(serializeEvent(event)));
}

export function signEvent(event: NostrEvent, key: string) {
  const signedEvent = schnorr.sign(getEventHash(event), key);
  return bytesToHex(signedEvent);
}

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

  getPrivateKey() {
    if (!this.node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    return this.node.privateKey;
  }

  getPrivateKeyHex() {
    if (!this.node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    return bytesToHex(this.node.privateKey);
  }

  getEventHash(event: NostrEvent) {
    return getEventHash(event);
  }

  signEvent(event: NostrEvent): Promise<NostrEvent> {
    if (!this.node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    const signature = signEvent(event, bytesToHex(this.node.privateKey));
    event.sig = signature;
    return Promise.resolve(event);
  }

  encrypt(pubkey: string, plaintext: string): string {
    if (!this.node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    const key = secp256k1.getSharedSecret(
      bytesToHex(this.node.privateKey),
      `02${pubkey}`,
    );
    const normalizedKey = key.slice(1, 33);
    const iv = crypto.randomBytes(16);

    const encrypted = AES_CBC.encrypt(
      Buffer.from(plaintext),
      normalizedKey,
      true,
      iv,
    );

    return `${Buffer.from(encrypted).toString('base64')}?iv=${iv.toString(
      'base64',
    )}`;
  }

  decrypt(pubkey: string, ciphertext: string) {
    if (!this.node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    const key = secp256k1.getSharedSecret(
      bytesToHex(this.node.privateKey),
      `02${pubkey}`,
    );
    const [cip, iv] = ciphertext.split('?iv=');
    const normalizedKey = key.slice(1, 33);
    const decrypted = AES_CBC.decrypt(
      Buffer.from(cip, 'base64'),
      normalizedKey,
      true,
      Buffer.from(iv, 'base64'),
    );
    return Buffer.from(decrypted).toString('utf-8');
  }

  getPubkeyEncodedByNip19() {
    const words = bech32.toWords(this.getPublicKey());
    return bech32.encode('npub', words, 1000);
  }

  getPrivateEncodedByNip19() {
    const words = bech32.toWords(this.getPrivateKey());
    return bech32.encode('nsec', words, 1000);
  }

  signSchnorr(sigHash: string): string {
    if (!this.node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    const signature = schnorr.sign(
      Buffer.from(hexToBytes(sigHash)),
      this.node.privateKey,
    );
    const signedHex = bytesToHex(signature);
    return signedHex;
  }
}

export { Nostr };
