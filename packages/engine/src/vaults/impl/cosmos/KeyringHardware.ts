import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { HardwareError } from '@onekeyfe/hd-shared';

import {
  generateSignBytes,
  pubkeyToBaseAddress,
  serializeSignedTx,
} from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_COSMOS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  OneKeyHardwareError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';
import { stripHexPrefix } from '@onekeyhq/shared/src/utils/hexUtils';

import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';
import type { IEncodedTxCosmos } from './type';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;
// @ts-ignore
// extends KeyringHardwareBaseKeyringHdBase
export class KeyringHardware extends KeyringHardwareBase {
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
      flowLogger.error.log(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      flowLogger.error.log(response.payload);
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
      flowLogger.error.log(error);
      throw new OneKeyHardwareError(error);
    }
    if (!publicKeyResponse.success) {
      flowLogger.error.log(publicKeyResponse.payload);
      throw convertDeviceError(publicKeyResponse.payload);
    }

    const ret = [];
    let index = 0;
    for (const addressInfo of publicKeyResponse.payload) {
      const { path, publicKey } = addressInfo;
      const pubkey = hexToBytes(publicKey);
      const address = pubkeyToBaseAddress(curve, pubkey);
      const name = (names || [])[index] || `COSMOS #${indexes[index] + 1}`;
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

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
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
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        hrp: addressPrefix,
        showOnOneKey: !!showOnOneKey,
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

  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();

    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }

    const encodedTx = unsignedTx.payload.encodedTx as IEncodedTxCosmos;
    const signBytes = generateSignBytes(encodedTx);
    // hardware Only supported amino
    const unSignTx = bytesToHex(signBytes);

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

      const rawTx = serializeSignedTx({
        txWrapper: encodedTx,
        signature: {
          signatures: [hexToBytes(stripHexPrefix(signature))],
        },
        publicKey: {
          pubKey: senderPublicKey,
        },
      });

      return {
        txid: '',
        rawTx: Buffer.from(rawTx).toString('base64'),
      };
    }

    throw convertDeviceError(response.payload);
  }
}
