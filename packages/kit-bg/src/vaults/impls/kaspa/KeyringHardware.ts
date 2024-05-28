/* eslint-disable @typescript-eslint/no-unused-vars */
import { Transaction } from '@kaspa/core-lib';

import {
  SignType,
  SignatureType,
  SigningMethodType,
  publicKeyFromX,
  toTransaction,
} from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import type { IEncodedTxKaspa } from '@onekeyhq/core/src/chains/kaspa/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { KaspaSignTransactionParams } from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.kaspa.hd;

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.kaspaGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${index}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });
            return response;
          },
        });
        const ret: ICoreApiGetAddressItem[] = [];
        for (const addressInfo of addressesInfo) {
          const { address, path } = addressInfo;
          const item: ICoreApiGetAddressItem = {
            address,
            path,
            publicKey: '',
          };
          ret.push(item);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const sdk = await this.getHardwareSDKInstance();
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxKaspa;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const chainId = await this.getNetworkChainId();

    const txn = toTransaction(encodedTx);
    const unSignTx: KaspaSignTransactionParams = {
      version: txn.version,
      inputs: txn.inputs.map((input) => ({
        path: dbAccount.path,
        prevTxId: input.prevTxId.toString('hex'),
        outputIndex: input.outputIndex,
        sequenceNumber: input.sequenceNumber.toString(),
        output: {
          satoshis: input?.output?.satoshis.toString() ?? '',
          script: bufferUtils.bytesToHex(
            input?.output?.script?.toBuffer() ?? Buffer.alloc(0),
          ),
        },
        sigOpCount: input?.output?.script?.getSignatureOperationsCount() ?? 1,
      })),
      outputs: txn.outputs.map((output) => ({
        satoshis: output.satoshis.toString(),
        script: bufferUtils.bytesToHex(output.script.toBuffer()),
        scriptVersion: 0,
      })),
      lockTime: txn.nLockTime.toString(),
      sigHashType: SignatureType.SIGHASH_ALL,
      sigOpCount: 1,
      scheme: SignType.Schnorr,
      prefix: chainId,
    };

    const response = await sdk.kaspaSignTransaction(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
      ...unSignTx,
    });

    if (response.success) {
      const signatures = response.payload;

      for (const signature of signatures) {
        const input = txn.inputs[signature.index];
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const publicKeyBuf = input?.output?.script?.getPublicKey();
        const publicKey = publicKeyFromX(
          true,
          bufferUtils.bytesToHex(publicKeyBuf),
        );

        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        txn.inputs[signature.index].addSignature(
          txn,
          // @ts-expect-error
          new Transaction.Signature({
            publicKey,
            prevTxId: input.prevTxId,
            outputIndex: input.outputIndex,
            inputIndex: signature.index,
            signature: signature.signature,
            sigtype: SignatureType.SIGHASH_ALL,
          }),
          SigningMethodType.Schnorr,
        );
      }

      const rawTx = bufferUtils.bytesToHex(txn.toBuffer());

      return {
        // TODO: txid ??
        txid: '',
        rawTx,
        encodedTx,
      };
    }
    throw convertDeviceError(response.payload);
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
