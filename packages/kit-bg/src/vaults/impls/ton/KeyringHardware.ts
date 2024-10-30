/* eslint-disable @typescript-eslint/no-unused-vars */
import { TonWalletVersion } from '@onekeyfe/hd-transport';
import TonWeb from 'tonweb';

import {
  genAddressFromPublicKey,
  getStateInitFromEncodedTx,
  serializeSignedTx,
} from '@onekeyhq/core/src/chains/ton/sdkTon';
import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessageTon,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import {
  decodePayload,
  getAccountVersion,
  serializeUnsignedTransaction,
} from './sdkTon/utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type {
  AllNetworkAddressParams,
  CommonParams,
  TonSignMessageParams,
} from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.ton.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'ton';

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
    const { deriveInfo } = params;
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            pathSuffix,
            template,
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
                publicKey: account.payload?.publicKey || '',
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new Error('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();

            // const response = await sdk.tonGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${pathSuffix.replace(
            //       '{index}',
            //       `${index}`,
            //     )}`,
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //     walletVersion: TonWalletVersion.V4R2,
            //     isBounceable: false,
            //     isTestnetOnly: false,
            //   })),
            // });
            // return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, publicKey } = item;
          const addr = await genAddressFromPublicKey(
            publicKey,
            deriveInfo.addressEncoding as 'v4R2',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: addr.nonBounceAddress,
            addresses: {},
            path,
            publicKey: publicKey || '',
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
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    const { unsignedTx, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTon;
    const version = getAccountVersion(account.id);
    const serializeUnsignedTx = await serializeUnsignedTransaction({
      version,
      encodedTx,
      backgroundApi: this.vault.backgroundApi,
      networkId: this.vault.networkId,
    });
    const msg = encodedTx.messages[0];
    const versionMap = {
      v4R2: TonWalletVersion.V4R2,
    };
    const hwParams: CommonParams & TonSignMessageParams = {
      path: account.path,
      ...deviceCommonParams,
      destination: msg.address,
      tonAmount: msg.amount.toString(),
      seqno: encodedTx.sequenceNo || 0,
      expireAt: encodedTx.validUntil || 0,
      comment: msg.payload,
      isRawData: true,
      mode: msg.sendMode,
      walletVersion: versionMap[version as keyof typeof versionMap],
    };
    if (msg.jetton?.amount) {
      hwParams.destination = msg.jetton.toAddress;
      hwParams.jettonAmount = msg.jetton.amount;
      hwParams.jettonMasterAddress = msg.jetton.jettonMasterAddress;
      hwParams.jettonWalletAddress = msg.jetton.jettonWalletAddress;
      if (msg.jetton.fwdFee) {
        hwParams.fwdFee = msg.jetton.fwdFee;
      }
      hwParams.comment = undefined;
      if (msg.jetton.fwdPayload) {
        const decodedPayload = decodePayload(msg.jetton.fwdPayload);
        if (decodedPayload.comment) {
          hwParams.comment = decodedPayload.comment;
          hwParams.isRawData = false;
        }
      }
    } else if (msg.payload) {
      const decodedPayload = decodePayload(msg.payload);
      if (decodedPayload.comment) {
        hwParams.comment = decodedPayload.comment;
        hwParams.isRawData = false;
      } else {
        hwParams.comment = Buffer.from(msg.payload, 'base64').toString('hex');
        hwParams.isRawData = true;
      }
    }
    if (encodedTx.messages.length > 1) {
      hwParams.extDestination = [];
      hwParams.extTonAmount = [];
      hwParams.extPayload = [];
      encodedTx.messages.slice(1).forEach((extMsg) => {
        hwParams.extDestination?.push(extMsg.address);
        hwParams.extTonAmount?.push(extMsg.amount.toString());
        hwParams.extPayload?.push(extMsg.payload ?? '');
      });
    }
    const result = await convertDeviceResponse(async () => {
      const res = await sdk.tonSignMessage(
        dbDevice.connectId,
        dbDevice.deviceId,
        hwParams,
      );
      return res;
    });
    if (!result.signature) {
      throw new OneKeyInternalError('Failed to sign message');
    }
    const signature = bufferUtils.hexToBytes(result.signature);
    let signingMessage = serializeUnsignedTx.signingMessage;
    const signingMessageHexFromHw = result.signning_message as string;
    const signingMessageHex = Buffer.from(
      await signingMessage.toBoc(),
    ).toString('hex');
    const signingMessageHash = Buffer.from(
      await signingMessage.hash(),
    ).toString('hex');
    // For Pro, check the boc
    if (
      !result.skip_validate &&
      signingMessageHexFromHw !== signingMessageHex
    ) {
      console.warn(
        'signingMessage mismatch',
        signingMessageHexFromHw,
        signingMessageHex,
      );
      signingMessage = TonWeb.boc.Cell.oneFromBoc(signingMessageHexFromHw);
    }
    // For 1S, check the hash
    if (
      result.skip_validate &&
      signingMessageHexFromHw !== signingMessageHash
    ) {
      throw new Error(
        appLocale.intl.formatMessage({
          id: ETranslations.feedback_failed_to_sign_transaction,
        }),
      );
    }
    const signedTx = serializeSignedTx({
      fromAddress: encodedTx.from,
      signingMessage,
      signature,
      stateInit: getStateInitFromEncodedTx(encodedTx),
    });
    return {
      txid: '',
      rawTx: Buffer.from(await signedTx.toBoc(false)).toString('base64'),
      encodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    const { messages, deviceParams } = params;
    if (messages.length !== 1) {
      throw new OneKeyInternalError('Unsupported message count');
    }
    const msg = messages[0] as IUnsignedMessageTon;
    if (!msg.payload.isProof) {
      throw new OneKeyInternalError('Unsupported message type');
    }
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const result = await convertDeviceResponse(async () => {
      const res = await sdk.tonSignProof(
        dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...deviceCommonParams,
          path: account.path,
          // eslint-disable-next-line spellcheck/spell-checker
          appdomain: Buffer.from(msg.payload.appDomain ?? '').toString('hex'),
          expireAt: msg.payload.timestamp,
          comment: Buffer.from(msg.message).toString('hex'),
        },
      );
      return res;
    });
    if (!result.signature) {
      throw new OneKeyInternalError('Failed to sign message');
    }
    return [result.signature];
  }
}
