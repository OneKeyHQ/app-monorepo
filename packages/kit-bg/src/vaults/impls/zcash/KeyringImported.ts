import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decryptImportedCredential } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringImported as KeyringImportedBtc } from '../btc/KeyringImported';

import { signTransparentTransaction } from './signTransparentTransaction';

import type { IEncodedTxZcash, IZcashVaultTransparentApi } from './types';
import type Vault from './Vault';
import type { ISignTransactionParams } from '../../types';

export class KeyringImported extends KeyringImportedBtc {
  override coreApi = coreChainApi.zec.imported;

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxZcash;
    if (encodedTx.zcashMode !== 'transparent') {
      throw new OneKeyLocalError(
        'Imported Zcash xprv accounts support transparent transactions only',
      );
    }
    const request = await (
      this.vault as unknown as IZcashVaultTransparentApi
    ).zcashPrepareFreshTransparentRequest({ encodedTx });
    return signTransparentTransaction({
      journal: this.backgroundApi.simpleDb.zcash,
      accountId: this.vault.accountId,
      encodedTx,
      request,
      sign: async () => {
        const credentials = await this.baseGetCredentialsInfo({
          password: params.password,
        });
        const { privateKey: accountXprvHex } = await decryptImportedCredential({
          credential: checkIsDefined(credentials.imported),
          password: params.password,
          ...getPbkdf2KdfParamsForNonDbTx(),
        });
        const api = await (this.vault as Vault).zcashGetApi();
        return api.buildTransparentTxWithAccountXprv({
          ...request,
          accountXprvHex,
        });
      },
    });
  }
}
