import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decryptImportedCredential } from '@onekeyhq/core/src/secret';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringImported as KeyringImportedBtc } from '../btc/KeyringImported';

import type { IEncodedTxZcash, IZcashVaultTransparentApi } from './types';
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
    const plan = checkIsDefined(encodedTx.zcashTransparentPlan);
    await this.backgroundApi.simpleDb.zcash.reserveTransparentOutpoints({
      accountId: this.vault.accountId,
      ownerId: plan.ownerId,
      outpoints: request.selectedOutpoints,
      currentHeight: request.targetHeight,
      expiryHeight: request.expiryHeight,
    });
    let pendingSaved = false;
    try {
      const credentials = await this.baseGetCredentialsInfo({
        password: params.password,
      });
      const { privateKey: accountXprvHex } = await decryptImportedCredential({
        credential: checkIsDefined(credentials.imported),
        password: params.password,
        ...getPbkdf2KdfParamsForNonDbTx(),
      });
      const zcashSdk = (
        await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
      ).default;
      const result = await (
        await zcashSdk.getZcashApi()
      ).buildTransparentTxWithAccountXprv({
        ...request,
        accountXprvHex,
      });
      const expectedOutpoints = new Set(
        request.selectedOutpoints.map(
          (outpoint) => `${outpoint.txid}:${outpoint.vout}`,
        ),
      );
      if (
        result.feeZat !== encodedTx.fee ||
        result.expiryHeight !== request.expiryHeight ||
        result.spentOutpoints.length !== expectedOutpoints.size ||
        result.spentOutpoints.some(
          (outpoint) =>
            !expectedOutpoints.has(`${outpoint.txid}:${outpoint.vout}`),
        )
      ) {
        throw new OneKeyLocalError(
          'Zcash transparent signing result did not match the reviewed transaction',
        );
      }
      const signedEncodedTx: IEncodedTxZcash = {
        ...encodedTx,
        zcashTransparentBuild: result,
      };
      await this.backgroundApi.simpleDb.zcash.saveTransparentPendingTx({
        accountId: this.vault.accountId,
        tx: {
          ownerId: plan.ownerId,
          rawTx: result.rawTx,
          txid: result.txid,
          spentOutpoints: result.spentOutpoints,
          expiryHeight: result.expiryHeight,
          createdAt: Date.now(),
          broadcastState: 'unknown',
        },
      });
      pendingSaved = true;
      return {
        txid: result.txid,
        rawTx: result.rawTx,
        encodedTx: signedEncodedTx,
      };
    } catch (error) {
      if (!pendingSaved) {
        await this.backgroundApi.simpleDb.zcash.releaseTransparentReservation({
          accountId: this.vault.accountId,
          ownerId: plan.ownerId,
        });
      }
      throw error;
    }
  }
}
