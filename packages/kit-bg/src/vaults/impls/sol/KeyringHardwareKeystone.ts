import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { verify as verifyCurveSignature } from '@onekeyhq/core/src/secret';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyDeviceMismatch,
  ThirdPartyMethodNotSupported,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

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

const VENDOR_ERROR_CONTEXT = { vendor: 'Keystone', chain: 'Solana' } as const;

/** No per-chain app or ephemeral connectId, so no Ledger-style fingerprint check is needed; deviceId is a stable wallet id. */
export class KeyringHardwareKeystone extends KeyringHardwareBase {
  override coreApi = coreChainApi.sol.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'sol';

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

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const { feePayer } = unsignedTx.payload as { feePayer: string };
    const feePayerPublicKey = new PublicKey(feePayer);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;
    const adapter = await this._getAdapter();

    const path = await this.vault.getAccountPath();
    const transaction = parseToNativeTx(encodedTx);
    if (!transaction) {
      throw new OneKeyLocalError('Failed to parse SOL transaction');
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;
    const rawTx = isVersionedTransaction
      ? Buffer.from(transaction.message.serialize()).toString('hex')
      : transaction.serializeMessage().toString('hex');

    const result = await adapter.hw.solSignTransaction(
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
        serializedTx: rawTx,
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const { signature } = result.payload;
    const signatureBuffer = Buffer.from(signature, 'hex');
    // Keystone answers over QR, so nothing online proves the scan came from
    // this wallet. Reject a signature the signer key cannot verify.
    this._assertSignatureMatchesSigner({
      signerPublicKey: feePayerPublicKey,
      messageBuffer: Buffer.from(rawTx, 'hex'),
      signatureBuffer,
    });
    transaction.addSignature(feePayerPublicKey, signatureBuffer);

    return {
      txid: bs58.encode(signatureBuffer),
      encodedTx,
      rawTx: Buffer.from(
        transaction.serialize({ requireAllSignatures: false }),
      ).toString('base64'),
    };
  }

  private _assertSignatureMatchesSigner({
    signerPublicKey,
    messageBuffer,
    signatureBuffer,
  }: {
    signerPublicKey: PublicKey;
    messageBuffer: Buffer;
    signatureBuffer: Buffer;
  }) {
    let matched = false;
    try {
      matched = verifyCurveSignature(
        'ed25519',
        signerPublicKey.toBuffer(),
        messageBuffer,
        signatureBuffer,
      );
    } catch {
      // A malformed signature or key never verifies; treat it as a mismatch.
      matched = false;
    }
    if (!matched) {
      throw new ThirdPartyDeviceMismatch({
        vendor: VENDOR_ERROR_CONTEXT.vendor,
        autoToast: true,
        payload: {},
      });
    }
  }

  override async signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // The SDK exposes solSignMessage, but Keystone's return for it hasn't
    // been verified against real hardware, so it stays blocked rather than shipping a signature shape dApps may fail to verify.
    throw new ThirdPartyMethodNotSupported();
  }
}
