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
import { thirdPartyConnectionContextFromDevice } from '../../base/thirdPartyHardwareCommonParams';

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
import type { EvmSignTypedDataFull } from '@onekeyfe/hwk-adapter-core';

const VENDOR_ERROR_CONTEXT = { vendor: 'Keystone', chain: 'EVM' } as const;

/**
 * Keystone EVM keyring.
 *
 * Much thinner than the Ledger one: Keystone has no per-chain app to open and
 * no ephemeral public connectId, so there is no
 * `callLedgerWithFingerprint` dance — `deviceId` is a stable, public-key-
 * derived wallet id across QR and USB. The short master fingerprint remains
 * internal BC-UR metadata, so calls go straight to the adapter.
 *
 * The adapter tolerates null connectId/deviceId (it cold-starts its own QR
 * sync when a wallet isn't known yet), but we always pass what the DB has so
 * a wallet already synced over either channel is reused instead of re-synced.
 */
export class KeyringHardwareKeystone extends KeyringHardwareBase {
  override coreApi = coreChainApi.evm.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'evm';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    const chainId = await this.getNetworkChainId();

    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
      chainName: chainId,
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
    const adapter = await this._getAdapter();

    const path = await this.vault.getAccountPath();
    const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;
    const { tx, serializedTx } = packUnsignedTxForSignEvm(unsignedTx);

    const result = await adapter.hw.evmSignTransaction(
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
        serializedTx,
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const { v, r, s } = result.payload;
    const { rawTx, txid } = buildSignedTxFromSignatureEvm({
      tx,
      signature: { v, r, s },
    });
    return { txid, rawTx, encodedTx };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const signatures: ISignedMessagePro = [];
    for (const message of messages) {
      // eslint-disable-next-line no-await-in-loop
      const signature = await this._handleSignMessage(
        message as IUnsignedMessageEth,
        checkedDeviceParams.dbDevice,
        checkedDeviceParams.deviceCommonParams?.interactionId,
      );
      signatures.push(signature);
    }
    return signatures;
  }

  private async _handleSignMessage(
    message: IUnsignedMessageEth,
    dbDevice: IDBDevice,
    interactionId?: string,
  ): Promise<string> {
    const adapter = await this._getAdapter();
    const path = await this.vault.getAccountPath();

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V1 ||
      message.type === EMessageTypesEth.ETH_SIGN
    ) {
      throw new NotImplemented();
    }

    if (message.type === EMessageTypesEth.PERSONAL_SIGN) {
      // personal_sign payloads are NOT reliably hex — a dApp may pass a plain
      // string. Encode it ourselves and always send `hex: true`, same as
      // OneKey's own KeyringHardware and KeyringHardwareLedger; passing a
      // non-hex string with `hex: true` makes the SDK stripHex() it and sign
      // over garbage.
      const messageHex = hexUtils.isHexString(message.message)
        ? message.message
        : Buffer.from(message.message, 'utf-8').toString('hex');
      const result = await adapter.hw.evmSignMessage(
        interactionId ?? dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...thirdPartyConnectionContextFromDevice(dbDevice),
          ...(interactionId ? { interactionId } : {}),
          path,
          message: messageHex,
          hex: true,
        },
      );
      if (!result.success) {
        throw convertThirdPartyDeviceError(
          result.payload,
          VENDOR_ERROR_CONTEXT,
        );
      }
      return result.payload.signature;
    }

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V3 ||
      message.type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      // Full-payload mode only: Keystone always renders the whole EIP-712
      // struct for on-device review and rejects pre-hashed (`mode: 'hash'`)
      // signing outright.
      const result = await adapter.hw.evmSignTypedData(
        interactionId ?? dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...thirdPartyConnectionContextFromDevice(dbDevice),
          ...(interactionId ? { interactionId } : {}),
          path,
          data: JSON.parse(message.message) as EvmSignTypedDataFull['data'],
          // Keystone signs the serialized payload, so send the dApp's own
          // bytes: a JSON.parse/stringify round trip would rewrite integer
          // literals wider than 2^53 before the device ever displays them.
          dataJson: message.message,
        },
      );
      if (!result.success) {
        throw convertThirdPartyDeviceError(
          result.payload,
          VENDOR_ERROR_CONTEXT,
        );
      }
      return result.payload.signature;
    }

    throw web3Errors.rpc.methodNotFound(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Sign message method=${message.type} not found`,
    );
  }
}
