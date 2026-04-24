import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import {
  buildSignedTxFromSignatureEvm,
  packUnsignedTxForSignEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessage,
  IUnsignedMessageEth,
} from '@onekeyhq/core/src/types';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import {
  callLedgerWithFingerprint,
  ensureLedgerChainFingerprint,
} from '../../base/ledgerFingerprintUtils';

import type { IDBAccount, IDBDevice } from '../../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../../../services/ServiceHardware/adapters/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';
import type { EvmSignature } from '@onekeyfe/hwk-adapter-core';

export class KeyringHardwareLedger extends KeyringHardwareBase {
  override coreApi = coreChainApi.evm.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'evm';

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { dbDevice } = params.deviceParams;
        const { template } = params.deriveInfo;

        const adapter =
          await this.backgroundApi.serviceHardware.getAdapterForVendor(
            EHardwareVendor.ledger,
          );

        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const path = accountUtils.buildPathFromTemplate({
            template,
            index,
          });

          let address: string | null = null;
          if (adapter) {
            const result = await callLedgerWithFingerprint(
              this.backgroundApi,
              dbDevice,
              'evm',
              (deviceId) =>
                adapter.hw.evmGetAddress(dbDevice.connectId, deviceId, {
                  path,
                  showOnDevice: params.isVerifyAddressAction ?? false,
                }),
            );
            if (result.success) {
              address = result.payload.address;
            } else {
              throw convertThirdPartyDeviceError(result.payload, {
                vendor: 'Ledger',
                chain: 'EVM',
              });
            }
          } else {
            const effectiveDeviceId = await ensureLedgerChainFingerprint(
              this.backgroundApi,
              dbDevice,
              'evm',
            );
            address =
              await this.backgroundApi.serviceHardware.getEvmAddressByStandardWallet(
                {
                  connectId: dbDevice.connectId,
                  deviceId: effectiveDeviceId,
                  path,
                  vendor: EHardwareVendor.ledger,
                },
              );
          }

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

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const path = await this.vault.getAccountPath();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;

    // Pack and RLP-serialize the unsigned transaction
    const { tx, serializedTx } = packUnsignedTxForSignEvm(unsignedTx);

    const result = await callLedgerWithFingerprint(
      this.backgroundApi,
      dbDevice,
      'evm',
      (deviceId) =>
        adapter.hw.evmSignTransaction(dbDevice.connectId, deviceId, {
          path,
          serializedTx,
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'EVM',
      });
    }

    const { v, r, s } = result.payload;
    const { rawTx, txid } = buildSignedTxFromSignatureEvm({
      tx,
      signature: { v, r, s },
    });

    return { txid, rawTx, encodedTx };
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    return Promise.all(
      messages.map(async (message: IUnsignedMessage) =>
        this._handleSignMessage(
          message as IUnsignedMessageEth,
          checkedDeviceParams,
        ),
      ),
    );
  }

  private async _handleSignMessage(
    message: IUnsignedMessageEth,
    deviceParams: NonNullable<ISignMessageParams['deviceParams']>,
  ): Promise<string> {
    const { dbDevice } = deviceParams;

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const path = await this.vault.getAccountPath();

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V1 ||
      message.type === EMessageTypesEth.ETH_SIGN
    ) {
      throw new NotImplemented();
    }

    if (message.type === EMessageTypesEth.PERSONAL_SIGN) {
      return this._signPersonalMessage(adapter, dbDevice, path, message);
    }

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V3 ||
      message.type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      return this._signTypedData(adapter, dbDevice, path, message);
    }

    throw web3Errors.rpc.methodNotFound(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Sign message method=${message.type} not found`,
    );
  }

  private async _signPersonalMessage(
    adapter: IThirdPartyHardwareAdapter,
    dbDevice: IDBDevice,
    path: string,
    message: IUnsignedMessageEth,
  ): Promise<string> {
    // Convert message to hex (same logic as OneKey KeyringHardware)
    let messageHex = message.message;
    if (!hexUtils.isHexString(message.message)) {
      messageHex = Buffer.from(message.message, 'utf-8').toString('hex');
    }

    const result = await callLedgerWithFingerprint<EvmSignature>(
      this.backgroundApi,
      dbDevice,
      'evm',
      (deviceId) =>
        adapter.hw.evmSignMessage(dbDevice.connectId, deviceId, {
          path,
          message: messageHex,
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'EVM',
      });
    }
    return hexUtils.addHexPrefix(result.payload.signature || '');
  }

  private async _signTypedData(
    adapter: IThirdPartyHardwareAdapter,
    dbDevice: IDBDevice,
    path: string,
    message: IUnsignedMessageEth,
  ): Promise<string> {
    const useV4 = message.type === EMessageTypesEth.TYPED_DATA_V4;
    const data = JSON.parse(message.message);

    const result = await callLedgerWithFingerprint<EvmSignature>(
      this.backgroundApi,
      dbDevice,
      'evm',
      (deviceId) =>
        adapter.hw.evmSignTypedData(dbDevice.connectId, deviceId, {
          path,
          data,
          metamaskV4Compat: !!useV4,
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'EVM',
      });
    }
    return hexUtils.addHexPrefix(result.payload.signature || '');
  }

  override async buildHwAllNetworkPrepareAccountsParams(
    _params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return undefined;
  }
}
