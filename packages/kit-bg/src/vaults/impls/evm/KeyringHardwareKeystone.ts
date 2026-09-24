import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import BigNumber from 'bignumber.js';

import { hashMessage } from '@onekeyhq/core/src/chains/evm/message';
import {
  buildSignedTxFromSignatureEvm,
  packUnsignedTxForSignEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import { verifyEvmSignedTxMatched } from '@onekeyhq/core/src/chains/evm/sdkEvm/verify';
import type { IVerifyEvmSignedTxMatchedParams } from '@onekeyhq/core/src/chains/evm/sdkEvm/verify';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessageEth,
} from '@onekeyhq/core/src/types';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ThirdPartyDeviceMismatch } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
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
 * Keystone EVM keyring: no per-chain app or ephemeral connectId, since
 * deviceId is the wallet's master fingerprint across QR and USB, and doubles as
 * the xfp every sign request carries. Pass DB connectId/deviceId when known.
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

  // Keystone derives addresses locally, so a device-mode verification would
  // mark an address the device never displayed as verified. Refuse it and let
  // the UI fall back to manual comparison. Same guard as btc.
  override async batchGetAddresses(
    params: IPrepareHardwareAccountsParams,
  ): Promise<{ address: string; path: string }[]> {
    if (params.isVerifyAddressAction) {
      throw new OneKeyLocalError({
        message:
          'Keystone address verification requires manual derivation-path confirmation',
      });
    }
    return [];
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
      checkedDeviceParams.deviceCommonParams?.operationId ?? dbDevice.connectId,
      dbDevice.deviceId,
      {
        ...thirdPartyConnectionContextFromDevice(dbDevice),
        ...(checkedDeviceParams.deviceCommonParams?.operationId
          ? {
              operationId: checkedDeviceParams.deviceCommonParams.operationId,
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
    const signature = { v, r, s };
    const { rawTx, txid } = buildSignedTxFromSignatureEvm({
      tx,
      signature,
    });
    this._assertSignatureMatchesSigner({
      signerAddress: encodedTx.from,
      rawTx,
      txid,
      signature,
    });
    return { txid, rawTx, encodedTx };
  }

  // Keystone answers over QR, so nothing online proves the scan came from this
  // wallet. Reject a signature that does not recover to the account address.
  private _assertSignatureMatchesSigner(
    params: IVerifyEvmSignedTxMatchedParams,
  ) {
    try {
      verifyEvmSignedTxMatched(params);
    } catch {
      throw new ThirdPartyDeviceMismatch({
        vendor: VENDOR_ERROR_CONTEXT.vendor,
        autoToast: true,
        payload: {},
      });
    }
  }

  private _assertMessageSignatureMatchesSigner({
    digest,
    signature,
    signerAddress,
  }: {
    digest: string;
    signature: string;
    signerAddress: string;
  }) {
    try {
      const recoveredAddress = ethers.utils.recoverAddress(digest, signature);
      if (recoveredAddress.toLowerCase() === signerAddress.toLowerCase()) {
        return;
      }
    } catch {
      // Malformed signatures must follow the same rejection path as mismatches.
    }
    throw new ThirdPartyDeviceMismatch({
      vendor: VENDOR_ERROR_CONTEXT.vendor,
      autoToast: true,
      payload: {},
    });
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
        checkedDeviceParams.deviceCommonParams?.operationId,
      );
      signatures.push(signature);
    }
    return signatures;
  }

  private async _handleSignMessage(
    message: IUnsignedMessageEth,
    dbDevice: IDBDevice,
    operationId?: string,
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
      // personal_sign payloads are not reliably hex, so encode ourselves and
      // always send `hex: true` (same as KeyringHardware/KeyringHardwareLedger); otherwise the SDK's stripHex() signs over garbage.
      const messageHex = hexUtils.isHexString(message.message)
        ? message.message
        : Buffer.from(message.message, 'utf-8').toString('hex');
      if (hexUtils.stripHexPrefix(messageHex).length % 2 !== 0) {
        throw web3Errors.rpc.invalidParams(
          'personal_sign message must contain complete hex bytes',
        );
      }
      const signerAddress = await this.vault.getAccountAddress();
      const digest = hashMessage({
        messageType: EMessageTypesEth.PERSONAL_SIGN,
        message: hexUtils.addHexPrefix(messageHex),
      });
      const result = await adapter.hw.evmSignMessage(
        operationId ?? dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...thirdPartyConnectionContextFromDevice(dbDevice),
          ...(operationId ? { operationId } : {}),
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
      this._assertMessageSignatureMatchesSigner({
        digest,
        signature: result.payload.signature,
        signerAddress,
      });
      return result.payload.signature;
    }

    if (
      message.type === EMessageTypesEth.TYPED_DATA_V3 ||
      message.type === EMessageTypesEth.TYPED_DATA_V4
    ) {
      const signerAddress = await this.vault.getAccountAddress();
      const data = JSON.parse(message.message) as EvmSignTypedDataFull['data'];
      // Preserve unsafe integer literals for hashing the exact JSON sent to the
      // device. Match whole strings first so numeric text stays untouched.
      const verificationData = JSON.parse(
        message.message.replace(
          /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
          (token) => {
            if (token.startsWith('"') || !Number.isFinite(Number(token))) {
              return token;
            }
            const value = new BigNumber(token);
            return value.isInteger() && !Number.isSafeInteger(Number(token))
              ? `"${value.toFixed()}"`
              : token;
          },
        ),
      ) as Record<string, unknown>;
      const digest = hashMessage({
        messageType: message.type,
        message: verificationData,
      });
      // Full-payload mode only: Keystone always renders the whole EIP-712
      // struct for on-device review and rejects pre-hashed (`mode: 'hash'`)
      // signing outright.
      const result = await adapter.hw.evmSignTypedData(
        operationId ?? dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...thirdPartyConnectionContextFromDevice(dbDevice),
          ...(operationId ? { operationId } : {}),
          path,
          data,
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
      this._assertMessageSignatureMatchesSigner({
        digest,
        signature: result.payload.signature,
        signerAddress,
      });
      return result.payload.signature;
    }

    throw web3Errors.rpc.methodNotFound(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Sign message method=${message.type} not found`,
    );
  }
}
