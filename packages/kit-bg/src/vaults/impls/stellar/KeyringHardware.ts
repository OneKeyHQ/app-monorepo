import BigNumber from 'bignumber.js';

import type { IEncodedTxStellar } from '@onekeyhq/core/src/chains/stellar/types';
import { assembleSignedTransaction } from '@onekeyhq/core/src/chains/stellar/utils/signing';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import sdkStellar from './sdkStellar';
import { decimalToFraction } from './utils';

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
  StellarOperation,
} from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.stellar.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'stellar';

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
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId: _connectId,
            deviceId: _deviceId,
            template,
            pathPrefix: _pathPrefix,
            pathSuffix: _pathSuffix,
            coinName: _coinName,
            showOnOnekeyFn: _showOnOnekeyFn,
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
                __hwExtraInfo__: undefined,
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, address, __hwExtraInfo__ } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address || '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
            path,
            publicKey: '',
            __hwExtraInfo__,
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  private _convertAsset(
    asset: InstanceType<typeof sdkStellar.StellarSdk.Asset>,
  ) {
    const assetType = asset.getAssetType();
    let type: 0 | 1 | 2;

    // 0: native, 1: credit_alphanum4, 2: credit_alphanum12
    switch (assetType) {
      case 'native':
        type = 0;
        break;
      case 'credit_alphanum4':
        type = 1;
        break;
      case 'credit_alphanum12':
        type = 2;
        break;
      default:
        throw new OneKeyInternalError('Invalid asset type');
    }

    return {
      type,
      code: asset.code,
      issuer: asset.issuer,
    };
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxStellar;

    const envelope = sdkStellar.TransactionBuilder.fromXDR(
      encodedTx.xdr,
      encodedTx.networkPassphrase,
    );

    // Use correct type for decodeTx: sdkStellar.StellarSdk.Transaction
    let decodeTx: InstanceType<typeof sdkStellar.StellarSdk.Transaction>;
    if (envelope instanceof sdkStellar.StellarSdk.FeeBumpTransaction) {
      decodeTx = envelope.innerTransaction;
    } else {
      decodeTx = envelope;
    }

    if (!(decodeTx instanceof sdkStellar.StellarSdk.Transaction)) {
      throw new OneKeyInternalError('Invalid transaction');
    }

    const { source, operations, memo, fee, sequence, timeBounds } = decodeTx;
    const network = await this.getNetwork();

    const stellarOperations: StellarOperation[] = [];
    for (const operation of operations) {
      switch (operation.type) {
        case 'createAccount': {
          stellarOperations.push({
            type: 'createAccount',
            source: operation.source,
            destination: operation.destination,
            startingBalance: new BigNumber(operation.startingBalance)
              .shiftedBy(network.decimals)
              .toFixed(),
          });
          break;
        }
        case 'payment': {
          stellarOperations.push({
            type: 'payment',
            source: operation.source,
            destination: operation.destination,
            amount: new BigNumber(operation.amount)
              .shiftedBy(network.decimals)
              .toFixed(),
            asset: this._convertAsset(operation.asset),
          });
          break;
        }
        case 'pathPaymentStrictReceive': {
          stellarOperations.push({
            type: 'pathPayment',
            source: operation.source,
            sendAsset: this._convertAsset(operation.sendAsset),
            sendMax: operation.sendMax,
            destination: operation.destination,
            destAsset: this._convertAsset(operation.destAsset),
            destAmount: new BigNumber(operation.destAmount)
              .shiftedBy(network.decimals)
              .toFixed(),
            path: operation.path?.map((item) => this._convertAsset(item)),
          });
          break;
        }
        case 'createPassiveSellOffer': {
          stellarOperations.push({
            type: 'createPassiveOffer',
            source: operation.source,
            buying: this._convertAsset(operation.buying),
            selling: this._convertAsset(operation.selling),
            amount: new BigNumber(operation.amount)
              .shiftedBy(network.decimals)
              .toFixed(),
            price: decimalToFraction(operation.price),
          });
          break;
        }
        case 'changeTrust': {
          if (
            operation.line instanceof sdkStellar.StellarSdk.LiquidityPoolAsset
          ) {
            throw new NotImplemented({
              key: ETranslations.hardware_unknown_message_error,
              // message: 'Liquidity pool asset not supported',
            });
          }
          stellarOperations.push({
            type: 'changeTrust',
            source: operation.source,
            limit: new BigNumber(operation.limit)
              .shiftedBy(network.decimals)
              .toFixed(),
            line: this._convertAsset(operation.line),
          });
          break;
        }
        case 'allowTrust': {
          throw new NotImplemented({
            key: ETranslations.hardware_unknown_message_error,
            // message: 'Allow trust operation not supported',
          });
          // let authorize = false;
          // if (typeof operation.authorize === 'boolean') {
          //   authorize = operation.authorize;
          // } else if (typeof operation.authorize === 'number') {
          //   // type deauthorize = 0;
          //   // type authorize = 1;
          //   // type authorizeToMaintainLiabilities = 2;
          //   authorize =
          //     operation.authorize === 1
          //       ? true
          //       : operation.authorize === 2
          //       ? true
          //       : false;
          // }
          // stellarOperations.push({
          //   type: 'allowTrust',
          //   source: operation.source,
          //   trustor: operation.trustor,
          //   assetIssuer: operation.assetIssuer,
          //   assetCode: operation.assetCode,
          //   authorize: authorize,
          // });
          // break;
        }
        case 'accountMerge': {
          stellarOperations.push({
            type: 'accountMerge',
            source: operation.source,
            destination: operation.destination,
          });
          break;
        }
        case 'manageData': {
          stellarOperations.push({
            type: 'manageData',
            source: operation.source,
            name: operation.name,
            value: operation.value,
          });
          break;
        }
        case 'bumpSequence': {
          stellarOperations.push({
            type: 'bumpSequence',
            source: operation.source,
            bumpTo: operation.bumpTo,
          });
          break;
        }
        case 'setOptions': {
          throw new NotImplemented({
            key: ETranslations.hardware_unknown_message_error,
            // message: 'setOptions operation not supported',
          });
          // let signer: {
          //   type: 0 | 1 | 2;
          //   key: Buffer;
          //   weight: number | undefined;
          // };
          // if (operation.signer instanceof sdkStellar.Signer.Ed25519PublicKey) {
          //   signer = {
          //     type: 0,
          //     key: Buffer.from(operation.signer.ed25519PublicKey, 'hex'),
          //     weight: operation.signer.weight,
          //   };
          // } else if (operation.signer instanceof sdkStellar.Signer.PreAuthTx) {
          //   signer = {
          //     type: 1,
          //     key: Buffer.from(operation.signer.preAuthTx, 'hex'),
          //     weight: operation.signer.weight,
          //   };
          // } else if (operation.signer instanceof sdkStellar.Signer.Sha256Hash) {
          //   signer = {
          //     type: 2,
          //     key: Buffer.from(operation.signer.sha256Hash, 'hex'),
          //     weight: operation.signer.weight,
          //   };
          // } else {
          //   throw new OneKeyInternalError('Invalid signer');
          // }
          // stellarOperations.push({
          //   type: 'setOptions',
          //   source: operation.source,
          //   setFlags: operation.setFlags,
          //   clearFlags: operation.clearFlags,
          //   masterWeight: operation.masterWeight,
          //   lowThreshold: operation.lowThreshold,
          //   medThreshold: operation.medThreshold,
          //   highThreshold: operation.highThreshold,
          //   homeDomain: operation.homeDomain,
          //   inflationDest: operation.inflationDest,
          //   signer: signer,
          // });
          // break;
        }
        case 'manageBuyOffer':
        case 'manageSellOffer': {
          const amount =
            operation.type === 'manageBuyOffer'
              ? operation.buyAmount
              : operation.amount;
          stellarOperations.push({
            type: 'manageOffer',
            source: operation.source,
            offerId: operation.offerId,
            selling: this._convertAsset(operation.selling),
            buying: this._convertAsset(operation.buying),
            amount: new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
            price: decimalToFraction(operation.price),
          });
          break;
        }
        case 'invokeHostFunction': {
          throw new NotImplemented({
            key: ETranslations.hardware_unknown_message_error,
            // message: 'invokeContractFunction operation not supported',
          });
        }
        default:
          throw new NotImplemented({
            key: ETranslations.hardware_unknown_message_error,
            // message: `Unsupported operation type: ${operation.type}`,
          });
      }
    }

    const sdk = await this.getHardwareSDKInstance({
      connectId: params.deviceParams?.dbDevice?.connectId || '',
    });
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    // "NONE": 0, "TEXT": 1, "ID": 2, "HASH": 3, "RETURN": 4
    let hwMemo: {
      type: 0 | 1 | 2 | 3 | 4;
      id?: string;
      text?: string;
      hash?: string;
    };
    let hwMemoValue: string | undefined;
    switch (memo.type) {
      case 'none':
        hwMemo = { type: 0 };
        break;
      case 'text':
        if (
          typeof memo.value !== 'string' &&
          (Buffer.isBuffer(memo.value) || ArrayBuffer.isView(memo.value))
        ) {
          hwMemoValue = Buffer.from(memo.value as any).toString('utf-8');
        } else {
          hwMemoValue = memo.value as string;
        }
        hwMemo = { type: 1, text: hwMemoValue };
        break;
      case 'id':
        if (
          typeof memo.value !== 'string' &&
          (Buffer.isBuffer(memo.value) || ArrayBuffer.isView(memo.value))
        ) {
          hwMemoValue = Buffer.from(memo.value as any).toString('hex');
        } else {
          hwMemoValue = memo.value as string;
        }
        hwMemo = { type: 2, id: hwMemoValue };
        break;
      case 'hash':
        if (
          typeof memo.value !== 'string' &&
          (Buffer.isBuffer(memo.value) || ArrayBuffer.isView(memo.value))
        ) {
          hwMemoValue = Buffer.from(memo.value as any).toString('hex');
        } else {
          hwMemoValue = memo.value as string;
        }
        hwMemo = { type: 3, hash: hwMemoValue };
        break;
      case 'return':
        hwMemo = { type: 4 };
        break;
      default:
        throw new OneKeyInternalError('Invalid memo type');
    }
    const result = await convertDeviceResponse(async () =>
      sdk.stellarSignTransaction(connectId, deviceId, {
        path,
        networkPassphrase: encodedTx.networkPassphrase,
        transaction: {
          source,
          fee: Number(fee),
          sequence,
          timebounds: timeBounds
            ? {
                minTime: Number(timeBounds?.minTime),
                maxTime: Number(timeBounds?.maxTime),
              }
            : undefined,
          memo: hwMemo,
          operations: stellarOperations,
        },
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;

    const signedTx = assembleSignedTransaction({
      encodedTx: encodedTx.xdr,
      signature: Buffer.from(signature, 'hex'),
      networkPassphrase: encodedTx.networkPassphrase,
    });

    return Promise.resolve({
      txid: signedTx.txid,
      encodedTx,
      rawTx: signedTx.rawTx,
    });
  }

  override signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
