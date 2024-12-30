/* eslint-disable @typescript-eslint/no-unused-vars */
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import type {
  IEncodedTxSol,
  INativeTxSol,
} from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { parseToNativeTx } from './utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.sol.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'sol';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
    };
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            template,
            pathPrefix,
            pathSuffix,
            coinName,
            showOnOnekeyFn,
          }) => {
            const buildFullPath = (p: { index: number }) =>
              accountUtils.buildPathFromTemplate({
                template,
                index: p.index,
              });

            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: buildFullPath,
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // const response = await sdk.solGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${pathSuffix.replace(
            //       '{index}',
            //       `${index}`,
            //     )}`,

            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //     chainId: Number(chainId),
            //   })),
            // });

            // if (
            //   !response.success &&
            //   response.payload.code === HardwareErrorCode.RuntimeError &&
            //   response.payload.error.indexOf(
            //     'Failure_DataError,Forbidden key path',
            //   ) !== -1
            // ) {
            //   throw new UnsupportedAddressTypeError();
            // }

            // return response;
          },
        });

        console.log('sol-buildAddressesInfo', publicKeys);

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, address } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address || '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
            path,
            publicKey: '',
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const { feePayer } = unsignedTx.payload as {
      nativeTx: INativeTxSol;
      feePayer: string;
    };

    const feePayerPublicKey = new PublicKey(feePayer);

    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;

    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const transaction = await parseToNativeTx(encodedTx);

    if (!transaction) {
      throw new Error(
        appLocale.intl.formatMessage({
          id: ETranslations.feedback_failed_to_parse_transaction,
        }),
      );
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;

    const result = await convertDeviceResponse(async () =>
      sdk.solSignTransaction(connectId, deviceId, {
        path,
        rawTx: isVersionedTransaction
          ? Buffer.from(transaction.message.serialize()).toString('hex')
          : transaction.serializeMessage().toString('hex'),
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;
    if (signature) {
      transaction.addSignature(
        feePayerPublicKey,
        Buffer.from(signature, 'hex'),
      );

      return {
        txid: bs58.encode(Buffer.from(signature, 'hex')),
        encodedTx,
        rawTx: Buffer.from(
          transaction.serialize({ requireAllSignatures: false }),
        ).toString('base64'),
      };
    }

    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.feedback_failed_to_sign_transaction,
      }),
    );
  }

  guessMessageFormat(message: Buffer) {
    if (Object.prototype.toString.call(message) !== '[object Uint8Array]') {
      return undefined;
    }
    if (stringUtils.isPrintableASCII(message)) {
      return 0;
    }
    if (stringUtils.isUTF8(message)) {
      return 1;
    }
    return undefined;
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();

    const result = await Promise.all(
      params.messages.map(
        async (payload: { type: string; message: string }) => {
          const response = await HardwareSDK.solSignMessage(
            connectId,
            deviceId,
            {
              ...params.deviceParams?.deviceCommonParams,
              path: dbAccount.path,
              messageHex: Buffer.from(payload.message).toString('hex'),
              messageFormat: this.guessMessageFormat(
                Buffer.from(payload.message),
              ),
            },
          );

          if (!response.success) {
            throw convertDeviceError(response.payload);
          }
          return response.payload?.signature;
        },
      ),
    );
    return result.map((ret) => bs58.encode(Buffer.from(ret, 'hex')));
  }
}
