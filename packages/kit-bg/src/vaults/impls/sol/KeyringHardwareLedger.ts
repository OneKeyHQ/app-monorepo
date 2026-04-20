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
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import { callLedgerWithFingerprintRetry } from '../../base/ledgerFingerprintUtils';

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
  override coreApi = coreChainApi.sol.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'sol';

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

        if (!adapter) {
          throw new OneKeyLocalError(
            'Ledger adapter not available for SOL account creation',
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const path = accountUtils.buildPathFromTemplate({
            template,
            index,
          });

          const result = await callLedgerWithFingerprintRetry(
            this.backgroundApi,
            dbDevice,
            'sol',
            (deviceId) =>
              adapter.hw.solGetAddress(dbDevice.connectId, deviceId, {
                path,
                showOnDevice: params.isVerifyAddressAction ?? false,
              }),
          );

          let address: string | null = null;
          if (result.success) {
            address = result.payload.address;
          } else {
            throw convertThirdPartyDeviceError(result.payload, {
              vendor: 'Ledger',
              chain: 'Solana',
            });
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
    const { feePayer } = unsignedTx.payload as { feePayer: string };
    const feePayerPublicKey = new PublicKey(feePayer);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const path = await this.vault.getAccountPath();
    const transaction = parseToNativeTx(encodedTx);
    if (!transaction) {
      throw new OneKeyLocalError('Failed to parse SOL transaction');
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;
    const rawTx = isVersionedTransaction
      ? Buffer.from(transaction.message.serialize()).toString('hex')
      : transaction.serializeMessage().toString('hex');

    const result = await callLedgerWithFingerprintRetry(
      this.backgroundApi,
      dbDevice,
      'sol',
      (deviceId) =>
        adapter.hw.solSignTransaction(dbDevice.connectId, deviceId, {
          path,
          serializedTx: rawTx,
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'Solana',
      });
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
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { deviceParams } = params;
    const { dbDevice } = checkIsDefined(deviceParams);
    const dbAccount = await this.vault.getAccount();

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const result = await Promise.all(
      params.messages.map(
        async (payload: { type: string; message: string }) => {
          if (payload.type !== EMessageTypesCommon.SIGN_MESSAGE) {
            throw new OneKeyLocalError(
              `Ledger SOL signMessage: unsupported type "${payload.type}"`,
            );
          }

          const messageHex = Buffer.from(payload.message).toString('hex');

          const res = await callLedgerWithFingerprintRetry(
            this.backgroundApi,
            dbDevice,
            'sol',
            (deviceId) =>
              adapter.hw.solSignMessage(dbDevice.connectId, deviceId, {
                path: dbAccount.path,
                message: messageHex,
              }),
          );

          if (!res.success) {
            throw convertThirdPartyDeviceError(res.payload, {
              vendor: 'Ledger',
              chain: 'Solana',
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return res.payload.signature;
        },
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return result.map((sig) => bs58.encode(Buffer.from(sig, 'hex')));
  }

  override async buildHwAllNetworkPrepareAccountsParams(
    _params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return undefined;
  }
}
