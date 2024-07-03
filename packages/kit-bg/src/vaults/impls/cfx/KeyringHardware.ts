/* eslint-disable @typescript-eslint/no-unused-vars */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import BigNumber from 'bignumber.js';
import { TypedDataUtils } from 'eth-sig-util';
import { omitBy } from 'lodash';

import type { IEncodedTxCfx } from '@onekeyhq/core/src/chains/cfx/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessageCfx,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import {
  convertDeviceError,
  convertDeviceResponse,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { conflux as sdkCfx } from './sdkCfx';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

const { address: confluxAddress, Transaction } = sdkCfx;

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.cfx.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addresses = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            pathSuffix,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.confluxGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
                chainId: Number(chainId),
              })),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < addresses.length; i += 1) {
          const item = addresses[i];
          const { path, address } = item;
          const { displayAddress } = await this.vault.validateAddress(
            address ?? '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: '',
            path,
            publicKey: '',
            addresses: { [this.networkId]: displayAddress || address || '' },
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
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCfx;
    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const transaction = {
      ...encodedTx,
      epochHeight: toBigIntHex(new BigNumber(encodedTx.epochHeight ?? 0)),
      to: encodedTx.to
        ? `0x${confluxAddress
            .decodeCfxAddress(encodedTx.to)
            .hexAddress.toString('hex')}`
        : '',
      storageLimit: toBigIntHex(new BigNumber(encodedTx.storageLimit ?? 0)),
      nonce: toBigIntHex(new BigNumber(encodedTx.nonce ?? 0)),
      gasPrice: toBigIntHex(new BigNumber(encodedTx.gasPrice ?? 0)),
      data: encodedTx.data ?? '0x',
      value: toBigIntHex(new BigNumber(encodedTx.value ?? 0)),
    };

    const result = await convertDeviceResponse(async () =>
      sdk.confluxSignTransaction(connectId, deviceId, {
        path,
        // @ts-ignore
        transaction,
        ...deviceCommonParams,
      }),
    );

    const { r, s, v } = result;

    const signedTransaction = new Transaction({
      ...omitBy(transaction, (t) => !t),
      r,
      s,
      v: new BigNumber(v).toNumber(),
    });

    return Promise.resolve({
      txid: signedTransaction.hash,
      rawTx: signedTransaction.serialize(),
      encodedTx: unsignedTx.encodedTx,
    });
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    checkIsDefined(deviceParams);
    return Promise.all(
      messages.map(async (message) =>
        this.handleSignMessage({
          message: message as IUnsignedMessageCfx,
          deviceParams: deviceParams as IDeviceSharedCallParams,
        }),
      ),
    );
  }

  async handleSignMessage(params: {
    message: IUnsignedMessageCfx;
    deviceParams: IDeviceSharedCallParams;
  }): Promise<string> {
    const { message, deviceParams } = params;
    const { dbDevice, deviceCommonParams } = deviceParams;
    const { connectId, deviceId } = dbDevice;

    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();

    if (
      message.type === EMessageTypesEth.ETH_SIGN ||
      message.type === EMessageTypesEth.TYPED_DATA_V1
    ) {
      throw new NotImplemented();
    }

    if (message.type === EMessageTypesEth.PERSONAL_SIGN) {
      let messageBuffer: Buffer;
      try {
        if (!hexUtils.isHexString(message.message))
          throw new Error('not hex string');

        messageBuffer = Buffer.from(
          hexUtils.stripHexPrefix(message.message),
          'hex',
        );
      } catch (error) {
        messageBuffer = Buffer.from('');
      }

      let messageHex = message.message;
      if (messageBuffer.length === 0) {
        messageHex = Buffer.from(message.message, 'utf-8').toString('hex');
      }

      const response = await sdk.confluxSignMessage(connectId, deviceId, {
        path,
        messageHex,
        ...deviceCommonParams,
      });

      if (!response.success) {
        throw convertDeviceError(response.payload);
      }

      return hexUtils.addHexPrefix(response.payload.signature || '');
    }

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V3 ||
      message.type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      const useV4 = message.type === EMessageTypesEth.TYPED_DATA_V4;
      const data = JSON.parse(message.message);
      const typedData = TypedDataUtils.sanitizeData(data);

      const domainType =
        typedData?.types?.CIP23Domain?.length > 0
          ? 'CIP23Domain'
          : 'EIP712Domain';

      const domainHash = TypedDataUtils.hashStruct(
        domainType,
        typedData.domain,
        typedData.types,
        useV4,
      ).toString('hex');
      const messageHash = TypedDataUtils.hashStruct(
        // @ts-expect-error
        typedData.primaryType,
        typedData.message,
        typedData.types,
        useV4,
      ).toString('hex');

      const response = await sdk.confluxSignMessageCIP23(connectId, deviceId, {
        path,
        domainHash,
        messageHash,
        ...deviceCommonParams,
      });

      if (!response.success) {
        throw convertDeviceError(response.payload);
      }

      return hexUtils.addHexPrefix(response?.payload?.signature || '');
    }

    throw web3Errors.rpc.methodNotFound(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Sign message method=${message.type} not found`,
    );
  }
}
