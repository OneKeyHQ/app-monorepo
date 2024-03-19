import { blockchain } from '@ckb-lumos/base';
import {
  createTransactionFromSkeleton,
  sealTransaction,
} from '@ckb-lumos/helpers';
import { bytesToHex } from '@noble/hashes/utils';

import {
  OneKeyHardwareError,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { KeyringHardwareBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringHardwareBase';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '@onekeyhq/engine/src/vaults/types';
import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  IMPL_NERVOS as COIN_IMPL,
  COINTYPE_NERVOS as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getConfig } from './utils/config';
import {
  convertEncodeTxNervosToSkeleton,
  fillSkeletonWitnessesWithAccount,
  serializeTransactionMessage,
} from './utils/transaction';

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names, template } = params;
    const { pathPrefix } = slicePathTemplate(template);
    const paths = indexes.map((index) => `${pathPrefix}/${index}`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const config = getConfig(await this.getNetworkChainId());

    const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.nervosGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
            network: config.PREFIX,
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

    const ret: DBSimpleAccount[] = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path } = addressInfo;
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: '',
        address,
      });
      index += 1;
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const config = getConfig(await this.getNetworkChainId());

    const response = await HardwareSDK.nervosGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      network: config.PREFIX,
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

    const config = getConfig(await this.getNetworkChainId());

    const response = await HardwareSDK.nervosGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
        network: config.PREFIX,
      })),
    });

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.map((item) => ({
      path: item.path,
      address: item.address,
    }));
  }

  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();

    const chainId = await this.getNetworkChainId();
    const config = getConfig(chainId);

    let txSkeleton = convertEncodeTxNervosToSkeleton({
      encodedTxNervos: unsignedTx.payload.encodedTx,
      config,
    });
    txSkeleton = fillSkeletonWitnessesWithAccount({
      sendAccount: dbAccount.address,
      txSkeleton,
      config: getConfig(chainId),
    });
    const { txSkeleton: txSkeletonWithMessage } =
      serializeTransactionMessage(txSkeleton);

    const witnessHex = txSkeleton.witnesses.get(0);
    if (!witnessHex) {
      throw new OneKeyInternalError('Transaction serialization failure');
    }

    const transaction = createTransactionFromSkeleton(txSkeleton);
    const serialize = blockchain.RawTransaction.pack(transaction);

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const HardwareSDK = await this.getHardwareSDKInstance();

    const response = await HardwareSDK.nervosSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        network: config.PREFIX,
        rawTx: bytesToHex(serialize),
        witnessHex,
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature } = response.payload;

      const tx = sealTransaction(txSkeletonWithMessage, [
        addHexPrefix(signature),
      ]);

      const rawTx = bytesToHex(blockchain.Transaction.pack(tx));

      return {
        txid: '',
        rawTx,
      };
    }

    throw convertDeviceError(response.payload);
  }
}
