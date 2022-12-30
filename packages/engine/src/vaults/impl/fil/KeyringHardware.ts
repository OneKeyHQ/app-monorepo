import { FilecoinSigner } from '@blitslabs/filecoin-js-signer';
import { CoinType, decode, encode } from '@glif/filecoin-address';
import BigNumber from 'bignumber.js';

import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_FIL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { ProtocolIndicator } from './types';

import type { DBVariantAccount } from '../../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxFil } from './types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;
const accountNamePrefix = 'FIL';

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'/0/0`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const network = await this.getNetwork();

    let response;
    try {
      response = await HardwareSDK.filecoinGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({ path, showOnOneKey })),
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

        const addressObj = decode(address);
        const addressOnNetwork = encode(
          network.isTestnet ? CoinType.TEST : CoinType.MAIN,
          addressObj,
        );

        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.VARIANT,
          path,
          coinType: COIN_TYPE,
          pub: '',
          address,
          addresses: { [this.networkId]: addressOnNetwork },
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
      ...passphraseState,
    });

    if (response.success && !!response.payload?.address) {
      const addressObj = decode(response.payload.address);
      const addressOnNetwork = encode(
        network.isTestnet ? CoinType.TEST : CoinType.MAIN,
        addressObj,
      );
      return addressOnNetwork;
    }
    throw convertDeviceError(response.payload);
  }

  async signTransaction(unsignedTx: IUnsignedTxPro): Promise<ISignedTxPro> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;

    const tool = new FilecoinSigner();
    const unsignedMessage = {
      ...encodedTx,
      Value: new BigNumber(encodedTx.Value),
      GasFeeCap: new BigNumber(encodedTx.GasFeeCap),
      GasPremium: new BigNumber(encodedTx.GasPremium),
    };
    const message = tool.tx.transactionSerializeRaw(unsignedMessage);

    const response = await HardwareSDK.filecoinSignTransaction(
      connectId,
      deviceId,
      {
        path,
        rawTx: Buffer.from(message).toString('hex'),
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
