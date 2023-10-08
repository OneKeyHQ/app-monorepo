import { signEncodedTx } from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { slicePathTemplate } from '../../../../managers/derivation';
import { ChainSigner } from '../../../../proxy';
import { batchGetPublicKeys } from '../../../../secret';
import { AccountType } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type { DBUTXOAccount } from '../../../../types/account';
import type { IUnsignedMessageCommon } from '../../../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../../types';

const curve = 'secp256k1';
export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.nexa.hd;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys({
      ...params,
      relPaths: ['0/0'],
    });
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    return this.basePrepareAccountsHdUtxo(params, {
      addressEncoding: undefined,
      checkIsAccountUsed: async ({ address }) => ({
        isUsed: true,
      }),
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

  async getSignersOld(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('NEXA signers number should be 1.');
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
      [dbAccount.address]: new ChainSigner(privateKey, password, curve),
    };
  }

  async signTransactionOld(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const dbAccount = await this.getDbAccount();
    const signer = {} as ChainSigner;
    const result = await signEncodedTx(
      unsignedTx,
      signer,
      await this.vault.getDisplayAddress(dbAccount.address),
    );
    return result;
  }

  async prepareAccountsOld(
    params: IPrepareHdAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const accountNamePrefix = 'NEXA';

    const { password, indexes, names, template } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const pubkeyInfos = batchGetPublicKeys(
      curve,
      seed,
      password,
      pathPrefix,
      // When the first digit is 0, it represents a receiving account,
      // and when it is 0, it indicates a change account.
      indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
    );

    const idPaths = indexes.map((index) => `${pathPrefix}/${index}'`);

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    return pubkeyInfos.map((info, index) => {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const name =
        (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
      const pub = pubkey.toString('hex');
      return {
        id: `${this.walletId}--${idPaths[index]}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub: '',
        address: pub,
        addresses: { [this.networkId]: pub },
        template,
      };
    });
  }
}
