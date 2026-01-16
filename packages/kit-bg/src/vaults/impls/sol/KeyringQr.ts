import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import { OffchainMessage } from '@onekeyhq/core/src/chains/sol/sdkSol/OffchainMessage';
import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import { verifySolSignedTxMatched } from '@onekeyhq/core/src/chains/sol/sdkSol/verify';
import {
  type IEncodedTxSol,
  type INativeTxSol,
} from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  AirGapUR,
  IAirGapGenerateSignRequestParamsSol,
  IAirGapSignatureSol,
} from '@onekeyhq/qr-wallet-sdk';
import { EAirGapDataTypeSol, getAirGapSdk } from '@onekeyhq/qr-wallet-sdk';
import {
  OneKeyErrorAirGapAccountNotFound,
  OneKeyErrorAirGapInvalidQrCode,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

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

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase = coreChainApi.sol.hd;

  override async normalizeGetMultiAccountsPath(
    params: INormalizeGetMultiAccountsPathParams,
  ): Promise<string> {
    const sdk = getAirGapSdk();
    return sdk.sol.normalizeGetMultiAccountsPath(params.path);
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
          const { fullPath, airGapAccount } =
            await this.findAirGapAccountInPrepareAccounts(params, {
              index,
              wallet,
            });

          if (!airGapAccount) {
            throw new OneKeyErrorAirGapAccountNotFound();
          }

          const publicKey = airGapAccount?.publicKey;

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
    // Solana uses hardened derivation, so no child path templates are needed
    return {
      childPathTemplates: [],
    };
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const { feePayer } = unsignedTx.payload as {
      nativeTx: INativeTxSol;
      feePayer: string;
    };

    const feePayerPublicKey = new PublicKey(feePayer);

    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;

    const transaction = parseToNativeTx(encodedTx);

    if (!transaction) {
      throw new OneKeyLocalError(
        appLocale.intl.formatMessage({
          id: ETranslations.feedback_failed_to_parse_transaction,
        }),
      );
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;

    const signData = isVersionedTransaction
      ? Buffer.from(transaction.message.serialize()).toString('hex')
      : transaction.serializeMessage().toString('hex');

    return this.baseSignByQrcode(params, {
      signRequestUrBuilder: async ({ path, account, requestId, xfp }) => {
        const signRequestUr = await this.generateSignRequest({
          requestId,
          path,
          signData,
          dataType: EAirGapDataTypeSol.Transaction,
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

        transaction.addSignature(
          feePayerPublicKey,
          Buffer.from(signatureHex, 'hex'),
        );

        const rawTx = Buffer.from(
          transaction.serialize({ requireAllSignatures: false }),
        ).toString('base64');

        const txid = bs58.encode(Buffer.from(signatureHex, 'hex'));

        await this.verifySignedTxMatched({
          from: feePayer,
          rawTx,
          txid,
          requestId,
          requestIdOfSig: signature.requestId,
        });

        return {
          txid,
          encodedTx,
          rawTx,
        };
      },
    });
  }

  override async verifySignedTxMatched({
    from,
    rawTx,
    txid,
    requestId,
    requestIdOfSig,
  }: {
    from: string;
    rawTx: string;
    txid: string;
    requestId: string | undefined;
    requestIdOfSig: string | undefined;
  }): Promise<void> {
    if (requestId && requestId !== requestIdOfSig) {
      console.error('Solana tx requestId not match');
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    return verifySolSignedTxMatched({
      signerAddress: from,
      rawTx,
      txid,
      encoding: 'base64',
    });
  }

  override async getVerifyAddressChainParams(
    _query: IQrWalletGetVerifyAddressChainParamsQuery,
  ): Promise<IQrWalletGetVerifyAddressChainParamsResult> {
    return {};
  }

  parseSignature(ur: AirGapUR): Promise<IAirGapSignatureSol> {
    const sdk = getAirGapSdk();
    try {
      const sig = sdk.sol.parseSignature(ur);
      return Promise.resolve(sig);
    } catch (error) {
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
  }

  generateSignRequest(
    params: IAirGapGenerateSignRequestParamsSol,
  ): Promise<AirGapUR> {
    if (!params.xfp) {
      throw new OneKeyLocalError('xfp not found');
    }
    const sdk = getAirGapSdk();
    const signRequestUr = sdk.sol.generateSignRequest({
      ...params,
      origin: params.origin ?? UR_DEFAULT_ORIGIN,
      // @ts-ignore
      dataType: params.dataType,
    });
    return Promise.resolve(signRequestUr);
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    return Promise.all(
      params.messages.map(
        async (payload: {
          type: string;
          message: string;
          applicationDomain?: string;
        }) => {
          let dataType = EAirGapDataTypeSol.Message;
          let signData = Buffer.from(payload.message).toString('hex');

          if (payload.type === EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE) {
            const format = OffchainMessage.guessMessageFormat(
              Buffer.from(payload.message),
            );

            if (payload.applicationDomain) {
              const account = await this.vault.getAccount();
              dataType = EAirGapDataTypeSol.Off_Chain_Message_Standard;
              signData = OffchainMessage.createStandardSolanaOffChainMessage({
                message: payload.message,
                applicationDomain: payload.applicationDomain,
                signerPublicKeys: [new PublicKey(account.address).toBytes()],
                format,
              });
            } else {
              dataType = EAirGapDataTypeSol.Off_Chain_Message_Legacy;
              signData = OffchainMessage.createLegacySolanaOffchainMessage(
                payload.message,
              );
            }
          }

          return this.baseSignByQrcode(params, {
            signRequestUrBuilder: async ({ path, account, requestId, xfp }) => {
              const signRequestUr = await this.generateSignRequest({
                requestId,
                signData,
                dataType,
                path,
                xfp,
                address: account.address,
              });
              return signRequestUr;
            },
            signedResultBuilder: async ({ signatureUr }) => {
              const signature = await this.parseSignature(
                checkIsDefined(signatureUr),
              );
              const signatureHex = signature.signature;
              return bs58.encode(Buffer.from(signatureHex, 'hex'));
            },
          });
        },
      ),
    );
  }
}
