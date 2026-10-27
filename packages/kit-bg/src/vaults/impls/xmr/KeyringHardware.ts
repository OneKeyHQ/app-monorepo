import { openXmrDeviceKeyImages } from '@onekeyhq/core/src/chains/xmr/deviceKeyImages';
import type {
  IXmrDeviceKeyImage,
  IXmrKeyImageTransfer,
} from '@onekeyhq/core/src/chains/xmr/deviceKeyImages';
import {
  getXmrSpendPublicKeyFromAddress,
  serializeXmrViewingKeyPair,
} from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { getXmrHardwareSdk } from './hardwareSdk';

import type { IXmrHardwareAddress } from './hardwareSdk';
import type Vault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

// The device only knows Monero's SEP-5 account path, the "OneKey" derivation.
export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.xmr.hd;

  private async getXmrSdk({ connectId }: { connectId: string }) {
    return getXmrHardwareSdk(await this.getHardwareSDKInstance({ connectId }));
  }

  private async getNetworkType(): Promise<0 | 1> {
    return (await (this.vault as Vault).getXmrNetwork()) === 'testnet' ? 1 : 0;
  }

  private async getDeviceAddresses(
    params: IPrepareHardwareAccountsParams,
    usedIndexes: number[],
  ): Promise<IXmrHardwareAddress[]> {
    const networkType = await this.getNetworkType();
    return this.baseGetDeviceAccountAddresses<IXmrHardwareAddress>({
      params,
      usedIndexes,
      sdkGetAddressFn: async ({
        connectId,
        deviceId,
        template,
        showOnOnekeyFn,
      }) => {
        const sdk = await this.getXmrSdk({ connectId });
        return sdk.moneroGetAddress(connectId, deviceId, {
          ...params.deviceParams.deviceCommonParams,
          bundle: usedIndexes.map((index, arrIndex) => ({
            path: accountUtils.buildPathFromTemplate({ template, index }),
            networkType,
            showOnOneKey: showOnOnekeyFn(arrIndex),
          })),
        });
      },
    });
  }

  override async batchGetAddresses(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IXmrHardwareAddress[]> {
    return this.getDeviceAddresses(params, params.indexes);
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const items = await this.getDeviceAddresses(params, usedIndexes);
        return items.map(
          ({ path, address }): ICoreApiGetAddressItem => ({
            address,
            path,
            // Same as HD accounts: the spend public key, here read off the device's address.
            publicKey: getXmrSpendPublicKeyFromAddress(address),
            __hwExtraInfo__: undefined,
          }),
        );
      },
    });
  }

  // Viewing material from the device, checked to belong to this account.
  async xmrGetViewingKeyFromDevice({
    deviceParams,
  }: {
    deviceParams: IDeviceSharedCallParams;
  }): Promise<string> {
    const account = await this.vault.getAccount();
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getXmrSdk({ connectId });
    const response = await sdk.moneroGetWatchKey(connectId, deviceId, {
      ...deviceParams.deviceCommonParams,
      path: account.path,
      networkType: await this.getNetworkType(),
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    if (response.payload.address !== account.address) {
      throw new OneKeyLocalError('xmr: device does not hold this account');
    }
    return serializeXmrViewingKeyPair({
      spendPublicKeyHex: getXmrSpendPublicKeyFromAddress(account.address),
      viewPrivateKeyHex: response.payload.watchKey,
    });
  }

  // Key images for scanned outputs, computed on the device of this account;
  // one entry per transfer, in order.
  async xmrGetKeyImagesFromDevice({
    deviceParams,
    transfers,
  }: {
    deviceParams: IDeviceSharedCallParams;
    transfers: IXmrKeyImageTransfer[];
  }): Promise<IXmrDeviceKeyImage[]> {
    const account = await this.vault.getAccount();
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getXmrSdk({ connectId });
    const response = await sdk.moneroKeyImageSync(connectId, deviceId, {
      ...deviceParams.deviceCommonParams,
      path: account.path,
      networkType: await this.getNetworkType(),
      transfers: transfers.map((transfer) => ({
        outKey: transfer.outKey,
        txPubKey: transfer.txPubKey,
        additionalTxPubKeys: transfer.additionalTxPubKey
          ? [transfer.additionalTxPubKey]
          : undefined,
        internalOutputIndex: transfer.internalOutputIndex,
        subAddrMajor: transfer.subAddrMajor,
        subAddrMinor: transfer.subAddrMinor,
      })),
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return openXmrDeviceKeyImages(response.payload);
  }

  override async signTransaction(
    _params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    // Device signing is the next stage of Monero hardware support.
    throw new NotImplemented();
  }

  override async signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // Monero has no signed-message format the ecosystem agrees on.
    throw new NotImplemented();
  }
}
