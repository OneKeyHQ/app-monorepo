import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import {
  callLedgerWithFingerprint,
  ledgerCommonCallParamsForCreateScene,
} from '../../base/ledgerFingerprintUtils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export class KeyringHardwareLedger extends KeyringHardwareBase {
  override coreApi = coreChainApi.tron.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'tron';

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { dbDevice } = params.deviceParams;
        const { template } = params.deriveInfo;

        const buildPath = ({ index }: { index: number }) =>
          accountUtils.buildPathFromTemplate({
            template,
            index,
          });
        const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
          params,
          usedIndexes,
          buildPath,
          buildResultAccount: ({ account }) => ({
            address: account.payload?.address || '',
            path: account.path,
            publicKey: '',
            __hwExtraInfo__: {
              rootFingerprint: account.payload?.rootFingerprint,
            },
          }),
          hwSdkNetwork: this.hwSdkNetwork,
        });
        if (allNetworkAccounts) {
          return allNetworkAccounts.payload;
        }

        const adapter =
          await this.backgroundApi.serviceHardware.getAdapterForVendor(
            EHardwareVendor.ledger,
          );
        if (!adapter) {
          throw new OneKeyLocalError('Ledger adapter not available');
        }

        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const path = buildPath({ index });

          const result = await callLedgerWithFingerprint(
            this.backgroundApi,
            dbDevice,
            'tron',
            (deviceId) =>
              adapter.hw.tronGetAddress(
                dbDevice.connectId,
                deviceId,
                {
                  path,
                  showOnDevice: params.isVerifyAddressAction ?? false,
                },
                // per-call HW options derived from the account-creation scene
                ledgerCommonCallParamsForCreateScene(params),
              ),
          );

          if (!result.success) {
            throw convertThirdPartyDeviceError(result.payload, {
              vendor: 'Ledger',
              chain: 'Tron',
            });
          }

          const address = result.payload.address;
          if (address) {
            const { normalizedAddress } =
              await this.vault.validateAddress(address);
            ret.push({
              address: normalizedAddress || address,
              path,
              publicKey: '',
              __hwExtraInfo__: {
                rootFingerprint: 0,
              },
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
    const { dbDevice } = checkIsDefined(deviceParams);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const path = await this.vault.getAccountPath();

    // Ledger TRON App signs the raw protobuf-encoded transaction directly
    const rawTxHex = encodedTx.raw_data_hex;
    if (!rawTxHex) {
      throw new OneKeyLocalError(
        'Missing raw_data_hex in TRON encoded transaction',
      );
    }

    const result = await callLedgerWithFingerprint(
      this.backgroundApi,
      dbDevice,
      'tron',
      (deviceId) =>
        adapter.hw.tronSignTransaction(dbDevice.connectId, deviceId, {
          path,
          rawTxHex,
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'Tron',
      });
    }

    // Ledger returns 65-byte signature hex
    const signature = result.payload.signature;

    return {
      txid: encodedTx.txID,
      encodedTx,
      rawTx: JSON.stringify({
        ...encodedTx,
        signature: [signature],
      }),
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    const { dbDevice } = checkIsDefined(deviceParams);
    const account = await this.vault.getAccount();

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    return Promise.all(
      messages.map(async (e) => {
        const result = await callLedgerWithFingerprint(
          this.backgroundApi,
          dbDevice,
          'tron',
          (deviceId) =>
            adapter.hw.tronSignMessage(dbDevice.connectId, deviceId, {
              path: account.path,
              messageHex: e.message,
            }),
        );

        if (!result.success) {
          throw convertThirdPartyDeviceError(result.payload, {
            vendor: 'Ledger',
            chain: 'Tron',
          });
        }

        return hexUtils.addHexPrefix(result.payload.signature);
      }),
    );
  }

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
    };
  }
}
