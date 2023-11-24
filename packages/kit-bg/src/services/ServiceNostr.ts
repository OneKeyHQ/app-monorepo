import ExpiryMap from 'expiry-map';

import type { ExportedSeedCredential } from '@onekeyhq/engine/src/dbs/base';
import type { NostrEvent } from '@onekeyhq/engine/src/vaults/utils/nostr/nostr';
import {
  Nostr,
  validateEvent,
} from '@onekeyhq/engine/src/vaults/utils/nostr/nostr';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

type IGetNostrParams = {
  walletId: string;
  password: string;
};

type IPersistEncryptData = {
  pubkey: string;
  plaintext: string;
  encryptedData: string;
};

@backgroundClass()
export default class ServiceNostr extends ServiceBase {
  expiryMap = new ExpiryMap<string, IPersistEncryptData>(
    getTimeDurationMs({
      minute: 5,
    }),
  );

  @backgroundMethod()
  async getNostrInstance(walletId: string, password: string): Promise<Nostr> {
    const { entropy } = (await this.backgroundApi.engine.dbApi.getCredential(
      walletId,
      password,
    )) as ExportedSeedCredential;
    const nostr = new Nostr(entropy, password);
    return nostr;
  }

  @backgroundMethod()
  async getPublicKeyHex({
    walletId,
    password,
  }: IGetNostrParams): Promise<string> {
    const nostr = await this.getNostrInstance(walletId, password);
    return nostr.getPublicKeyHex();
  }

  @backgroundMethod()
  async getPublicKeyEncodedByNip19({
    walletId,
    password,
  }: IGetNostrParams): Promise<string> {
    const nostr = await this.getNostrInstance(walletId, password);
    return nostr.getPubkeyEncodedByNip19();
  }

  @backgroundMethod()
  async signEvent({
    walletId,
    password,
    event,
  }: IGetNostrParams & { event: NostrEvent }) {
    try {
      if (!validateEvent(event)) {
        throw new Error('Invalid event');
      }
      const nostr = await this.getNostrInstance(walletId, password);
      if (!event.pubkey) {
        event.pubkey = nostr.getPublicKeyHex();
      }
      if (!event.id) {
        event.id = nostr.getEventHash(event);
      }
      const signedEvent = await nostr.signEvent(event);
      return {
        data: signedEvent,
      };
    } catch (e) {
      console.error(e);
    }
  }

  @backgroundMethod()
  async encrypt({
    walletId,
    password,
    pubkey,
    plaintext,
  }: IGetNostrParams & { pubkey: string; plaintext: string }) {
    if (!pubkey || !plaintext) {
      throw new Error('Invalid encrypt params');
    }
    const nostr = await this.getNostrInstance(walletId, password);
    const encrypted = nostr.encrypt(pubkey, plaintext);
    return {
      data: encrypted,
    };
  }

  @backgroundMethod()
  async decrypt({
    walletId,
    password,
    pubkey,
    ciphertext,
  }: IGetNostrParams & { pubkey: string; ciphertext: string }) {
    if (!pubkey || !ciphertext) {
      throw new Error('Invalid encrypt params');
    }
    const nostr = await this.getNostrInstance(walletId, password);
    const decrypted = nostr.decrypt(pubkey, ciphertext);
    return {
      data: decrypted,
    };
  }

  @backgroundMethod()
  async saveEncryptedData({
    pubkey,
    plaintext,
    encryptedData,
  }: IPersistEncryptData) {
    this.expiryMap.set(encryptedData, { pubkey, plaintext, encryptedData });
    return Promise.resolve();
  }

  @backgroundMethod()
  async getEncryptedData(encryptedData: string) {
    const data = this.expiryMap.get(encryptedData);
    if (!data) {
      return null;
    }
    return Promise.resolve(data);
  }
}
