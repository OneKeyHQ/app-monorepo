/* eslint-disable @typescript-eslint/no-unused-vars */
import { TonWalletVersion } from '@onekeyfe/hd-transport';
import { Cell } from '@ton/core';

import {
  ETonSendMode,
  genAddressFromPublicKey,
} from '@onekeyhq/core/src/chains/ton/sdkTon';
import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignDataPayloadBinary,
  ISignDataPayloadCell,
  ISignDataPayloadText,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessageTon,
} from '@onekeyhq/core/src/types';
import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { createNormalizedWalletTransfer } from './sdkTon/BodyNormalizer';
import {
  decodeTonSigningMessage,
  getTonHardwareSigningMessageCandidates,
  preserveTonStateInitCells,
  resolveTonHardwareSigningMessage,
} from './sdkTon/signingMessageValidation';
import {
  getTonHardwareSdkOptions,
  getTonHardwareSdkTransaction,
  parseTonTransactionMessage,
  usesTonHardwareAppRepresentation,
} from './sdkTon/transactionParser';
import {
  createSignedExternalMessage,
  getAccountVersion,
  getWalletContractInstance,
  serializeUnsignedTransaction,
} from './sdkTon/utils';

import type { IWallet } from './sdkTon/utils';
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
  TonSignDataType,
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
                __hwExtraInfo__: undefined,
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');

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
          const { path, publicKey, __hwExtraInfo__ } = item;
          const addr = await genAddressFromPublicKey(
            publicKey,
            deriveInfo.addressEncoding as 'v4R2',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: addr.nonBounceAddress,
            addresses: {},
            path,
            publicKey: publicKey || '',
            __hwExtraInfo__,
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
    const sdk = await this.getHardwareSDKInstance({
      connectId: params.deviceParams?.dbDevice?.connectId || '',
    });
    const account = await this.vault.getAccount();
    const { unsignedTx, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const originalEncodedTx = unsignedTx.encodedTx as IEncodedTxTon;
    const encodedTx: IEncodedTxTon = {
      ...originalEncodedTx,
      validUntil:
        originalEncodedTx.validUntil ?? Math.floor(Date.now() / 1000) + 60,
      messages: originalEncodedTx.messages.map((message) => ({
        ...message,
        sendMode:
          message.sendMode ??
          ETonSendMode.PAY_GAS_SEPARATELY + ETonSendMode.IGNORE_ERRORS,
      })),
    };
    const parsedMessages = await Promise.all(
      encodedTx.messages.map((message) =>
        parseTonTransactionMessage({
          message,
          from: encodedTx.from,
          backgroundApi: this.vault.backgroundApi,
          networkId: this.vault.networkId,
        }),
      ),
    );
    const version = getAccountVersion(account.id);
    const contract = getWalletContractInstance({
      version,
      publicKey: account.pub ?? '',
      backgroundApi: this.vault.backgroundApi,
      networkId: this.vault.networkId,
    }) as unknown as IWallet;

    const serializeUnsignedTx = await serializeUnsignedTransaction({
      contract,
      encodedTx,
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
    const parsed = parsedMessages[0];
    // Pro firmware rebuilds only the first message in its structured Jetton
    // branch. Keep batches on the raw path so every message is signed.
    if (
      encodedTx.messages.length === 1 &&
      !!msg.jetton?.amount &&
      parsed.jetton?.canUseHardwareTransfer
    ) {
      const jetton = parsed.jetton.metadata;
      hwParams.destination = jetton.toAddress;
      hwParams.jettonAmount = jetton.amount;
      hwParams.jettonMasterAddress = jetton.jettonMasterAddress;
      hwParams.jettonWalletAddress = jetton.jettonWalletAddress;
      if (jetton.fwdFee !== '0' || msg.jetton?.fwdFee) {
        hwParams.fwdFee = jetton.fwdFee;
      }
      hwParams.comment = parsed.payload.jetton?.comment;
      hwParams.isRawData = !hwParams.comment;
    } else if (msg.payload) {
      if (parsed.canUseHardwareComment) {
        hwParams.comment = parsed.payload.comment;
        hwParams.isRawData = false;
      } else {
        hwParams.comment = Buffer.from(msg.payload, 'base64').toString('hex');
        hwParams.isRawData = true;
      }
    }

    let useBlindSignature = usesTonHardwareAppRepresentation(encodedTx);

    if (encodedTx.messages.length > 1) {
      hwParams.extDestination = [];
      hwParams.extTonAmount = [];
      hwParams.extPayload = [];
      encodedTx.messages.slice(1).forEach((extMsg) => {
        hwParams.extDestination?.push(extMsg.address);
        hwParams.extTonAmount?.push(extMsg.amount.toString());

        let payloadHex: string | undefined;
        if (extMsg.payload) {
          let bytes: Buffer | undefined;
          try {
            bytes = Buffer.from(extMsg.payload, 'base64');
          } catch (e) {
            try {
              bytes = Buffer.from(extMsg.payload, 'hex');
            } catch (ee) {
              useBlindSignature = true;
            }
          }

          payloadHex = bytes?.toString('hex');
          // exists payload and exotic cell
          if (payloadHex && Cell.fromHex(payloadHex).isExotic) {
            useBlindSignature = true;
          }
        }
        hwParams.extPayload?.push(payloadHex ?? '');
      });
    }

    const appSigningMessage = serializeUnsignedTx.signingMessage;
    try {
      if (msg.stateInit) {
        hwParams.initState = Buffer.from(msg.stateInit, 'base64').toString(
          'hex',
        );
        useBlindSignature = true;
      } else if (hwParams.comment && Cell.fromHex(hwParams.comment).isExotic) {
        useBlindSignature = true;
      }
    } catch {
      // ignore
    }

    const sdkOptions = await getTonHardwareSdkOptions(dbDevice);
    const sdkEncodedTx = getTonHardwareSdkTransaction(encodedTx, sdkOptions);
    let sdkSigningMessage: Cell | undefined;
    try {
      const sdkSerialization = await serializeUnsignedTransaction({
        contract,
        encodedTx: sdkEncodedTx,
        sendMode: msg.sendMode,
        timeout: encodedTx.validUntil,
        fullStateInit: true,
      });
      sdkSigningMessage = preserveTonStateInitCells(
        sdkSerialization.signingMessage,
        sdkEncodedTx.messages,
      );
    } catch (error) {
      // A complete SDK StateInit must not disable the existing App fallback.
      if (!useBlindSignature) {
        throw error;
      }
    }
    const expectedSigningMessage = useBlindSignature
      ? appSigningMessage
      : checkIsDefined(sdkSigningMessage);
    // Some firmware rebuilds the SDK request while other firmware signs the
    // App representation. Both paths are frozen before prompting the device.
    const alternateExpected = useBlindSignature ? sdkSigningMessage : undefined;

    // Blind signature
    if (useBlindSignature) {
      hwParams.signingMessageRepr = bufferUtils.bytesToHex(
        // await TonWeb.boc.Cell.oneFromBoc(Buffer.from(signingMessage.toBoc())).getRepr(),
        // only for hardware, only serialize for stateInit
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        Buffer.from(expectedSigningMessage.repr()).toString('hex'),
      );
    }

    // Prepare compatibility candidates before prompting the device so expiry
    // and nonce stay frozen even when confirmation takes several seconds.
    const candidates = alternateExpected
      ? [expectedSigningMessage, alternateExpected]
      : [expectedSigningMessage];
    if (!useBlindSignature) {
      candidates.push(
        ...getTonHardwareSigningMessageCandidates(
          expectedSigningMessage,
          parsedMessages.map(
            (message, index) =>
              index === 0 &&
              hwParams.jettonAmount !== undefined &&
              !!message.jetton?.canUseHardwareTransfer,
          ),
        ),
      );
      candidates.push(
        (
          await createNormalizedWalletTransfer(contract, sdkEncodedTx, {
            walletId: expectedSigningMessage.beginParse().loadUint(32),
          })
        ).signingMessage,
      );
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
    const signingMessage = resolveTonHardwareSigningMessage({
      expected: expectedSigningMessage,
      alternateExpected,
      candidates,
      returnedMessage: result.signing_message,
      signature,
      publicKey: bufferUtils.hexToBytes(account.pub ?? ''),
    });

    const signedEncodedTx = {
      ...encodedTx,
      ...decodeTonSigningMessage({ signingMessage, from: encodedTx.from }),
    };
    const externalMessage = await createSignedExternalMessage({
      contract,
      encodedTx: signedEncodedTx,
      signature: Buffer.from(signature).toString('hex'),
      signingMessage,
    });

    return {
      txid: '',
      rawTx: Buffer.from(
        externalMessage.message.toBoc({ idx: false }),
      ).toString('base64'),
      encodedTx: signedEncodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const sdk = await this.getHardwareSDKInstance({
      connectId: params.deviceParams?.dbDevice?.connectId || '',
    });
    const account = await this.vault.getAccount();
    const { messages, deviceParams } = params;
    if (messages.length !== 1) {
      throw new OneKeyInternalError('Unsupported message count');
    }
    const msg = messages[0] as IUnsignedMessageTon;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);

    // TON Connect v2 signData (text / binary / cell)
    if (msg.payload.payload) {
      const { TonSignDataType: TonSignDataTypeEnum } = await CoreSDKLoader();
      const signDataPayload = msg.payload.payload;

      let type: TonSignDataType;
      let payloadHex: string;
      let schema: string | undefined;
      switch (signDataPayload.type) {
        case 'text':
          type = TonSignDataTypeEnum.TEXT;
          payloadHex = Buffer.from(signDataPayload.text, 'utf-8').toString(
            'hex',
          );
          break;
        case 'binary':
          type = TonSignDataTypeEnum.BINARY;
          payloadHex = Buffer.from(signDataPayload.bytes, 'base64').toString(
            'hex',
          );
          break;
        case 'cell':
          type = TonSignDataTypeEnum.CELL;
          payloadHex = Buffer.from(signDataPayload.cell, 'base64').toString(
            'hex',
          );
          schema = signDataPayload.schema;
          break;
        default:
          throw new OneKeyInternalError(
            'Unsupported TON signData payload type',
          );
      }

      const result = await convertDeviceResponse(async () =>
        sdk.tonSignData(dbDevice.connectId, dbDevice.deviceId, {
          ...deviceCommonParams,
          path: account.path,
          type,
          payload: payloadHex,
          schema,
          // oxlint-disable-next-line @cspell/spellchecker
          appdomain: msg.payload.appDomain ?? '',
          timestamp: msg.payload.timestamp,
          fromAddress: msg.payload.address,
        }),
      );
      if (!result.signature) {
        throw new OneKeyInternalError('Failed to sign data');
      }
      return [result.signature];
    }

    // TON Connect proof
    if (msg.payload.isProof) {
      const result = await convertDeviceResponse(async () => {
        const res = await sdk.tonSignProof(
          dbDevice.connectId,
          dbDevice.deviceId,
          {
            ...deviceCommonParams,
            path: account.path,

            // oxlint-disable-next-line @cspell/spellchecker
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

    throw new OneKeyInternalError('Unsupported message type');
  }
}
