import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_ADA as COIN_TYPE } from '../../../constants';
import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';
import {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
} from '../../types';

import { encodePrivateKey, getPathIndex, getXprvString } from './helper/bip32';
import { getCardanoApi } from './helper/sdk';
import { batchGetShelleyAddressByRootKey } from './helper/shelley-address';
import { IAdaUTXO, IEncodedTxADA, NetworkId } from './types';

export class KeyringImported extends KeyringImportedBase {
  override async getPrivateKeys(
    password: string,
    relPaths?: Array<string>,
  ): Promise<Record<string, Buffer>> {
    if (typeof relPaths !== 'undefined') {
      throw new NotImplemented(
        'Getting private keys from extended private key',
      );
    }

    const dbAccount = await this.getDbAccount();
    const { privateKey } = (await this.engine.dbApi.getCredential(
      this.accountId,
      password,
    )) as ExportedPrivateKeyCredential;
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get credential.');
    }

    return { [dbAccount.path]: privateKey };
  }

  override async getSigners(
    password: string,
    addresses: string[],
  ): Promise<Record<string, Signer>> {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'ed25519'),
    };
  }

  override prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { privateKey, name } = params;

    const encodeKey = encodePrivateKey(privateKey);

    const index = parseInt(encodeKey.index);
    const addressInfos = batchGetShelleyAddressByRootKey(
      encodeKey.rootKey,
      [index],
      NetworkId.MAINNET,
    );

    const { baseAddress, stakingAddress } = addressInfos[0];
    const { address, path, xpub } = baseAddress;

    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${xpub}`,
        name: name || '',
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub,
        address,
        addresses: {
          [firstAddressRelPath]: address,
          [stakingAddressPath]: stakingAddress.address,
        },
      },
    ]);
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    debugLogger.sendTx.info('signTransaction result', unsignedTx);
    const encodedTx = unsignedTx.payload.encodedTx as unknown as IEncodedTxADA;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    // const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
    //   options.password ?? '',
    // );

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];
    const privateKey = await signer.getPrvkey();

    const encodeKey = encodePrivateKey(privateKey);

    const xprv = await getXprvString(encodeKey.rootKey);
    const accountIndex = getPathIndex(dbAccount.path);
    const CardanoApi = await getCardanoApi();
    const { signedTx, txid } = await CardanoApi.signTransaction(
      encodedTx.tx.body,
      dbAccount.address,
      Number(accountIndex),
      encodedTx.inputs as unknown as IAdaUTXO[],
      xprv,
      false,
    );

    return {
      rawTx: signedTx,
      txid,
    };
  }
}
