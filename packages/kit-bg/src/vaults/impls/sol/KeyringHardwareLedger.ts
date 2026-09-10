import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
  IUnsignedMessageSolana,
} from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EMessageTypesSolana } from '@onekeyhq/shared/types/message';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import {
  callLedgerWithFingerprint,
  ledgerCommonCallParamsForCreateScene,
} from '../../base/ledgerFingerprintUtils';

import { buildHardwareSolSignOffchainMessageV1Params } from './KeyringHardware';

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
          await this.backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
            EHardwareVendor.ledger,
          );

        if (!adapter) {
          throw new OneKeyLocalError(
            'Ledger adapter not available for SOL account creation',
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const path = buildPath({ index });

          const result = await callLedgerWithFingerprint(
            this.backgroundApi,
            dbDevice,
            'sol',
            (deviceId, connectId, context) =>
              adapter.hw.solGetAddress(connectId, deviceId, {
                ...context,
                path,
                showOnDevice: params.isVerifyAddressAction ?? false,
                ...ledgerCommonCallParamsForCreateScene(params),
              }),
            {
              interactionId:
                params.deviceParams.deviceCommonParams?.interactionId,
              allowFingerprintBootstrap:
                params.deviceParams.deviceCommonParams
                  ?.allowDeviceIdentityBootstrap === true,
            },
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
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const { feePayer } = unsignedTx.payload as { feePayer: string };
    const feePayerPublicKey = new PublicKey(feePayer);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;

    const adapter =
      await this.backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
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

    const result = await callLedgerWithFingerprint(
      this.backgroundApi,
      dbDevice,
      'sol',
      (deviceId, connectId, context) =>
        adapter.hw.solSignTransaction(connectId, deviceId, {
          ...context,
          path,
          serializedTx: rawTx,
        }),
      {
        interactionId: checkedDeviceParams.deviceCommonParams?.interactionId,
        allowFingerprintBootstrap: false,
      },
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
    const deviceParams = checkIsDefined(params.deviceParams);
    const { dbDevice } = deviceParams;
    const adapter =
      await this.backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }
    const path = await this.vault.getAccountPath();

    const signatures: string[] = [];
    for (const payload of params.messages) {
      if (payload.type !== EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE) {
        throw new ThirdPartyMethodNotSupported();
      }
      const messagePayload = payload.payload;
      const { messageHex, ...offchainParams } =
        buildHardwareSolSignOffchainMessageV1Params({
          message: payload.message,
          messagePayload,
        });
      const result =
        // eslint-disable-next-line no-await-in-loop
        await callLedgerWithFingerprint(
          this.backgroundApi,
          dbDevice,
          'sol',
          (deviceId, connectId, context) =>
            adapter.hw.solSignMessage(connectId, deviceId, {
              ...context,
              path,
              message: messageHex,
              ...offchainParams,
            }),
          {
            interactionId: deviceParams.deviceCommonParams?.interactionId,
            allowFingerprintBootstrap: false,
          },
        );
      if (!result.success) {
        throw convertThirdPartyDeviceError(result.payload, {
          vendor: 'Ledger',
          chain: 'Solana',
        });
      }
      signatures.push(result.payload.signature);
    }

    return signatures.map((signature) =>
      bs58.encode(Buffer.from(signature, 'hex')),
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
