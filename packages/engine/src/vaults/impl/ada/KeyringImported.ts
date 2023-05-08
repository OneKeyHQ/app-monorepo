import { COINTYPE_ADA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { encodePrivateKey, getPathIndex, getXprvString } from './helper/bip32';
import sdk from './helper/sdk';
import { batchGetShelleyAddressByRootKey } from './helper/shelley-address';
import { NetworkId } from './types';

import type { ExportedPrivateKeyCredential } from '../../../dbs/base';
import type { DBUTXOAccount } from '../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IAdaUTXO, IEncodedTxADA } from './types';

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
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    debugLogger.sendTx.info('signTransaction result', unsignedTx);
    const encodedTx = unsignedTx.payload.encodedTx as unknown as IEncodedTxADA;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];
    const privateKey = await signer.getPrvkey();

    const encodeKey = encodePrivateKey(privateKey);

    const xprv = await getXprvString(encodeKey.rootKey);
    const accountIndex = getPathIndex(dbAccount.path);
    const CardanoApi = await sdk.getCardanoApi();
    const { signedTx, txid } = await CardanoApi.signTransaction(
      encodedTx.tx.body,
      dbAccount.address,
      Number(accountIndex),
      encodedTx.inputs as unknown as IAdaUTXO[],
      xprv,
      !!encodedTx.signOnly,
      false,
    );

    return {
      rawTx: signedTx,
      txid,
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    const signers = await this.getSigners(options.password || '', [
      dbAccount.address,
    ]);
    const signer = signers[dbAccount.address];
    const privateKey = await signer.getPrvkey();

    const encodeKey = encodePrivateKey(privateKey);

    const xprv = await getXprvString(encodeKey.rootKey);
    const accountIndex = getPathIndex(dbAccount.path);

    const CardanoApi = await sdk.getCardanoApi();
    const result = await Promise.all(
      messages.map(
        ({ payload }: { payload: { addr: string; payload: string } }) =>
          CardanoApi.dAppSignData(
            payload.addr,
            payload.payload,
            xprv,
            Number(accountIndex),
          ),
      ),
    );
    return result.map((ret) => JSON.stringify(ret));
  }
}
