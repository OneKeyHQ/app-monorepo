import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';
import { buildEthereumDefinitionsForSignTx } from '@onekeyfe/hwk-trezor-adapter';

import {
  buildHardwareEvmTransaction,
  buildSignedTxFromSignatureEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessageEth,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import { thirdPartyPassphraseParamsFromDeviceParams } from '../../base/thirdPartyHardwareCommonParams';
import {
  buildTrezorBleFallbackOptions,
  callTrezorWithBleFallback,
  getTrezorAdapterFromBackgroundApi,
} from '../../base/trezorTransportUtils';

import { buildTrezorEvmTypedDataParams } from './trezorEvmTypedDataParams';

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

type ITrezorEvmSignMessageParams = Parameters<
  IThirdPartyHardwareAdapter['hw']['evmSignMessage']
>[2] & {
  chainId: number;
};

type ITrezorEvmSignTypedDataParams = Parameters<
  IThirdPartyHardwareAdapter['hw']['evmSignTypedData']
>[2] & {
  chainId: number;
};

export function buildTrezorEvmSignTransactionPayload({
  chainId,
  unsignedTx,
}: {
  chainId: number;
  unsignedTx: IUnsignedTxPro;
}) {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;
  const { hwTransaction: txParams, unsignedTx: tx } =
    buildHardwareEvmTransaction({
      ...encodedTx,
      chainId,
    });
  return {
    encodedTx,
    tx,
    txParams,
  };
}

export function buildTrezorEvmSignMessageParams(message: string) {
  const messageHex = hexUtils.isHexString(message)
    ? hexUtils.stripHexPrefix(message)
    : Buffer.from(message, 'utf-8').toString('hex');
  return {
    message: messageHex,
    hex: true,
  };
}

// Trezor EVM keyring. Mirrors KeyringHardwareLedger but drops the
// per-chain fingerprint dance — Trezor THP exposes a single device-wide
// identity, so connectId + path are enough on every call. The vendor
// shows up exactly once in `getAdapterForVendor(EHardwareVendor.trezor)`;
// the chain-method names are identical across vendors at the
// `IHardwareWallet` boundary.
export class KeyringHardwareTrezor extends KeyringHardwareBase {
  override coreApi = coreChainApi.evm.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'evm';

  private getBleFallbackOptions() {
    return buildTrezorBleFallbackOptions(this.backgroundApi);
  }

  // Best-effort: returns undefined on any failure so signing still proceeds.
  private async _resolveEvmDefinitions(params: {
    path: string;
    chainId: number;
    to?: string;
    data?: string;
  }) {
    try {
      return await buildEthereumDefinitionsForSignTx(params);
    } catch {
      return undefined;
    }
  }

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

        const adapter = await getTrezorAdapterFromBackgroundApi(
          this.backgroundApi,
        );
        const verifyChainId = params.isVerifyAddressAction
          ? Number(await this.getNetworkChainId())
          : undefined;
        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const path = buildPath({ index });

          const result = await callTrezorWithBleFallback(
            dbDevice,
            (connectId) =>
              adapter.hw.evmGetAddress(connectId, dbDevice.deviceId, {
                path,
                showOnDevice: params.isVerifyAddressAction ?? false,
                ...(verifyChainId !== undefined
                  ? { chainId: verifyChainId }
                  : {}),
                ...thirdPartyPassphraseParamsFromDeviceParams(
                  params.deviceParams,
                ),
              }),
            this.getBleFallbackOptions(),
          );

          if (!result.success) {
            throw convertThirdPartyDeviceError(result.payload, {
              vendor: 'Trezor',
              chain: 'EVM',
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
    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);

    const path = await this.vault.getAccountPath();
    const chainId = Number(await this.getNetworkChainId());
    const { encodedTx, tx, txParams } = buildTrezorEvmSignTransactionPayload({
      chainId,
      unsignedTx,
    });

    const ethereumDefinitions = await this._resolveEvmDefinitions({
      path,
      chainId,
      to: encodedTx.to,
      data: encodedTx.data,
    });

    const result = await callTrezorWithBleFallback(
      dbDevice,
      (connectId) =>
        adapter.hw.evmSignTransaction(connectId, dbDevice.deviceId, {
          path,
          ...txParams,
          ...(ethereumDefinitions ? { ethereumDefinitions } : {}),
          ...thirdPartyPassphraseParamsFromDeviceParams(deviceParams),
        }),
      this.getBleFallbackOptions(),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Trezor',
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

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { messages, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    // Sign sequentially — the Trezor SDK job queue rejects concurrent calls to
    // the same device (rejectIfBusy → DeviceBusy), so a parallel Promise.all
    // would make multi-message requests fail with spurious busy errors.
    const signatures: ISignedMessagePro = [];
    for (const message of messages) {
      // eslint-disable-next-line no-await-in-loop
      const signature = await this._handleSignMessage(
        message as IUnsignedMessageEth,
        checkedDeviceParams,
      );
      signatures.push(signature);
    }
    return signatures;
  }

  private async _handleSignMessage(
    message: IUnsignedMessageEth,
    deviceParams: NonNullable<ISignMessageParams['deviceParams']>,
  ): Promise<string> {
    if (
      message.type === EMessageTypesEth.TYPED_DATA_V1 ||
      message.type === EMessageTypesEth.ETH_SIGN
    ) {
      const reason = `Trezor does not support EVM ${message.type} message signing`;
      throw new ThirdPartyMethodNotSupported({
        payload: {
          code: ThirdPartyHwErrorCode.MethodNotSupported,
          message: reason,
        },
      });
    }

    const { dbDevice } = deviceParams;
    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);
    const path = await this.vault.getAccountPath();

    if (message.type === EMessageTypesEth.PERSONAL_SIGN) {
      return this._signPersonalMessage(
        adapter,
        dbDevice,
        path,
        message,
        deviceParams,
      );
    }

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V3 ||
      message.type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      return this._signTypedData(
        adapter,
        dbDevice,
        path,
        message,
        deviceParams,
      );
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
    deviceParams: NonNullable<ISignMessageParams['deviceParams']>,
  ): Promise<string> {
    const messageParams = buildTrezorEvmSignMessageParams(message.message);
    const chainId = Number(await this.getNetworkChainId());
    const sdkParams: ITrezorEvmSignMessageParams = {
      path,
      chainId,
      ...messageParams,
      ...thirdPartyPassphraseParamsFromDeviceParams(deviceParams),
    };

    const result = await callTrezorWithBleFallback(
      dbDevice,
      (connectId) =>
        adapter.hw.evmSignMessage(connectId, dbDevice.deviceId, sdkParams),
      this.getBleFallbackOptions(),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Trezor',
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
    deviceParams: NonNullable<ISignMessageParams['deviceParams']>,
  ): Promise<string> {
    const { data, metamaskV4Compat, domainSeparatorHash, messageHash } =
      buildTrezorEvmTypedDataParams(message);
    const chainId = Number(await this.getNetworkChainId());
    const sdkParams: ITrezorEvmSignTypedDataParams = {
      path,
      chainId,
      data,
      metamaskV4Compat,
      domainSeparatorHash,
      ...(messageHash ? { messageHash } : {}),
      ...thirdPartyPassphraseParamsFromDeviceParams(deviceParams),
    };

    const result = await callTrezorWithBleFallback(
      dbDevice,
      (connectId) =>
        adapter.hw.evmSignTypedData(connectId, dbDevice.deviceId, sdkParams),
      this.getBleFallbackOptions(),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Trezor',
        chain: 'EVM',
      });
    }
    return hexUtils.addHexPrefix(result.payload.signature || '');
  }

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
}
