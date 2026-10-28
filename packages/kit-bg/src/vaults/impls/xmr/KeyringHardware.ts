// cspell:ignore clsags randMult
import { isEqual } from 'lodash';

import { openXmrDeviceKeyImages } from '@onekeyhq/core/src/chains/xmr/deviceKeyImages';
import type {
  IXmrDeviceKeyImage,
  IXmrKeyImageTransfer,
} from '@onekeyhq/core/src/chains/xmr/deviceKeyImages';
import {
  openXmrDeviceSignatures,
  parseXmrAssembledTransaction,
  parseXmrDevicePlan,
} from '@onekeyhq/core/src/chains/xmr/deviceSigning';
import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
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
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { getXmrHardwareSdk } from './hardwareSdk';

import type { IXmrHardwareAddress } from './hardwareSdk';
import type Vault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

// The device only knows Monero's SEP-5 account path, the "OneKey" derivation.
export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.xmr.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'xmr';

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

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      chainName: await (this.vault as Vault).getXmrNetwork(),
      showOnOneKey: false,
    };
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const items = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({ template }) => {
            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: ({ index }) =>
                accountUtils.buildPathFromTemplate({ template, index }),
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
                __hwExtraInfo__: undefined,
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }
            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');
          },
        });
        return items.map(
          ({ path, address, __hwExtraInfo__ }): ICoreApiGetAddressItem => ({
            address,
            path,
            // Same as HD accounts: the spend public key, here read off the device's address.
            publicKey: getXmrSpendPublicKeyFromAddress(address),
            __hwExtraInfo__,
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

  // The device shows the payment and builds the outputs; the runtime then
  // assembles the transaction and verifies it against the plan.
  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = parseXmrTransaction(params.unsignedTx.encodedTx);
    if (encodedTx.devicePlanJson === undefined) {
      throw new OneKeyLocalError(
        'xmr: this transaction was not built for a hardware device',
      );
    }
    const account = await this.vault.getAccount();
    if (encodedTx.from !== account.address) {
      throw new OneKeyLocalError(
        'xmr: transaction sender does not match the signing account',
      );
    }
    const networkType = await this.getNetworkType();
    const plan = parseXmrDevicePlan(encodedTx.devicePlanJson);
    const planned = {
      networkType: plan.networkType,
      fee: plan.expected.fee,
      amount: plan.expected.recipientAmount,
      change: plan.expected.changeAmount,
    };
    const reviewed = {
      networkType,
      fee: encodedTx.feeAtomic,
      amount: encodedTx.amountAtomic,
      change: encodedTx.changeAtomic,
    };
    if (!isEqual(planned, reviewed)) {
      throw new OneKeyLocalError(
        'xmr: the device signing plan does not match the review',
      );
    }

    const { dbDevice, deviceCommonParams } = checkIsDefined(
      params.deviceParams,
    );
    const { connectId, deviceId } = dbDevice;
    const sdk = await this.getXmrSdk({ connectId });
    const response = await sdk.moneroSignTransaction(connectId, deviceId, {
      ...deviceCommonParams,
      path: account.path,
      networkType,
      tsxData: plan.tsxData,
      inputs: plan.inputs,
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    // The opening key stops here; only the opened signatures go on. The
    // sealed tx keys go to the sent record instead (see Vault.signTransaction).
    const { signatures, openingKey, salt, randMult, txEncKeys, ...parts } =
      response.payload;
    const clsags = openXmrDeviceSignatures({ openingKey, signatures });
    const api = await (this.vault as Vault).getXmrRuntimeApi();
    const assembled = parseXmrAssembledTransaction(
      await api.assembleDeviceTransaction(
        encodedTx.devicePlanJson,
        stringUtils.stableStringify({ ...parts, clsags }),
      ),
    );
    return {
      txid: assembled.txid,
      rawTx: assembled.rawHex,
      encodedTx,
      // The runtime checked the transaction against this prefix hash.
      xmrSentTxKeys: {
        device: { salt, randMult, txEncKeys, txPrefixHash: parts.txPrefixHash },
      },
    };
  }

  override async signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // Monero has no signed-message format the ecosystem agrees on.
    throw new NotImplemented();
  }
}
