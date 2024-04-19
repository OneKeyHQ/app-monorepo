import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  IMPL_DYNEX as COIN_IMPL,
  COINTYPE_DYNEX as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByImpl } from '../../../managers/impl';
import { AccountType, type DBAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { encodeVarInt, integerToLittleEndianHex } from './utils';

import type { DBUTXOAccount } from '../../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxDynex } from './types';

export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { indexes, names, template } = params;
    const { pathPrefix } = slicePathTemplate(template);
    const paths = indexes.map((index) => `${pathPrefix}/${index}'`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;
    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.dnxGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({
          path,
          showOnOneKey,
        })),
        ...passphraseState,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!addressesResponse.success) {
      debugLogger.common.error(addressesResponse.payload);
      throw convertDeviceError(addressesResponse.payload);
    }

    const ret: DBUTXOAccount[] = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path } = addressInfo;

      if (isNil(address)) {
        throw new OneKeyHardwareError({ message: 'Get Dynex Address error.' });
      }
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      const addressRelPath = '0/0';
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        pub: '',
        xpub: '',
        address,
        addresses: { [addressRelPath]: address },
      });
      index += 1;
    }
    return ret;
  }

  override async getAddress(
    params: IHardwareGetAddressParams,
  ): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const addressesResponse = await HardwareSDK.dnxGetAddress(
      connectId,
      deviceId,
      {
        path: params.path,
        showOnOneKey: params.showOnOneKey,
        ...passphraseState,
      },
    );

    if (addressesResponse.success && !!addressesResponse.payload?.address) {
      return addressesResponse.payload.address;
    }
    throw convertDeviceError(addressesResponse.payload);
  }

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    try {
      const addressesResponse = await HardwareSDK.dnxGetAddress(
        connectId,
        deviceId,
        {
          bundle: params.map(({ path, showOnOneKey }) => ({
            path,
            showOnOneKey: !!showOnOneKey,
          })),
          ...passphraseState,
        },
      );
      if (!addressesResponse.success) {
        debugLogger.common.error(addressesResponse.payload);
        throw convertDeviceError(addressesResponse.payload);
      }

      return addressesResponse.payload.map((item) => ({
        path: item.path ?? '',
        address: item.address ?? '',
      }));
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const { payload } = unsignedTx;
    const encodedTx = payload.encodedTx as IEncodedTxDynex;
    const dbAccount = await this.getDbAccount();
    const network = await this.getNetwork();
    const params = {
      path: dbAccount.path,
      inputs: encodedTx.inputs,
      toAddress: encodedTx.to,
      amount: new BigNumber(encodedTx.amount)
        .shiftedBy(network.decimals)
        .toFixed(),
      fee: new BigNumber(encodedTx.fee)
        .shiftedBy(network.feeDecimals)
        .toFixed(),
      paymentIdHex: encodedTx.paymentId,
    };
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.dnxSignTransaction(connectId, deviceId, {
      ...passphraseState,
      ...(params as unknown as any),
    });

    if (response.success) {
      const { txKey, computedKeyImages, signatures, outputKeys } =
        response.payload;
      console.log('signTransaction response', response.payload);

      let rawTx = '';

      const version = '01';
      const unlockTime = '00';
      const inputTypeTag = '02';
      const outputTypeTag = '02';
      const txPubkeyTag = '01';
      const fromAddressTag = '04';
      const toAddressTag = '05';
      const amountTag = '06';
      const txSecTag = '07';
      const { decodedFrom, decodedTo } = encodedTx;
      const totalInputAmountBN = params.inputs.reduce(
        (acc, input) => acc.plus(input.amount),
        new BigNumber(0),
      );
      const chargeAmount = totalInputAmountBN
        .minus(params.amount)
        .minus(params.fee);

      rawTx += version;
      rawTx += unlockTime;
      rawTx += encodeVarInt(params.inputs.length);

      for (let i = 0; i < params.inputs.length; i += 1) {
        const input = params.inputs[i];
        rawTx += inputTypeTag;
        rawTx += encodeVarInt(input.amount);
        rawTx += encodeVarInt(1);
        rawTx += encodeVarInt(input.globalIndex);
        rawTx += computedKeyImages[i];
      }

      rawTx += encodeVarInt(outputKeys.length);

      for (let i = 0; i < outputKeys.length; i += 1) {
        const outputKey = outputKeys[i];
        rawTx += encodeVarInt(
          i === outputKeys.length - 1 && chargeAmount.gt(0)
            ? chargeAmount.toNumber()
            : Number(params.amount),
        );
        rawTx += outputTypeTag;
        rawTx += outputKey;
      }

      let extra = '';

      extra += txPubkeyTag;
      extra += txKey.ephemeralTxPubKey;

      extra += fromAddressTag;
      extra += decodedFrom.spend;
      extra += decodedFrom.view;

      extra += toAddressTag;
      extra += decodedTo.spend;
      extra += decodedTo.view;

      extra += amountTag;
      extra += integerToLittleEndianHex({
        number: Number(params.amount),
        bytes: 8,
      });

      extra += txSecTag;
      extra += txKey.ephemeralTxSecKey;

      rawTx += encodeVarInt(extra.length / 2);
      rawTx += extra;

      for (const signature of signatures) {
        rawTx += signature;
      }

      return {
        txid: '',
        rawTx,
      };
    }

    throw convertDeviceError(response.payload);
  }

  override signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
