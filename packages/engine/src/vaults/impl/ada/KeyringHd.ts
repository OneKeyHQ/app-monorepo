import {
  batchGetShelleyAddresses,
  getPathIndex,
  getXprvString,
  sdk,
} from '@onekeyhq/core/src/chains/ada/sdkAda';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { COINTYPE_ADA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { ChainSigner } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { NetworkId } from './types';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBUTXOAccount } from '../../../types/account';
import type { IUnsignedMessageCommon } from '../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IAdaUTXO, IEncodedTxADA } from './types';
import type Vault from './Vault';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.ada.hd;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    return this.basePrepareAccountsHdUtxo(params, {
      addressEncoding: undefined,
      checkIsAccountUsed: async ({ address }) => {
        const client = await (this.vault as Vault).getClient();
        const { tx_count: txCount } = await client.getAddressDetails(address);
        return {
          isUsed: txCount > 0,
        };
      },
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(
    messages: IUnsignedMessageCommon[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    // throw new Error('Method not implemented.');
    return this.baseSignMessage(messages, options);
  }

  async getSignersOld(
    password: string,
    addresses: string[],
  ): Promise<Record<string, ChainSigner>> {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Starcoin signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys({
      password,
    });
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new ChainSigner(privateKey, password, 'ed25519'),
    };
  }

  async prepareAccountsOld(
    params: IPrepareHdAccountsParams,
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

  async signTransactionOld(
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

  async signMessageOld(
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
