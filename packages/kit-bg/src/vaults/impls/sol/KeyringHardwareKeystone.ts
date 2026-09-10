import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
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

/** See KeyringHardwareKeystone (evm) for why this needs no fingerprint dance. */
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
        serializedTx: rawTx,
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const { signature } = result.payload;
    transaction.addSignature(feePayerPublicKey, Buffer.from(signature, 'hex'));

    return {
      txid: bs58.encode(Buffer.from(signature, 'hex')),
      encodedTx,
      rawTx: Buffer.from(
        transaction.serialize({ requireAllSignatures: false }),
      ).toString('base64'),
    };
  }

  override async signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // The SDK exposes solSignMessage, but what Keystone returns for it has not
    // been verified against real hardware here — leaving it blocked rather
    // than shipping a signature shape dapps may fail to verify.
    throw new ThirdPartyMethodNotSupported();
  }
}
