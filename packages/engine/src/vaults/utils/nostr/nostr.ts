import * as crypto from 'crypto';

import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as secp256k1 from '@noble/secp256k1';
import { AES_CBC } from 'asmcrypto.js';
import { bech32 } from 'bech32';

import { batchGetPrivateKeys } from '../../../secret';
import { decrypt } from '../../../secret/encryptors/aes256';
import { CredentialType } from '../../../types/credential';
import { getBitcoinBip32 } from '../btcForkChain/utils';

import type {
  DBAPI,
  ExportedPrivateKeyCredential,
  ExportedSeedCredential,
} from '../../../dbs/base';
import type { NostrEvent } from './types';

export const NOSTR_DERIVATION_PATH = "m/44'/1237'/0'/0"; // NIP-06
export const NOSTR_ADDRESS_INDEX = '0';

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

export function getEventHash(event: NostrEvent): string {
  return bytesToHex(sha256(serializeEvent(event)));
}

export function signEvent(event: NostrEvent, key: string) {
  const signedEvent = schnorr.sign(getEventHash(event), key);
  return bytesToHex(signedEvent);
}

export function getNostrCredentialId(walletId: string) {
  return `${walletId}--nostr`;
}

class Nostr {
  dbApi: DBAPI;

  private walletId: string;

  private password: string;

  constructor(walletId: string, password: string, dbApi: DBAPI) {
    this.walletId = walletId;
    this.password = password;
    this.dbApi = dbApi;
  }

  private getCredentialId() {
    return getNostrCredentialId(this.walletId);
  }

  private async getOrCreateCredential(): Promise<
    ExportedPrivateKeyCredential['privateKey']
  > {
    try {
      // try to find credential from database
      const credential = (await this.dbApi.getCredential(
        this.getCredentialId(),
        this.password,
      )) as ExportedPrivateKeyCredential;
      return credential.privateKey;
    } catch (e) {
      // cannot find credential, will create credential by path derivation
      const { seed } = (await this.dbApi.getCredential(
        this.walletId,
        this.password,
      )) as ExportedSeedCredential;
      const keys = batchGetPrivateKeys(
        'secp256k1',
        seed,
        this.password,
        NOSTR_DERIVATION_PATH,
        [NOSTR_ADDRESS_INDEX],
      );
      if (keys.length !== 1) {
        throw new Error('Nostr: private key not found');
      }
      if (keys[0].path !== `${NOSTR_DERIVATION_PATH}/${NOSTR_ADDRESS_INDEX}`) {
        throw new Error('Nostr: wrong derivation path');
      }
      const encryptedPrivateKey = keys[0].extendedKey.key;
      // save to database
      await this.dbApi.createPrivateKeyCredential({
        type: CredentialType.PRIVATE_KEY,
        id: this.getCredentialId(),
        password: this.password,
        privateKey: encryptedPrivateKey,
      });

      return encryptedPrivateKey;
    }
  }

  async getBip32Node() {
    const encryptedCredential = await this.getOrCreateCredential();
    const privateKey = decrypt(this.password, encryptedCredential);
    const node = getBitcoinBip32().fromPrivateKey(
      privateKey,
      Buffer.from(crypto.randomBytes(32).buffer),
    );
    return node;
  }

  async getPublicKey() {
    const node = await this.getBip32Node();
    return node.publicKey.slice(1, 33);
  }

  async getPublicKeyHex() {
    return bytesToHex(await this.getPublicKey());
  }

  async getPrivateKey() {
    const node = await this.getBip32Node();
    if (!node.privateKey) {
      throw new Error('Nostr: private key not found');
    }
    return node.privateKey;
  }

  async getPrivateKeyHex() {
    const privateKey = await this.getPrivateKey();
    return bytesToHex(privateKey);
  }

  getEventHash(event: NostrEvent) {
    return getEventHash(event);
  }

  async signEvent(event: NostrEvent): Promise<NostrEvent> {
    const privateKey = await this.getPrivateKey();
    const signature = signEvent(event, bytesToHex(privateKey));
    event.sig = signature;
    return Promise.resolve(event);
  }

  async encrypt(pubkey: string, plaintext: string): Promise<string> {
    const privateKey = await this.getPrivateKey();
    const key = secp256k1.getSharedSecret(
      bytesToHex(privateKey),
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

  async decrypt(pubkey: string, ciphertext: string) {
    const privateKey = await this.getPrivateKey();
    const key = secp256k1.getSharedSecret(
      bytesToHex(privateKey),
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

  async getPubkeyEncodedByNip19() {
    const pubkey = await this.getPublicKey();
    const words = bech32.toWords(pubkey);
    return bech32.encode('npub', words, 1000);
  }

  async getPrivateEncodedByNip19() {
    const privateKey = await this.getPrivateKey();
    const words = bech32.toWords(privateKey);
    return bech32.encode('nsec', words, 1000);
  }

  async signSchnorr(sigHash: string): Promise<string> {
    const privateKey = await this.getPrivateKey();
    const signature = schnorr.sign(
      Buffer.from(hexToBytes(sigHash)),
      privateKey,
    );
    const signedHex = bytesToHex(signature);
    return signedHex;
  }
}

export { Nostr };
