/* eslint-disable @typescript-eslint/no-unused-vars */
import { AddressSecp256k1, Transaction } from '@zondax/izari-filecoin';
import base32Decode from 'base32-decode';

import type { IEncodedTxFil } from '@onekeyhq/core/src/chains/fil/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { EProtocolIndicator } from './types';
import { validateNetworkPrefix } from './utils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.fil.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const network = await this.getNetwork();

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
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.filecoinGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,

                showOnOneKey: showOnOnekeyFn(arrIndex),
                isTestnet: network.isTestnet,
              })),
            });
            return response;
          },
        });

        console.log('fil-buildAddressesInfo', publicKeys);

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
            addresses: { [this.networkId]: normalizedAddress || address || '' },
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
    const network = await this.getNetwork();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;

    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const BufferConcatFunction = Buffer.concat;

    Buffer.concat = (list: ReadonlyArray<Uint8Array>, totalLength?: number) =>
      BufferConcatFunction(
        list.map((item) => Buffer.from(item)),
        totalLength,
      );
    AddressSecp256k1.fromString = (address: string) => {
      const networkPrefix = address[0];
      const protocolIndicator = address[1];

      if (!validateNetworkPrefix(networkPrefix))
        throw new OneKeyInternalError('Invalid filecoin network.');
      if (parseInt(protocolIndicator) !== EProtocolIndicator.SECP256K1)
        throw new OneKeyInternalError('Invalid filecoin protocol indicator.');

      const decodedData = Buffer.from(
        base32Decode(address.substring(2).toUpperCase(), 'RFC4648'),
      );
      const payload = decodedData.subarray(0, -4);
      const checksum = decodedData.subarray(-4);

      const newAddress = new AddressSecp256k1(networkPrefix, payload);
      if (
        Buffer.from(newAddress.getChecksum()).toString('hex') !==
        Buffer.from(checksum).toString('hex')
      )
        throw new OneKeyInternalError('Invalid filecoin checksum network.');

      return newAddress;
    };

    const transaction = await Transaction.fromJSON(encodedTx).serialize();
    Buffer.concat = BufferConcatFunction;

    const result = await convertDeviceResponse(async () =>
      sdk.filecoinSignTransaction(connectId, deviceId, {
        path,
        rawTx: Buffer.from(transaction).toString('hex'),
        isTestnet: network.isTestnet,
        ...deviceCommonParams,
      }),
    );

    const { signature } = result;
    return Promise.resolve({
      txid: '',
      encodedTx: unsignedTx.encodedTx,
      rawTx: JSON.stringify({
        Message: encodedTx,
        Signature: {
          Data: Buffer.from(signature, 'hex').toString('base64'),
          Type: EProtocolIndicator.SECP256K1,
        },
      }),
    });
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
