/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { BlockBook } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/blockbook';
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/btc/provider';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';
import bs58check from 'bs58check';

import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import {
  IApproveInfo,
  IEncodedTxAny,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../../types/vault';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { getAccountDefaultByPurpose } from './utils';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  simpleTransfer(
    payload: {
      to: string;
      value: string;
      tokenIdOnNetwork?: string;
      extra?: { [key: string]: any };
      gasPrice: string; // TODO remove gasPrice, gasLimit
      gasLimit: string;
    },
    options: ISignCredentialOptions,
  ): Promise<any> {
    throw new NotImplemented();
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<any> {
    throw new NotImplemented();
  }

  decodeTx(encodedTx: IEncodedTxAny, payload?: any): Promise<any> {
    throw new NotImplemented();
  }

  buildEncodedTxFromTransfer(transferInfo: ITransferInfo): Promise<any> {
    throw new NotImplemented();
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new NotImplemented();
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxAny,
    amount: string,
  ): Promise<IEncodedTxAny> {
    throw new NotImplemented();
  }

  updateEncodedTx(
    encodedTx: IEncodedTxAny,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxAny> {
    throw new NotImplemented();
  }

  buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxAny): Promise<UnsignedTx> {
    throw new NotImplemented();
  }

  fetchFeeInfo(encodedTx: IEncodedTxAny): Promise<IFeeInfo> {
    throw new NotImplemented();
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const { addressEncoding } = getAccountDefaultByPurpose(purpose);
      const provider = (await this.engine.providerManager.getProvider(
        this.networkId,
      )) as Provider;
      const { network } = provider;
      const { private: xprvVersionBytes } =
        (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

      const keyring = this.keyring as KeyringHd;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58check.encode(
        bs58check
          .decode(dbAccount.xpub)
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }
    if (dbAccount.id.startsWith('imported-')) {
      // Imported accounts, crendetial is already xprv
      const { privateKey } = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      if (typeof privateKey === 'undefined') {
        throw new OneKeyInternalError('Unable to get credential.');
      }
      return bs58check.encode(decrypt(password, privateKey));
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  // Chain only functionalities below.

  createClientFromURL(url: string): BlockBook {
    return new BlockBook(url);
  }
}
