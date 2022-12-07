import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_ADA as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

import { getPathIndex, getXprvString } from './helper/bip32';
import { CardanoApi } from './helper/sdk';
import { batchGetShelleyAddresses } from './helper/shelley-address';
import { IAdaUTXO, IEncodedTxADA, NetworkId } from './types';

import type Vault from './Vault';

export class KeyringHd extends KeyringHdBase {
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

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { password, indexes, names } = params;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const addressInfos = await batchGetShelleyAddresses(
      entropy,
      password,
      indexes,
      NetworkId.MAINNET,
    );

    if (addressInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get address');
    }

    const client = await (this.vault as Vault).getClient();

    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';
    const ret = [];
    let index = 0;
    for (const info of addressInfos) {
      const { baseAddress, stakingAddress } = info;
      const { address, path, xpub } = baseAddress;
      const name = (names || [])[index] || `ADA #${indexes[index] + 1}`;
      const accountPath = path.slice(0, -4);
      ret.push({
        id: `${this.walletId}--${accountPath}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub,
        address,
        addresses: {
          [firstAddressRelPath]: address,
          [stakingAddressPath]: stakingAddress.address,
        },
      });

      const { tx_count: txCount } = await client.getAddressDetails(address);
      if (txCount > 0) {
        index += 1;
        // api rate limit
        await new Promise((r) => setTimeout(r, 200));
      } else {
        break;
      }
    }

    return ret;
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    debugLogger.sendTx.info('signTransaction result', unsignedTx);
    const encodedTx = unsignedTx.payload.encodedTx as unknown as IEncodedTxADA;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { password = '' } = options;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const xprv = await getXprvString(password, entropy);
    const accountIndex = getPathIndex(dbAccount.path);
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
