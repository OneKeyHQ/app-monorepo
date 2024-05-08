import { HardwareErrorCode } from '@onekeyfe/hd-shared';
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
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { stripHexPrefix } from '../../utils/hexUtils';

import { cnFastHash, serializeTransaction } from './utils';

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
      console.log('signTransaction response', response.payload);

      const rawTx = serializeTransaction({
        encodedTx,
        signTxParams: params,
        payload: response.payload,
      });

      return {
        txid: stripHexPrefix(cnFastHash(rawTx)),
        rawTx,
      };
    }

    if (
      response.payload.code === HardwareErrorCode.RuntimeError &&
      response.payload.error.indexOf('Invalid number of inputs') !== -1
    ) {
      throw new Error('Exceeded UTXO inputs limit.');
    }

    throw convertDeviceError(response.payload);
  }

  override signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async getPrivateViewKey(params: { path: string }): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const resp = await HardwareSDK.dnxGetTrackingKey(connectId, deviceId, {
      path: params.path,
      ...passphraseState,
    });

    if (resp.success && !!resp.payload?.trackingKey) {
      return resp.payload?.trackingKey;
    }
    throw convertDeviceError(resp.payload);
  }
}
