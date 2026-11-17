import TronWeb from 'tronweb';

import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyDeviceMismatch,
  ThirdPartyMethodNotSupported,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
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

/** No per-chain app or ephemeral connectId, so no Ledger-style fingerprint check is needed; deviceId is a stable wallet id. */
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

  private _assertSignatureMatchesSigner({
    digest,
    signature,
    signerAddress,
  }: {
    digest: string;
    signature: string;
    signerAddress: string;
  }) {
    try {
      const recovery = Number.parseInt(signature.slice(-2), 16);
      if (
        hexUtils.isHexString(signature, 65) &&
        [0, 1, 27, 28].includes(recovery)
      ) {
        const recoveredAddress = TronWeb.utils.crypto.ecRecover(
          digest,
          signature,
        );
        // The selected permission key may differ from the transaction owner.
        if (
          recoveredAddress.toLowerCase() ===
          TronWeb.utils.address.toHex(signerAddress).toLowerCase()
        ) {
          return;
        }
      }
    } catch {
      // Invalid signatures must use the same error path as signer mismatches.
    }
    throw new ThirdPartyDeviceMismatch({
      vendor: VENDOR_ERROR_CONTEXT.vendor,
      autoToast: true,
      payload: {},
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

    if (
      !hexUtils.isHexString(rawTxHex) ||
      hexUtils.stripHexPrefix(rawTxHex).length % 2 !== 0
    ) {
      throw new OneKeyLocalError('Invalid TRON raw_data_hex');
    }
    const digest = (
      await appCrypto.hash.sha256(
        Buffer.from(hexUtils.stripHexPrefix(rawTxHex), 'hex'),
      )
    ).toString('hex');
    if (digest !== encodedTx.txID?.toLowerCase()) {
      throw new OneKeyLocalError(
        'TRON transaction ID does not match raw_data_hex',
      );
    }
    const signerAddress = await this.vault.getAccountAddress();

    const result = await adapter.hw.tronSignTransaction(
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
        rawTxHex,
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const { signature } = result.payload;
    this._assertSignatureMatchesSigner({ digest, signature, signerAddress });
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
    // Firmware implements TIP-191 signMessageV2 only. Pre-check the whole
    // batch: a mixed batch must not put the first message on the device
    // before rejecting a later unsupported one.
    if (
      messages.some(
        (message) => message.type !== EMessageTypesTron.SIGN_MESSAGE_V2,
      )
    ) {
      throw new ThirdPartyMethodNotSupported();
    }
    if (
      messages.some(
        (message) =>
          !hexUtils.isHexString(message.message) ||
          hexUtils.stripHexPrefix(message.message).length % 2 !== 0,
      )
    ) {
      throw new OneKeyLocalError(
        'TRON messages must contain complete hex bytes',
      );
    }
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const account = await this.vault.getAccount();
    const adapter = await this._getAdapter();
    const operationId = checkedDeviceParams.deviceCommonParams?.operationId;

    const signatures: ISignedMessagePro = [];
    for (const message of messages) {
      const digest = TronWeb.utils.message.hashMessage(
        Buffer.from(hexUtils.stripHexPrefix(message.message), 'hex'),
      );
      // eslint-disable-next-line no-await-in-loop
      const result = await adapter.hw.tronSignMessage(
        operationId ?? dbDevice.connectId,
        dbDevice.deviceId,
        {
          ...thirdPartyConnectionContextFromDevice(dbDevice),
          ...(operationId ? { operationId } : {}),
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
      this._assertSignatureMatchesSigner({
        digest,
        signature: result.payload.signature,
        signerAddress: account.address,
      });
      signatures.push(hexUtils.addHexPrefix(result.payload.signature));
    }
    return signatures;
  }
}
