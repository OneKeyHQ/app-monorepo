import { TransactionTypes } from '@ethersproject/transactions';
import HDKey from 'hdkey';

import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import {
  buildSignedTxFromSignatureEvm,
  packUnsignedTxForSignEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import { verifyEvmSignedTxMatched } from '@onekeyhq/core/src/chains/evm/sdkEvm/verify';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessage,
  IUnsignedMessageEth,
} from '@onekeyhq/core/src/types';
import type { AirGapUR } from '@onekeyhq/qr-wallet-sdk';
import {
  EAirGapAccountNoteEvm,
  EAirGapDataTypeEvm,
  getAirGapSdk,
} from '@onekeyhq/qr-wallet-sdk';
import type {
  IAirGapGenerateSignRequestParamsEvm,
  IAirGapSignatureEvm,
} from '@onekeyhq/qr-wallet-sdk/src/types';
import {
  OneKeyErrorAirGapAccountNotFound,
  OneKeyErrorAirGapInvalidQrCode,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import localDb from '../../../dbs/local/localDb';
import { UR_DEFAULT_ORIGIN } from '../../../services/ServiceQrWallet/qrWalletConsts';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult,
  IPrepareQrAccountsParams,
  IQrWalletGetVerifyAddressChainParamsQuery,
  IQrWalletGetVerifyAddressChainParamsResult,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase = coreChainApi.evm.hd;

  override async verifySignedTxMatched({
    from,
    rawTx,
    txid,
    requestId,
    requestIdOfSig,
    signature,
  }: {
    from: string;
    rawTx: string;
    txid: string;
    requestId: string | undefined;
    requestIdOfSig: string | undefined;
    signature: {
      v: string | number;
      r: string;
      s: string;
    };
  }): Promise<void> {
    if (requestId && requestId !== requestIdOfSig) {
      // throw new Error('EVM tx requestId not match');
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
    return verifyEvmSignedTxMatched({
      signerAddress: from,
      rawTx,
      txid,
      signature,
    });
  }

  override getChildPathTemplates(
    params: IGetChildPathTemplatesParams,
  ): IGetChildPathTemplatesResult {
    const { airGapAccount, index } = params;
    // TODO get deriveType by path
    if (
      airGapAccount.note &&
      airGapAccount.note === EAirGapAccountNoteEvm.Standard
    ) {
      return {
        childPathTemplates: ['0/*'],
      };
    }
    return {
      childPathTemplates: [
        '0/*', // standard
        '0/0', // ledger live
      ],
    };
  }

  generateSignRequest(
    params: IAirGapGenerateSignRequestParamsEvm,
  ): Promise<AirGapUR> {
    if (!params.xfp) {
      throw new Error('xfp not found');
    }
    const sdk = getAirGapSdk();
    const signRequestUr = sdk.eth.generateSignRequest({
      ...params,
      origin: params.origin ?? UR_DEFAULT_ORIGIN,
    });
    return Promise.resolve(signRequestUr);
  }

  parseSignature(ur: AirGapUR): Promise<IAirGapSignatureEvm> {
    const sdk = getAirGapSdk();
    try {
      const sig = sdk.eth.parseSignature(ur);
      return Promise.resolve(sig);
    } catch (error) {
      // eslint-disable-next-line spellcheck/spell-checker
      // ERROR throw from node_modules/@keystonehq/keystone-sdk/dist/chains/ethereum.js
      //        throw new Error('type not match');
      throw new OneKeyErrorAirGapInvalidQrCode();
    }
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    const { messages } = params;

    return Promise.all(
      messages.map(async (message: IUnsignedMessage) => {
        const msg = message as IUnsignedMessageEth;
        let dataType: EAirGapDataTypeEvm | undefined;
        if (msg.type === EMessageTypesEth.PERSONAL_SIGN) {
          dataType = EAirGapDataTypeEvm.personalMessage;
        }
        if (
          [
            EMessageTypesEth.TYPED_DATA_V1,
            EMessageTypesEth.TYPED_DATA_V3,
            EMessageTypesEth.TYPED_DATA_V4,
          ].includes(msg.type)
        ) {
          dataType = EAirGapDataTypeEvm.typedData;
        }

        if (!dataType) {
          throw new Error(
            `Unsupported message type: ${dataType || 'undefined'}`,
          );
        }

        return this.baseSignByQrcode(params, {
          signRequestUrBuilder: async ({
            path,
            account,
            chainId,
            requestId,
            xfp,
          }) => {
            let signData = hexUtils.stripHexPrefix(msg.message);
            if (dataType === EAirGapDataTypeEvm.typedData) {
              signData = hexUtils.stripHexPrefix(
                bufferUtils.textToHex(msg.message, 'utf-8'),
              );
            }
            const signRequestUr = await this.generateSignRequest({
              requestId,
              signData,
              dataType: checkIsDefined(dataType),
              path,
              xfp,
              chainId: Number(chainId),
              address: account.address,
            });
            return signRequestUr;
          },
          signedResultBuilder: async ({ signatureUr }) => {
            const signature = await this.parseSignature(
              checkIsDefined(signatureUr),
            );
            const signatureHex = signature.signature;
            return hexUtils.addHexPrefix(signatureHex);
          },
        });
      }),
    );
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxEvm;
    const { tx, serializedTxWithout0x, digest } = packUnsignedTxForSignEvm({
      encodedTx,
    });
    let dataType = EAirGapDataTypeEvm.transaction;
    if (tx.type === TransactionTypes.eip1559) {
      dataType = EAirGapDataTypeEvm.typedTransaction;
    }

    return this.baseSignByQrcode(params, {
      signRequestUrBuilder: async ({
        path,
        account,
        chainId,
        requestId,
        xfp,
      }) => {
        const signRequestUr = await this.generateSignRequest({
          requestId,
          signData: serializedTxWithout0x,
          dataType,
          path,
          xfp,
          chainId: Number(chainId),
          address: account.address,
        });
        return signRequestUr;
      },
      signedResultBuilder: async ({ signatureUr, requestId }) => {
        const signature = await this.parseSignature(
          checkIsDefined(signatureUr),
        );
        const signatureHex = signature.signature;
        const origin = signature.origin || '';

        // const verifyMessageFn = verifyMessage;
        // // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const verifyResult = verifyMessageFn(
        //   hexUtils.stripHexPrefix(serializedTxWithout0x),
        //   hexUtils.addHexPrefix(signatureHex),
        // ); // verify signature

        const r = hexUtils.addHexPrefix(signatureHex.slice(0, 32 * 2));
        const s = hexUtils.addHexPrefix(signatureHex.slice(32 * 2, 64 * 2));

        // do not add prefix 0x for v if EIP1559 typedTransaction
        let v = signatureHex.slice(64 * 2);
        if (dataType === EAirGapDataTypeEvm.transaction) {
          v = `0x${v}`; // add 0x if legacy transaction
        }

        const { rawTx, txid } = buildSignedTxFromSignatureEvm({
          tx,
          signature: {
            r,
            s,
            v,
          },
        });

        await this.verifySignedTxMatched({
          requestId,
          requestIdOfSig: signature.requestId,
          rawTx,
          txid,
          signature: { r, s, v },
          from: encodedTx.from,
        });

        return Promise.resolve({
          txid,
          rawTx,
          encodedTx: params.unsignedTx.encodedTx,
        });
      },
    });
  }

  override async getVerifyAddressChainParams(
    query: IQrWalletGetVerifyAddressChainParamsQuery,
  ): Promise<IQrWalletGetVerifyAddressChainParamsResult> {
    const chainId = await this.getNetworkChainId();
    return {
      chainId,
    };
  }

  override async prepareAccounts(
    params: IPrepareQrAccountsParams,
  ): Promise<IDBAccount[]> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          // TODO move to base
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
              throw new Error('xpub not found');
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
            throw new Error('publicKey not found');
          }

          const networkInfo = await this.getCoreApiNetworkInfo();
          const addressInfo = await this.coreApi.getAddressFromPublic({
            publicKey,
            networkInfo,
          });
          if (!addressInfo) {
            throw new Error('addressInfo not found');
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
}
