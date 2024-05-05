import * as crypto from 'crypto';

import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as secp256k1 from '@noble/secp256k1';
import { AES_CBC } from 'asmcrypto.js';
import { bech32 } from 'bech32';

import type { INostrEvent } from '../types';

export function validateEvent(event: INostrEvent): boolean {
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

export function serializeEvent(event: INostrEvent): string {
  if (!validateEvent(event))
    throw new Error("can't serialize event with wrong or missing properties");

  // https://github.com/nostr-protocol/nips/blob/master/01.md
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function getEventHash(event: INostrEvent): string {
  return bytesToHex(sha256(serializeEvent(event)));
}

export function signEvent(event: INostrEvent, key: string) {
  const signedEvent = schnorr.sign(getEventHash(event), key);
  return bytesToHex(signedEvent);
}

export function getNip19EncodedPubkey(pubkey: string) {
  const words = bech32.toWords(Buffer.from(pubkey, 'hex'));
  return bech32.encode('npub', words, 1000);
}

export function encrypt(
  privateKey: string,
  pubkey: string,
  plaintext: string,
): string {
  const key = secp256k1.getSharedSecret(privateKey, `02${pubkey}`);
  const normalizedKey = key.slice(1, 33);
  const iv = crypto.randomBytes(16);

  const encrypted = AES_CBC.encrypt(
    Buffer.from(plaintext),
    normalizedKey,
    true,
    iv,
  );

  return `${Buffer.from(encrypted).toString('base64')}?iv=${Buffer.from(
    iv.buffer,
  ).toString('base64')}`;
}

export function decrypt(
  privateKey: string,
  pubkey: string,
  ciphertext: string,
) {
  const key = secp256k1.getSharedSecret(privateKey, `02${pubkey}`);
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

export function signSchnorr(privateKey: string, sigHash: string): string {
  const signature = schnorr.sign(Buffer.from(hexToBytes(sigHash)), privateKey);
  const signedHex = bytesToHex(signature);
  return signedHex;
}

// class Nostr {
//   private accountIndex: number;

//   private node: BIP32Interface;

//   constructor(
//     accountIndex: number,
//     password: string,
//     hdCredential: ICoreHdCredentialEncryptHex,
//   ) {
//     this.accountIndex = accountIndex;
//     this.password = password;
//     this.node = this.getBip32Node(hdCredential);
//   }

//   getBip32Node(hdCredential: ICoreHdCredentialEncryptHex) {
//     const path = getNostrPath(this.accountIndex);
//     const mnemonic = mnemonicFromEntropy(hdCredential, this.password);
//     const keys = batchGetPrivateKeys('secp256k1', seed, this.password, path, [
//       NOSTR_ADDRESS_INDEX,
//     ]);
//     if (keys.length !== 1) {
//       throw new Error('Nostr: private key not found');
//     }
//     if (keys[0].path !== `${path}/${NOSTR_ADDRESS_INDEX}`) {
//       throw new Error('Nostr: wrong derivation path');
//     }
//     const privateKey = decrypt(this.password, keys[0].extendedKey.key);
//     const node = getBitcoinBip32().fromPrivateKey(
//       privateKey,
//       Buffer.from(crypto.randomBytes(32).buffer),
//     );
//     return node;
//   }

//   getPublicKey() {
//     return this.node.publicKey.slice(1, 33);
//   }

//   getPublicKeyHex() {
//     return bytesToHex(this.getPublicKey());
//   }

//   getPrivateKey() {
//     if (!this.node.privateKey) {
//       throw new Error('Nostr: private key not found');
//     }
//     return this.node.privateKey;
//   }

//   getPrivateKeyHex() {
//     const privateKey = this.getPrivateKey();
//     return bytesToHex(privateKey);
//   }

//   getEventHash(event: NostrEvent) {
//     return getEventHash(event);
//   }

//   async signEvent(event: NostrEvent): Promise<NostrEvent> {
//     const privateKey = this.getPrivateKey();
//     const signature = signEvent(event, bytesToHex(privateKey));
//     event.sig = signature;
//     return Promise.resolve(event);
//   }

//   encrypt(pubkey: string, plaintext: string): string {
//     const privateKey = this.getPrivateKey();
//     const key = secp256k1.getSharedSecret(
//       bytesToHex(privateKey),
//       `02${pubkey}`,
//     );
//     const normalizedKey = key.slice(1, 33);
//     const iv = crypto.randomBytes(16);

//     const encrypted = AES_CBC.encrypt(
//       Buffer.from(plaintext),
//       normalizedKey,
//       true,
//       iv,
//     );

//     return `${Buffer.from(encrypted).toString('base64')}?iv=${Buffer.from(
//       iv.buffer,
//     ).toString('base64')}`;
//   }

//   decrypt(pubkey: string, ciphertext: string) {
//     const privateKey = this.getPrivateKey();
//     const key = secp256k1.getSharedSecret(
//       bytesToHex(privateKey),
//       `02${pubkey}`,
//     );
//     const [cip, iv] = ciphertext.split('?iv=');
//     const normalizedKey = key.slice(1, 33);
//     const decrypted = AES_CBC.decrypt(
//       Buffer.from(cip, 'base64'),
//       normalizedKey,
//       true,
//       Buffer.from(iv, 'base64'),
//     );
//     return Buffer.from(decrypted).toString('utf-8');
//   }

//   getPubkeyEncodedByNip19() {
//     const pubkey = this.getPublicKey();
//     const words = bech32.toWords(pubkey);
//     return bech32.encode('npub', words, 1000);
//   }

//   getPrivateEncodedByNip19() {
//     const privateKey = this.getPrivateKey();
//     const words = bech32.toWords(privateKey);
//     return bech32.encode('nsec', words, 1000);
//   }

//   signSchnorr(sigHash: string): string {
//     const privateKey = this.getPrivateKey();
//     const signature = schnorr.sign(
//       Buffer.from(hexToBytes(sigHash)),
//       privateKey,
//     );
//     const signedHex = bytesToHex(signature);
//     return signedHex;
//   }
// }

// export { Nostr };
