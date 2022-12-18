import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { HardwareError } from '@onekeyfe/hd-shared';

import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_COSMOS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { stripHexPrefix } from '../../utils/hexUtils';

import { pubkeyToBaseAddress } from './sdk/address';
import { generateSignBytes, generateSignedTx } from './utils';

import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';
import type { IEncodedTxCosmos } from './type';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;
// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  private async getChainInfo() {
    return this.engine.providerManager.getChainInfoByNetworkId(this.networkId);
  }

  async getPublicKey(
    connectId: string,
    deviceId: string,
    paths: Array<string>,
  ): Promise<Array<string>> {
    const chainInfo = await this.getChainInfo();
    const curve = chainInfo?.implOptions?.curve ?? 'secp256k1';

    let response;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const passphraseState = await this.getWalletPassphraseState();
    try {
      response = await HardwareSDK.cosmosGetPublicKey(connectId, deviceId, {
        bundle: paths.map((path) => ({ path, curve })),
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

    const pubKeys = response.payload
      .map((result) => result.publicKey)
      .filter((item: string | undefined): item is string => !!item);

    return pubKeys;
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/0'/0/${index}`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const chainInfo = await this.getChainInfo();
    const curve = chainInfo?.implOptions?.curve ?? 'secp256k1';

    if (curve === 'ed25519') {
      throw new HardwareError('ed25519 curve is not supported');
    }

    let publicKeyResponse;
    try {
      publicKeyResponse = await HardwareSDK.cosmosGetPublicKey(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({ path, curve, showOnOneKey })),
          ...passphraseState,
        },
      );
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }
    if (!publicKeyResponse.success) {
      debugLogger.common.error(publicKeyResponse.payload);
      throw convertDeviceError(publicKeyResponse.payload);
    }

    const ret = [];
    let index = 0;
    for (const addressInfo of publicKeyResponse.payload) {
      const { path, publicKey } = addressInfo;
      const pubkey = hexToBytes(publicKey);
      const address = pubkeyToBaseAddress(curve, pubkey);
      const name = (names || [])[index] || `Cosmos #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub: publicKey,
        address,
        addresses: {},
      });
      index += 1;
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const chainInfo = await this.getChainInfo();
    const curve = chainInfo?.implOptions?.curve ?? 'secp256k1';
    const addressPrefix = chainInfo?.implOptions?.addressPrefix;

    if (curve === 'ed25519') {
      throw new HardwareError('ed25519 curve is not supported');
    }

    const response = await HardwareSDK.cosmosGetAddress(connectId, deviceId, {
      path: params.path,
      hrp: addressPrefix,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return response.payload?.address;
    }
    throw convertDeviceError(response.payload);
  }

  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();

    const encodedTx = unsignedTx.payload.encodedTx as IEncodedTxCosmos;
    const signBytes = generateSignBytes(encodedTx);
    const unSignTx = stripHexPrefix(bytesToHex(signBytes));

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.cosmosSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        rawTx: unSignTx,
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature } = response.payload;
      const rawTx = generateSignedTx(encodedTx, Buffer.from(signature, 'hex'));

      return {
        txid: '',
        rawTx: Buffer.from(rawTx).toString('base64'),
      };
    }

    throw convertDeviceError(response.payload);
  }
}
