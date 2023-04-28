import { AddressSecp256k1, Transaction } from '@zondax/izari-filecoin';
import base32Decode from 'base32-decode';

import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_FIL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { ProtocolIndicator } from './types';
import { validateNetworkPrefix } from './utils';

import type { DBVariantAccount } from '../../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxFil } from './types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;
const accountNamePrefix = 'FIL';

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const network = await this.getNetwork();

    let response;
    try {
      response = await HardwareSDK.filecoinGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({
          path,
          showOnOneKey,
          isTestnet: network.isTestnet,
        })),
        ...passphraseState,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.common.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    const ret = [];
    let index = 0;
    for (const addressInfo of response.payload) {
      const { address, path } = addressInfo;
      if (address) {
        const name =
          (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;

        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.VARIANT,
          path,
          coinType: COIN_TYPE,
          pub: '',
          address,
          addresses: { [this.networkId]: address },
        });
        index += 1;
      }
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const network = await this.getNetwork();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.filecoinGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      isTestnet: network.isTestnet,
      ...passphraseState,
    });

    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const network = await this.getNetwork();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.filecoinGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
        isTestnet: network.isTestnet,
      })),
    });

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }

  async signTransaction(unsignedTx: IUnsignedTxPro): Promise<ISignedTxPro> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const network = await this.getNetwork();
    const path = await this.getAccountPath();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;

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
      if (parseInt(protocolIndicator) !== ProtocolIndicator.SECP256K1)
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

    const response = await HardwareSDK.filecoinSignTransaction(
      connectId,
      deviceId,
      {
        path,
        rawTx: Buffer.from(transaction).toString('hex'),
        isTestnet: network.isTestnet,
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature } = response.payload;

      return Promise.resolve({
        txid: '',
        rawTx: JSON.stringify({
          Message: encodedTx,
          Signature: {
            Data: Buffer.from(signature, 'hex').toString('base64'),
            Type: ProtocolIndicator.SECP256K1,
          },
        }),
      });
    }
    throw convertDeviceError(response.payload);
  }

  signMessage(): Promise<string[]> {
    throw new NotImplemented();
  }
}
