import HDKey from 'hdkey';

import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  AirGapUR,
  IAirGapGenerateSignRequestParamsTron,
  IAirGapSignatureTron,
} from '@onekeyhq/qr-wallet-sdk';
import { EAirGapDataTypeTron, getAirGapSdk } from '@onekeyhq/qr-wallet-sdk';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  NotImplemented,
  OneKeyErrorAirGapAccountNotFound,
  OneKeyErrorAirGapInvalidQrCode,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import localDb from '../../../dbs/local/localDb';
import { UR_DEFAULT_ORIGIN } from '../../../services/ServiceQrWallet/qrWalletConsts';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult,
  INormalizeGetMultiAccountsPathParams,
  IPrepareQrAccountsParams,
  IQrWalletGetVerifyAddressChainParamsQuery,
  IQrWalletGetVerifyAddressChainParamsResult,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

const { sha256: sha256Hash } = appCrypto.hash;

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase = coreChainApi.tron.hd;

  override async verifySignedTxMatched({
    signedTx,
    requestId,
    requestIdOfSig,
  }: {
    signedTx: ISignedTxPro;
    requestId: string | undefined;
    requestIdOfSig: string | undefined;
  }): Promise<void> {
    if (requestId && requestId !== requestIdOfSig) {
      console.error('Tron tx requestId not match');
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    const txidFromRawTx = (
      await sha256Hash(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        Buffer.from(JSON.parse(signedTx.rawTx).raw_data_hex, 'hex'),
      )
    ).toString('hex');

    if (txidFromRawTx !== signedTx.txid) {
      throw new OneKeyLocalError('tron txid not match');
    }
  }

  override signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxTron;

    const signData = encodedTx.raw_data_hex;

    return this.baseSignByQrcode(params, {
      signRequestUrBuilder: async ({ path, account, requestId, xfp }) => {
        const signRequestUr = await this.generateSignRequest({
          requestId,
          path,
          signData,
          signType: EAirGapDataTypeTron.Transaction,
          xfp,
          address: account.address,
        });
        return signRequestUr;
      },
      signedResultBuilder: async ({ signatureUr, requestId }) => {
        const signature = await this.parseSignature(
          checkIsDefined(signatureUr),
        );

        const signatureHex = signature.signature;

        const signedTx: ISignedTxPro = {
          encodedTx,
          txid: encodedTx.txID,
          rawTx: JSON.stringify({
            ...encodedTx,
            signature: [signatureHex],
          }),
        };

        await this.verifySignedTxMatched({
          signedTx,
          requestId,
          requestIdOfSig: signature.requestId,
        });

        return signedTx;
      },
    });
  }

  parseSignature(ur: AirGapUR): Promise<IAirGapSignatureTron> {
    const sdk = getAirGapSdk();
    try {
      const sig = sdk.tron.parseSignature(ur);
      return Promise.resolve(sig);
    } catch (error) {
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
  }

  generateSignRequest(
    params: IAirGapGenerateSignRequestParamsTron,
  ): Promise<AirGapUR> {
    if (!params.xfp) {
      throw new OneKeyLocalError('xfp not found');
    }
    const sdk = getAirGapSdk();
    const signRequestUr = sdk.tron.generateSignRequest({
      ...params,
      origin: params.origin ?? UR_DEFAULT_ORIGIN,
      // @ts-ignore
      signType: params.signType,
    });
    return Promise.resolve(signRequestUr);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented('Signing tron message is not supported yet.');
  }

  override async prepareAccounts(
    params: IPrepareQrAccountsParams,
  ): Promise<IDBAccount[]> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });
    const networkInfo = await this.getCoreApiNetworkInfo();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          if (params?.isVerifyAddressAction) {
            return this.verifyQrWalletAddressByTwoWayScan(params, {
              indexes: usedIndexes,
            });
          }
          const { fullPath, airGapAccount, childPathTemplate } =
            await this.findAirGapAccountInPrepareAccounts(params, {
              index,
              wallet,
            });

          if (!airGapAccount) {
            throw new OneKeyErrorAirGapAccountNotFound();
          }

          let publicKey = airGapAccount?.publicKey;

          if (childPathTemplate) {
            const xpub = airGapAccount?.extendedPublicKey;
            if (!xpub) {
              throw new OneKeyLocalError('xpub not found');
            }
            let hdk = HDKey.fromExtendedKey(xpub);
            const childPath = accountUtils.buildPathFromTemplate({
              template: childPathTemplate,
              index,
            });
            hdk = hdk.derive(`m/${childPath}`);
            publicKey = hdk.publicKey.toString('hex');
          }

          if (!publicKey) {
            throw new OneKeyLocalError('publicKey not found');
          }

          const addressInfo = await this.coreApi.getAddressFromPublic({
            publicKey,
            networkInfo,
          });
          if (!addressInfo) {
            throw new OneKeyLocalError('addressInfo not found');
          }
          const { normalizedAddress } = await this.vault.validateAddress(
            addressInfo.address,
          );
          addressInfo.address = normalizedAddress || addressInfo.address;
          addressInfo.path = fullPath;
          ret.push(addressInfo);
          console.log('KeyringQr prepareAccounts', {
            params,
            wallet,
            fullPath,
            airGapAccount,
            addressInfo,
          });
        }
        return ret;
      },
    });
  }

  override getChildPathTemplates(
    _params: IGetChildPathTemplatesParams,
  ): IGetChildPathTemplatesResult {
    return {
      childPathTemplates: ['0/*'],
    };
  }

  override async normalizeGetMultiAccountsPath(
    _params: INormalizeGetMultiAccountsPathParams,
  ): Promise<string> {
    const sdk = getAirGapSdk();
    return sdk.tron.normalizeGetMultiAccountsPath(_params.path);
  }

  override async getVerifyAddressChainParams(
    _query: IQrWalletGetVerifyAddressChainParamsQuery,
  ): Promise<IQrWalletGetVerifyAddressChainParamsResult> {
    return {};
  }
}
