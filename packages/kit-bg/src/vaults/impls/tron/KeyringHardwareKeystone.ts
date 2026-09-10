import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EMessageTypesTron } from '@onekeyhq/shared/types/message';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import { thirdPartyConnectionContextFromDevice } from '../../base/thirdPartyHardwareCommonParams';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../../../services/ServiceHardware/adapters/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

const VENDOR_ERROR_CONTEXT = { vendor: 'Keystone', chain: 'Tron' } as const;

/** See KeyringHardwareKeystone (evm) for why this needs no fingerprint dance. */
export class KeyringHardwareKeystone extends KeyringHardwareBase {
  override coreApi = coreChainApi.tron.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'tron';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
    };
  }

  private async _getAdapter(): Promise<IThirdPartyHardwareAdapter> {
    const adapter =
      await this.backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
        EHardwareVendor.keystone,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Keystone adapter not available');
    }
    return adapter;
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { template } = params.deriveInfo;
        const allNetworkAccounts =
          await this.getAllNetworkPrepareAccounts<ICoreApiGetAddressItem>({
            params,
            usedIndexes,
            hwSdkNetwork: this.hwSdkNetwork,
            buildPath: ({ index }) =>
              accountUtils.buildPathFromTemplate({ template, index }),
            buildResultAccount: ({ account }) => ({
              address: account.payload?.address ?? '',
              path: account.path,
              publicKey: '',
              __hwExtraInfo__: undefined,
            }),
          });
        if (!allNetworkAccounts) {
          throw new OneKeyLocalError(
            'Keystone account preparation requires an all-network response',
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        for (const account of allNetworkAccounts.payload) {
          const { address, path } = account;
          if (address) {
            const { normalizedAddress } =
              await this.vault.validateAddress(address);
            ret.push({
              address: normalizedAddress || address,
              path,
              publicKey: account.publicKey,
              __hwExtraInfo__: account.__hwExtraInfo__,
            });
          }
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;
    const adapter = await this._getAdapter();

    const path = await this.vault.getAccountPath();
    const rawTxHex = encodedTx.raw_data_hex;
    if (!rawTxHex) {
      throw new OneKeyLocalError(
        'Missing raw_data_hex in TRON encoded transaction',
      );
    }

    const result = await adapter.hw.tronSignTransaction(
      checkedDeviceParams.deviceCommonParams?.interactionId ??
        dbDevice.connectId,
      dbDevice.deviceId,
      {
        ...thirdPartyConnectionContextFromDevice(dbDevice),
        ...(checkedDeviceParams.deviceCommonParams?.interactionId
          ? {
              interactionId:
                checkedDeviceParams.deviceCommonParams.interactionId,
            }
          : {}),
        path,
        rawTxHex,
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const { signature } = result.payload;
    return {
      txid: encodedTx.txID,
      encodedTx,
      rawTx: stringUtils.stableStringify({
        ...encodedTx,
        signature: [signature],
      }),
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const account = await this.vault.getAccount();
    const adapter = await this._getAdapter();
    const interactionId = checkedDeviceParams.deviceCommonParams?.interactionId;

    const signatures: ISignedMessagePro = [];
    for (const message of messages) {
      // Firmware implements TIP-191 signMessageV2 only.
      if (message.type !== EMessageTypesTron.SIGN_MESSAGE_V2) {
        throw new ThirdPartyMethodNotSupported();
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await adapter.hw.tronSignMessage(
        interactionId ?? dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...thirdPartyConnectionContextFromDevice(dbDevice),
          ...(interactionId ? { interactionId } : {}),
          path: account.path,
          messageHex: message.message,
          messageType: 'V2',
        },
      );
      if (!result.success) {
        throw convertThirdPartyDeviceError(
          result.payload,
          VENDOR_ERROR_CONTEXT,
        );
      }
      signatures.push(hexUtils.addHexPrefix(result.payload.signature));
    }
    return signatures;
  }
}
