import { HardwareError } from '@onekeyfe/hd-shared';
import { bytesToHex, hexToBytes } from 'viem';

import {
  TransactionWrapper,
  generateSignBytes,
  getADR36SignDoc,
  pubkeyToAddress,
  serializeSignedTx,
} from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import type { IEncodedTxCosmos } from '@onekeyhq/core/src/chains/cosmos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.cosmos.hd;

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const sdk = await this.getHardwareSDKInstance();
    const account = await this.vault.getAccount();
    const { unsignedTx, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCosmos;
    const txWrapper = new TransactionWrapper(encodedTx.signDoc, encodedTx.msg);
    const unSignedRawTx = bytesToHex(generateSignBytes(txWrapper));
    const result = await convertDeviceResponse(async () => {
      const res = await sdk.cosmosSignTransaction(
        dbDevice.connectId,
        dbDevice.deviceId,
        {
          path: account.path,
          rawTx: unSignedRawTx,
          ...deviceCommonParams,
        },
      );
      return res;
    });
    const rawTx = serializeSignedTx({
      txWrapper,
      signature: {
        signatures: [hexToBytes(`0x${result.signature}`)],
      },
      publicKey: {
        pubKey: account.pub ?? '',
      },
    });
    return {
      txid: '',
      rawTx: Buffer.from(rawTx).toString('base64'),
      encodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages } = params;
    const results = await Promise.all(
      messages.map(async (commonMessage) => {
        const { data, signer } = JSON.parse(commonMessage.message);

        const messageData = Buffer.from(data).toString('base64');
        const unSignDoc = getADR36SignDoc(signer, messageData);
        const encodedTx = TransactionWrapper.fromAminoSignDoc(
          unSignDoc,
          undefined,
        );

        const { rawTx } = await this.signTransaction({
          ...params,
          unsignedTx: {
            encodedTx,
          },
          signOnly: true,
        });

        return rawTx;
      }),
    );
    return results;
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { curve } = await this.getNetworkInfo();
        if (curve === 'ed25519') {
          throw new HardwareError('ed25519 curve is not supported');
        }

        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.cosmosGetPublicKey(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams, // passpharse params
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${index}`,
                /**
                 * Search accounts not show detail at device.Only show on device when add accounts into wallet.
                 */
                showOnOneKey: showOnOnekeyFn(arrIndex),
                chainId: Number(chainId),
              })),
            });
            return response;
          },
        });

        const networkInfo = await this.getNetworkInfo();
        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, publicKey } = item;
          const pubkey = hexToBytes(`0x${publicKey}`);
          const addressInfo: ICoreApiGetAddressItem = {
            address: '',
            path,
            publicKey,
            addresses: {
              [this.networkId]: pubkeyToAddress(
                curve,
                networkInfo.addressPrefix,
                pubkey,
              ),
            },
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const { indexes } = params;
    const networkInfo = await this.getNetworkInfo();
    const addresses = await this.baseGetDeviceAccountAddresses({
      params,
      usedIndexes: indexes,
      sdkGetAddressFn: async ({
        connectId,
        deviceId,
        pathPrefix,
        pathSuffix,
        showOnOnekeyFn,
      }) => {
        const sdk = await this.getHardwareSDKInstance();

        const response = await sdk.cosmosGetAddress(connectId, deviceId, {
          ...params.deviceParams.deviceCommonParams,
          bundle: indexes.map((index, arrIndex) => ({
            path: `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`,
            hrp: networkInfo.addressPrefix,
            showOnOneKey: showOnOnekeyFn(arrIndex),
          })),
        });
        return response;
      },
    });

    return addresses.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }
}
