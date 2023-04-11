/* eslint-disable @typescript-eslint/no-unused-vars */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import BigNumber from 'bignumber.js';
import { TypedDataUtils } from 'eth-sig-util';
import { omitBy } from 'lodash';

import { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import { isHexString } from '@onekeyhq/kit/src/utils/helper';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_CFX as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { ETHMessageTypes } from '../../../types/message';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import sdk from './sdkCfx';

import type { DBVariantAccount } from '../../../types/account';
import type { ETHMessage } from '../../../types/message';
import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxCfx } from './types';

const { Transaction, address: confluxAddress } = sdk;

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

export type IUnsignedMessageCfx = ETHMessage & {
  payload?: any;
};

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: IUnsignedTxPro): Promise<SignedTx> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCfx;

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

    const response = await HardwareSDK.confluxSignTransaction(
      connectId,
      deviceId,
      {
        path,
        // @ts-ignore
        transaction,
        ...passphraseState,
      },
    );

    if (response.success) {
      const { r, s, v } = response.payload;

      const signedTransaction = new Transaction({
        ...omitBy(transaction, (t) => !t),
        r,
        s,
        v: new BigNumber(v).toNumber(),
      });

      return Promise.resolve({
        txid: signedTransaction.hash,
        rawTx: signedTransaction.serialize(),
      });
    }
    throw convertDeviceError(response.payload);
  }

  async signMessage(
    messages: IUnsignedMessageCfx[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    return Promise.all(
      messages.map(async (message) => this.handleSignMessage(message)),
    );
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { indexes, names } = params;
    const showOnOneKey = false;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}`);

    const chainId = new BigNumber(await this.getNetworkChainId()).toNumber();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.confluxGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
            chainId,
          })),
          ...passphraseState,
        },
      );
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!addressesResponse.success) {
      debugLogger.common.error(addressesResponse.payload);
      throw convertDeviceError(addressesResponse.payload);
    }

    return addressesResponse.payload
      .map(({ address: addressOnNetwork, path }, index) => ({
        id: `${this.walletId}--${path}`,
        name: (names || [])[index] || `CFX #${indexes[index] + 1}`,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub: '',
        address: `0x${confluxAddress
          .decodeCfxAddress(addressOnNetwork ?? '')
          .hexAddress.toString('hex')}`,
        addresses: { [this.networkId]: addressOnNetwork ?? '' },
      }))
      .filter(({ address }) => !!address);
  }

  async getAddress(params: IGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const chainId = new BigNumber(await this.getNetworkChainId()).toNumber();
    const response = await HardwareSDK.confluxGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      chainId,
      ...passphraseState,
    });

    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }

  override async batchGetAddress(
    params: IGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const chainId = new BigNumber(await this.getNetworkChainId()).toNumber();
    const response = await HardwareSDK.confluxGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
        chainId,
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

  async handleSignMessage(message: IUnsignedMessageCfx) {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    if (message.type === ETHMessageTypes.TYPED_DATA_V1) {
      throw web3Errors.provider.unsupportedMethod(
        `Sign message method=${message.type} not supported for this device`,
      );
    }

    if (
      message.type === ETHMessageTypes.ETH_SIGN ||
      message.type === ETHMessageTypes.PERSONAL_SIGN
    ) {
      let messageBuffer: Buffer;
      try {
        if (!isHexString(message.message)) throw new Error('not hex string');

        messageBuffer = Buffer.from(message.message.replace('0x', ''), 'hex');
      } catch (error) {
        messageBuffer = Buffer.from('');
      }

      let messageHex = message.message;
      if (messageBuffer.length === 0) {
        messageHex = Buffer.from(message.message, 'utf-8').toString('hex');
      }

      const response = await HardwareSDK.confluxSignMessage(
        connectId,
        deviceId,
        {
          path,
          messageHex,
          ...passphraseState,
        },
      );

      if (!response.success) {
        throw convertDeviceError(response.payload);
      }

      return `0x${response.payload.signature || ''}`;
    }

    if (
      message.type === ETHMessageTypes.TYPED_DATA_V3 ||
      message.type === ETHMessageTypes.TYPED_DATA_V4
    ) {
      const useV4 = message.type === ETHMessageTypes.TYPED_DATA_V4;
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

      const response = await HardwareSDK.confluxSignMessageCIP23(
        connectId,
        deviceId,
        {
          path,
          domainHash,
          messageHash,
          ...passphraseState,
        },
      );

      if (!response.success) {
        throw convertDeviceError(response.payload);
      }

      return `0x${response?.payload?.signature || ''}`;
    }

    throw web3Errors.rpc.methodNotFound(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Sign message method=${message.type} not found`,
    );
  }
}
