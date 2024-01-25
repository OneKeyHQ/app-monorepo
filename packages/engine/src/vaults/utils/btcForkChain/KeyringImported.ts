import { Psbt } from 'bitcoinjs-lib';
import bs58check from 'bs58check';

import type { ExtendedKey } from '@onekeyhq/engine/src/secret';
import type { Bip32KeyDeriver } from '@onekeyhq/engine/src/secret/bip32';
import { BaseBip32KeyDeriver } from '@onekeyhq/engine/src/secret/bip32';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { toPsbtNetwork } from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.utils';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { BtcMessageTypes } from '../../../types/message';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { getBip32FromBase58, getBitcoinECPair, initBitcoinEcc } from './utils';

import type { DBUTXOAccount } from '../../../types/account';
import type { IUnsignedMessageBtc } from '../../impl/btc/types';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';
import type BTCForkVault from './VaultBtcFork';

const deriver = new BaseBip32KeyDeriver(
  Buffer.from('Bitcoin seed'),
  secp256k1,
) as Bip32KeyDeriver;

export class KeyringImported extends KeyringImportedBase {
  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    initBitcoinEcc();
    const { password } = options;
    const { psbtHex, inputsToSign } = unsignedTx;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const signers = await this.getSigners(
      password,
      unsignedTx.inputs.map((input) => input.address),
    );
    debugLogger.engine.info('signTransaction', this.networkId, unsignedTx);

    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

    if (psbtHex && inputsToSign) {
      const { network } = provider;
      const psbt = Psbt.fromHex(psbtHex, { network });

      return provider.signPsbt({
        psbt,
        signers,
        inputsToSign,
      });
    }

    return provider.signTransaction(unsignedTx, signers);
  }

  override async getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    const relPathToAddress: Record<string, string> = {};
    const { utxos } = await (
      this.vault as unknown as BTCForkVault
    ).collectUTXOsInfo({ checkInscription: false });
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        const relPath = path.split('/').slice(-2).join('/');
        relPathToAddress[relPath] = address;
      }
    }

    const relPaths = Object.keys(relPathToAddress);
    if (relPaths.length === 0) {
      throw new OneKeyInternalError('No signers would be chosen.');
    }

    const ret: Record<string, Signer> = {};
    const cache: Record<string, ExtendedKey> = {};

    const [encryptedXprv] = Object.values(await this.getPrivateKeys(password));
    const xprv = decrypt(password, encryptedXprv);
    const startKey = { chainCode: xprv.slice(13, 45), key: xprv.slice(46, 78) };

    relPaths.forEach((relPath) => {
      const pathComponents = relPath.split('/');

      let currentPath = '';
      let parent = startKey;
      pathComponents.forEach((pathComponent) => {
        currentPath =
          currentPath.length > 0
            ? `${currentPath}/${pathComponent}`
            : pathComponent;
        if (typeof cache[currentPath] === 'undefined') {
          const index = pathComponent.endsWith("'")
            ? parseInt(pathComponent.slice(0, -1)) + 2 ** 31
            : parseInt(pathComponent);
          const thisPrivKey = deriver.CKDPriv(parent, index);
          cache[currentPath] = thisPrivKey;
        }
        parent = cache[currentPath];
      });

      const address = relPathToAddress[relPath];
      ret[address] = new Signer(
        encrypt(password, cache[relPath].key),
        password,
        'secp256k1',
      );
    });

    return ret;
  }

  async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    initBitcoinEcc();
    const { privateKey, name, template } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    let xpub = '';

    const { network } = provider;
    const xprvVersionBytesNum = parseInt(
      privateKey.slice(0, 4).toString('hex'),
      16,
    );
    for (const versionBytes of [
      ...Object.values(network.segwitVersionBytes || {}),
      network.bip32,
    ]) {
      if (versionBytes.private === xprvVersionBytesNum) {
        const publicKey = secp256k1.publicFromPrivate(privateKey.slice(46, 78));
        const pubVersionBytes = Buffer.from(
          versionBytes.public.toString(16).padStart(8, '0'),
          'hex',
        );
        try {
          xpub = bs58check.encode(
            privateKey.fill(pubVersionBytes, 0, 4).fill(publicKey, 45, 78),
          );
        } catch (e) {
          console.error(e);
        }
      }
    }
    if (xpub === '') {
      throw new OneKeyInternalError('Invalid private key.');
    }

    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = provider.xpubToAddresses(xpub, [
      firstAddressRelPath,
    ]);

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${xpub}`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        xpub,
        address,
        addresses: { [firstAddressRelPath]: address },
        template,
      },
    ]);
  }

  override async signMessage(
    messages: IUnsignedMessageBtc[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    initBitcoinEcc();
    debugLogger.common.info('BTCFork signMessage', messages);

    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    const { password = '' } = options;

    const account = await this.engine.getAccount(
      this.accountId,
      this.networkId,
    );

    const [encryptedXprv] = Object.values(await this.getPrivateKeys(password));
    const xprv = bs58check.encode(decrypt(password, encryptedXprv));

    const node = getBip32FromBase58({
      coinType: COIN_TYPE,
      key: xprv,
    }).derivePath('0/0');

    const keyPair = getBitcoinECPair().fromWIF(node.toWIF());

    const network = await this.getNetwork();
    const path = `${account.path}/0/0`;

    const result: Buffer[] = [];

    for (let i = 0, len = messages.length; i < len; i += 1) {
      const { message, type, sigOptions } = messages[i];

      if (type === BtcMessageTypes.BIP322_SIMPLE) {
        const signers = await this.getSigners(password, [account.address]);
        const signature = await provider.signBip322MessageSimple({
          account,
          message,
          signers,
          psbtNetwork: toPsbtNetwork(network),
        });
        result.push(signature);
      } else {
        const signature = provider.signMessage({
          password,
          entropy: Buffer.from([]),
          path,
          message,
          sigOptions,
          keyPair,
        });
        result.push(signature);
      }
    }

    return result.map((i) => i.toString('hex'));
  }
}
