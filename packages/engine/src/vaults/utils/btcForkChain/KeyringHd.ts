import { Psbt } from 'bitcoinjs-lib';
import bs58check from 'bs58check';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import {
  COINTYPE_BCH,
  COINTYPE_DOGE,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { toPsbtNetwork } from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.utils';

import { OneKeyInternalError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { BtcMessageTypes } from '../../../types/message';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { getAccountDefaultByPurpose, initBitcoinEcc } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBUTXOAccount } from '../../../types/account';
import type { IUnsignedMessageBtc } from '../../impl/btc/types';
import type {
  IPrepareAccountByAddressIndexParams,
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';
import type { AddressEncodings, IEncodedTxBtc } from './types';
import type BTCForkVault from './VaultBtcFork';

export class KeyringHd extends KeyringHdBase {
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

    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { transferInfo } = unsignedTx.encodedTx as IEncodedTxBtc;
    const signers = await this.getSigners(
      password,
      [
        ...(inputsToSign || unsignedTx.inputs).map((input) => input.address),
        ...Object.values(dbAccount.addresses),
      ],
      transferInfo.useCustomAddressesBalance,
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
    addresses: Array<string>,
    useCustomAddressesBalance?: boolean,
  ): Promise<Record<string, Signer>> {
    const relPathToAddresses: Record<string, string> = {};
    let customAddressMap;
    if (useCustomAddressesBalance) {
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      customAddressMap = (
        this.vault as unknown as BTCForkVault
      ).getCustomAddressMap(dbAccount);
    }
    const { utxos } = await (
      this.vault as unknown as BTCForkVault
    ).collectUTXOsInfo({ checkInscription: false, customAddressMap });
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        relPathToAddresses[path] = address;
      }
    }

    const relPaths = Object.keys(relPathToAddresses).map((fullPath) =>
      fullPath.split('/').slice(-2).join('/'),
    );
    if (relPaths.length === 0) {
      throw new OneKeyInternalError('No signers would be chosen.');
    }
    const privateKeys = await this.getPrivateKeys(password, relPaths);
    const ret: Record<string, Signer> = {};
    for (const [path, privateKey] of Object.entries(privateKeys)) {
      let address = relPathToAddresses[path];

      // fix blockbook utxo path to match local account path
      if ((await this.getNetworkImpl()) === IMPL_TBTC) {
        if (!address) {
          const fixedPath = path.replace(`m/86'/0'/`, `m/86'/1'/`);
          address = relPathToAddresses[fixedPath];
        }
        if (!address) {
          const fixedPath = path.replace(`m/86'/1'/`, `m/86'/0'/`);
          address = relPathToAddresses[fixedPath];
        }
      }

      const signer = new Signer(privateKey, password, 'secp256k1');

      // TODO generate address from privateKey, and check if matched with utxo address
      const addressFromPrivateKey = address;
      if (addressFromPrivateKey !== address) {
        throw new Error('addressFromPrivateKey and utxoAddress not matched');
      }
      ret[address] = signer;
    }
    return ret;
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const {
      password,
      indexes,
      purpose,
      names,
      template,
      skipCheckAccountExist,
    } = params;
    initBitcoinEcc();
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

    const ret = await this.createAccount({
      password,
      indexes,
      purpose,
      names,
      template,
      addressIndex: 0,
      isChange: false,
      isCustomAddress: false,
      validator: skipCheckAccountExist
        ? undefined
        : async ({ xpub, addressEncoding }) => {
            const { txs } = (await provider.getAccount(
              { type: 'simple', xpub },
              addressEncoding,
            )) as { txs: number };
            return txs > 0;
          },
    });
    return ret;
  }

  private async createAccount({
    password,
    indexes,
    purpose,
    names,
    template,
    addressIndex,
    isChange,
    isCustomAddress,
    validator,
  }: {
    password: string;
    indexes: number[];
    purpose?: number;
    names?: string[];
    template: string;
    addressIndex: number;
    isChange: boolean;
    isCustomAddress: boolean;
    validator?: ({
      xpub,
      address,
      addressEncoding,
    }: {
      xpub: string;
      address: string;
      addressEncoding: AddressEncodings;
    }) => Promise<boolean>;
  }) {
    const impl = await this.getNetworkImpl();
    const vault = this.vault as unknown as BTCForkVault;
    const defaultPurpose = vault.getDefaultPurpose();
    const coinName = vault.getCoinName();
    const COIN_TYPE = vault.getCoinType();

    const usedPurpose = purpose || defaultPurpose;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { addressEncoding } = getAccountDefaultByPurpose(
      usedPurpose,
      coinName,
    );
    const { prefix: namePrefix } = getAccountNameInfoByTemplate(impl, template);
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const { network } = provider;
    const { pathPrefix } = slicePathTemplate(template);
    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      pathPrefix,
      usedIndexes.map((index) => `${index.toString()}'`),
    );
    if (pubkeyInfos.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const { public: xpubVersionBytes } =
      (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

    const ret = [];
    let index = 0;
    for (const { path, parentFingerPrint, extendedKey } of pubkeyInfos) {
      const xpub = bs58check.encode(
        Buffer.concat([
          Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
          Buffer.from([3]),
          parentFingerPrint,
          Buffer.from(
            (usedIndexes[index] + 2 ** 31).toString(16).padStart(8, '0'),
            'hex',
          ),
          extendedKey.chainCode,
          extendedKey.key,
        ]),
      );
      const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
      const { [addressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [addressRelPath],
        addressEncoding,
      );
      const customAddresses = isCustomAddress
        ? { [addressRelPath]: address }
        : undefined;
      const prefix = [COINTYPE_DOGE, COINTYPE_BCH].includes(COIN_TYPE)
        ? coinName
        : namePrefix;
      const name =
        (names || [])[index] || `${prefix} #${usedIndexes[index] + 1}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.UTXO,
          path,
          coinType: COIN_TYPE,
          xpub,
          address,
          addresses: { [addressRelPath]: address },
          customAddresses,
          template,
        });
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      if (validator) {
        if (await validator?.({ xpub, address, addressEncoding })) {
          index += 1;
          await new Promise((r) => setTimeout(r, 200));
        } else {
          // Software should prevent a creation of an account
          // if a previous account does not have a transaction history (meaning none of its addresses have been used before).
          // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
          break;
        }
      } else {
        index += 1;
      }
    }
    return ret;
  }

  override async prepareAccountByAddressIndex(
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBUTXOAccount[]> {
    const { password, template, accountIndex, addressIndex } = params;
    const purpose = parseInt(template.split('/')?.[1], 10);
    const ret = await this.createAccount({
      password,
      indexes: [accountIndex],
      purpose,
      template,
      addressIndex,
      isChange: false,
      isCustomAddress: true,
    });
    return ret;
  }

  override async signMessage(
    messages: IUnsignedMessageBtc[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    debugLogger.common.info('BTCFork signMessage', messages);
    const { password = '' } = options;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const account = await this.engine.getAccount(
      this.accountId,
      this.networkId,
    );

    const network = await this.getNetwork();
    const path = `${account.path}/0/0`;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();

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
          entropy,
          path,
          message,
          sigOptions,
        });
        result.push(signature);
      }
    }

    return result.map((i) => i.toString('hex'));
  }
}
