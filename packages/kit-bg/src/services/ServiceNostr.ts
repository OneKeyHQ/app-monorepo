import axios from 'axios';
import ExpiryMap from 'expiry-map';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  NOSTR_ADDRESS_INDEX,
  getEventHash,
  getNostrPath,
  validateEvent,
} from '@onekeyhq/engine/src/vaults/impl/nostr/helper/NostrSDK';
import type {
  INostrRelays,
  NostrEvent,
} from '@onekeyhq/engine/src/vaults/impl/nostr/helper/types';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import ServiceBase from './ServiceBase';

type IGetNostrParams = {
  walletId: string;
  networkId: string;
  accountId: string;
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

  private async getCurrentAccountIndex(
    activeAccountId: string,
    activeNetworkId: string,
  ) {
    const account = await this.backgroundApi.engine.getAccount(
      activeAccountId,
      activeNetworkId,
    );
    if (!account) {
      throw new Error('Invalid account');
    }
    const index = this.backgroundApi.serviceAllNetwork.getAccountIndex(
      account,
      account?.template ?? '',
    );
    if (index < 0 || Number.isNaN(index)) {
      throw new Error('Invalid account index');
    }
    return index;
  }

  @backgroundMethod()
  async getOrCreateNostrAccount({
    walletId,
    currentAccountId,
    currentNetworkId,
    password,
  }: {
    walletId: string;
    currentAccountId: string;
    currentNetworkId: string;
    password: string;
  }) {
    const accountIndex = await this.getCurrentAccountIndex(
      currentAccountId,
      currentNetworkId,
    );
    const networkId = OnekeyNetwork.nostr;
    try {
      const path = `${getNostrPath(accountIndex)}/${NOSTR_ADDRESS_INDEX}`;
      const accountId = `${walletId}--${path}`;
      const account = await this.backgroundApi.engine.getAccount(
        accountId,
        networkId,
      );
      return account;
    } catch (e) {
      try {
        const [account] = await this.backgroundApi.engine.addHdOrHwAccounts({
          password,
          walletId,
          networkId,
          indexes: [accountIndex],
        });
        return account;
      } catch (createError) {
        console.error(createError);
        throw new Error('Create nostr account failed');
      }
    }
  }

  @backgroundMethod()
  async getPublicKeyHex({
    walletId,
    networkId,
    accountId,
    password,
  }: IGetNostrParams): Promise<string> {
    const nostrAccount = await this.getOrCreateNostrAccount({
      walletId,
      currentAccountId: accountId,
      currentNetworkId: networkId,
      password,
    });
    if (!nostrAccount.pubKey) {
      throw new Error('Nostr: public key not found');
    }
    return nostrAccount.pubKey;
  }

  @backgroundMethod()
  async getPublicKeyEncodedByNip19({
    walletId,
    networkId,
    accountId,
    password,
  }: IGetNostrParams): Promise<string> {
    const nostrAccount = await this.getOrCreateNostrAccount({
      walletId,
      currentAccountId: accountId,
      currentNetworkId: networkId,
      password,
    });
    return nostrAccount.address;
  }

  @backgroundMethod()
  async signEvent({
    walletId,
    networkId,
    accountId,
    password,
    event,
  }: IGetNostrParams & { event: NostrEvent }) {
    try {
      if (!validateEvent(event)) {
        throw new Error('Invalid event');
      }
      const nostrAccount = await this.getOrCreateNostrAccount({
        walletId,
        currentAccountId: accountId,
        currentNetworkId: networkId,
        password,
      });
      if (!event.pubkey) {
        event.pubkey = nostrAccount.pubKey;
      }
      if (!event.id) {
        event.id = getEventHash(event);
      }
      const vault = await this.backgroundApi.engine.getVault({
        networkId: OnekeyNetwork.Nostr,
        accountId: nostrAccount.id,
      });
      const signedEvent = await vault.keyring.signTransaction(
        {
          encodedTx: { event },
          inputs: [],
          outputs: [],
          payload: {},
        },
        { password },
      );
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
    // TODO: vault encrypt
    if (!pubkey || !plaintext) {
      throw new Error('Invalid encrypt params');
    }
    const nostr = await this.getNostrInstance(walletId, password);
    const encrypted = await nostr.encrypt(pubkey, plaintext);
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
    // TODO: vault decrypt
    if (!pubkey || !ciphertext) {
      throw new Error('Invalid encrypt params');
    }
    const nostr = await this.getNostrInstance(walletId, password);
    const decrypted = await nostr.decrypt(pubkey, ciphertext);
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

  @backgroundMethod()
  async signSchnorr({
    walletId,
    password,
    sigHash,
  }: IGetNostrParams & { sigHash: string }) {
    // TODO: vault signSchnorr
    if (!sigHash) {
      throw new Error('Invalid sigHash');
    }
    const nostr = await this.getNostrInstance(walletId, password);
    const signedHash = await nostr.signSchnorr(sigHash);
    return {
      data: signedHash,
    };
  }

  @backgroundMethod()
  async getRelays() {
    const { data } = await axios.get<INostrRelays>(
      `${getFiatEndpoint()}/nostr/getRelays`,
    );
    return data;
  }
}
