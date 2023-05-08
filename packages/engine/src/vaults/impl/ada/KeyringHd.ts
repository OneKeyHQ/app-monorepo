import { COINTYPE_ADA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { getPathIndex, getXprvString } from './helper/bip32';
import sdk from './helper/sdk';
import { batchGetShelleyAddresses } from './helper/shelley-address';
import { NetworkId } from './types';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBUTXOAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IAdaUTXO, IEncodedTxADA } from './types';
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
    const { password, indexes, names, skipCheckAccountExist } = params;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const addressInfos = await batchGetShelleyAddresses(
      entropy,
      password,
      usedIndexes,
      NetworkId.MAINNET,
    );

    if (addressInfos.length !== usedIndexes.length) {
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
      const name = (names || [])[index] || `CARDANO #${usedIndexes[index] + 1}`;
      const accountPath = path.slice(0, -4);
      if (!ignoreFirst || index > 0) {
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
      }

      if (usedIndexes.length === 1) {
        // Only getting the first account, ignore balance checking.
        break;
      }

      if (skipCheckAccountExist) {
        index += 1;
      } else {
        const { tx_count: txCount } = await client.getAddressDetails(address);
        if (txCount > 0) {
          index += 1;
          // api rate limit
          await new Promise((r) => setTimeout(r, 200));
        } else {
          break;
        }
      }
    }

    return ret;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
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

    // sign for dapp if signOnly
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
    const { password = '' } = options;
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;
    const xprv = await getXprvString(password, entropy);
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
