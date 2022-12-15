import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import * as sdk from 'algosdk';

import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { COINTYPE_ALGO as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';
import type { IEncodedTxAlgo } from './types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const { encodedTx } = unsignedTx.payload as { encodedTx: IEncodedTxAlgo };

    const transaction = sdk.Transaction.from_obj_for_encoding(
      sdk.decodeObj(Buffer.from(encodedTx, 'base64')) as sdk.EncodedTransaction,
    );

    const response = await HardwareSDK.algoSignTransaction(
      connectId,
      deviceId,
      {
        path,
        rawTx: transaction.bytesToSign().toString('hex'),
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature } = response.payload;

      return {
        txid: transaction.txID(),
        rawTx: Buffer.from(
          sdk.encodeObj({
            sig: Buffer.from(signature, 'hex'),
            txn: transaction.get_obj_for_encoding(),
          }),
        ).toString('base64'),
      };
    }

    throw deviceUtils.convertDeviceError(response.payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  signMessage(messages: any, options: any): Promise<any> {
    throw new NotImplemented();
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names } = params;
    const showOnOneKey = false;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'`);

    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.algoGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
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
      throw deviceUtils.convertDeviceError(addressesResponse.payload);
    }

    return addressesResponse.payload
      .map(({ address = '', path }, index) => ({
        id: `${this.walletId}--${path}`,
        name: (names || [])[index] || `ALGO #${indexes[index] + 1}`,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: '',
        address,
      }))
      .filter(({ address }) => !!address);
  }

  async getAddress(params: IGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.algoGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });

    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw deviceUtils.convertDeviceError(response.payload);
  }
}
