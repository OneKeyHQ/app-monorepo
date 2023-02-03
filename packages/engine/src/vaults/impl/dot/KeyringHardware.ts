import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { u8aConcat } from '@polkadot/util';

import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import { KeyringHardwareBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringHardwareBase';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '@onekeyhq/engine/src/vaults/types';
import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  IMPL_DOT as COIN_IMPL,
  COINTYPE_DOT as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { accountIdToAddress } from './sdk/address';
import { TYPE_PREFIX } from './Vault';

import type { DotImplOptions } from './types';
import type Vault from './Vault';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  private async getChainInfo() {
    return this.engine.providerManager.getChainInfoByNetworkId(this.networkId);
  }

  private async getChainInfoImplOptions(): Promise<DotImplOptions> {
    const chainInfo = await this.getChainInfo();
    return chainInfo.implOptions as DotImplOptions;
  }

  override async addressFromBase(accountId: string) {
    const implOptions = await this.getChainInfoImplOptions();
    return accountIdToAddress(
      accountId,
      implOptions?.addressPrefix ?? 0,
    ).getValue();
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names } = params;
    const paths = indexes.map(
      (index) => `${HARDEN_PATH_PREFIX}/${index}'/0'/0'`,
    );
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const chainInfoImpl = await this.getChainInfoImplOptions();
    const chainId = await this.getNetworkChainId();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.polkadotGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
            prefix: chainInfoImpl.addressPrefix,
            network: chainId,
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

    const ret = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path, publicKey } = addressInfo;
      if (address) {
        const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;
        const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.VARIANT,
          path,
          coinType: COIN_TYPE,
          pub: publicKey || '',
          address: '',
          addresses: {},
        });
        index += 1;
      }
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const chainInfoImpl = await this.getChainInfoImplOptions();
    const chainId = await this.getNetworkChainId();

    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.polkadotGetAddress(connectId, deviceId, {
      path: params.path,
      prefix: chainInfoImpl.addressPrefix,
      network: chainId,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();

    const vault = this.vault as Vault;
    const chainId = await this.getNetworkChainId();

    const { rawTx: message } = await vault.serializeUnsignedTransaction(
      unsignedTx.payload.encodedTx,
    );

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.polkadotSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        network: chainId,
        rawTx: bytesToHex(message),
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature } = response.payload;

      const txSignature = u8aConcat(TYPE_PREFIX.ed25519, hexToBytes(signature));

      // Serialize a signed transaction.
      const tx = await vault.serializeSignedTransaction(
        unsignedTx.payload.encodedTx,
        bytesToHex(txSignature),
      );

      return Promise.resolve({
        txid: '',
        rawTx: tx,
        signature: addHexPrefix(bytesToHex(txSignature)),
      });
    }

    throw convertDeviceError(response.payload);
  }
}
