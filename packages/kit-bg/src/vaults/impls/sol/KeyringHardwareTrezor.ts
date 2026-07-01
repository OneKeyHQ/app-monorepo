import { fetchSolanaTokenDefinition } from '@onekeyfe/hwk-trezor-adapter';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type {
  IATADetails,
  IEncodedTxSol,
} from '@onekeyhq/core/src/chains/sol/types';
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

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import { thirdPartyPassphraseParamsFromDeviceParams } from '../../base/thirdPartyHardwareCommonParams';
import {
  buildTrezorBleFallbackOptions,
  callTrezorWithBleFallback,
  getTrezorAdapterFromBackgroundApi,
} from '../../base/trezorTransportUtils';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export function buildTrezorSolSignTransactionParams({
  path,
  serializedTx,
  ataDetails,
  encodedToken,
}: {
  path: string;
  serializedTx: string;
  ataDetails?: IATADetails[];
  encodedToken?: ArrayBuffer;
}) {
  const additionalInfo =
    ataDetails?.length || encodedToken
      ? {
          ...(encodedToken ? { encodedToken } : {}),
          ...(ataDetails?.length
            ? {
                tokenAccountsInfos: ataDetails.map((ata) => ({
                  baseAddress: ata.owner,
                  tokenProgram: ata.programId,
                  tokenMint: ata.mintAddress,
                  tokenAccount: ata.associatedTokenAddress,
                })),
              }
            : {}),
        }
      : undefined;

  return {
    path,
    serializedTx,
    ...(additionalInfo ? { additionalInfo } : {}),
  };
}

// Trezor SOL keyring. Mirrors KeyringHardwareLedger but uses the Trezor
// adapter + BLE fallback, and drops Ledger's per-chain fingerprint dance —
// Trezor THP exposes a single device-wide identity, so connectId + path are
// enough on every call.
export class KeyringHardwareTrezor extends KeyringHardwareBase {
  override coreApi = coreChainApi.sol.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'sol';

  private getBleFallbackOptions() {
    return buildTrezorBleFallbackOptions(this.backgroundApi);
  }

  // Best-effort: returns undefined on any failure so signing still proceeds.
  private async _resolveSolTokenDefinition(ataDetails?: IATADetails[]) {
    const tokenMint = ataDetails?.[0]?.mintAddress;
    if (!tokenMint) {
      return undefined;
    }
    try {
      return await fetchSolanaTokenDefinition({ tokenMint });
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
        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const path = buildPath({ index });

          const result = await callTrezorWithBleFallback(
            dbDevice,
            (connectId) =>
              adapter.hw.solGetAddress(connectId, dbDevice.deviceId, {
                path,
                showOnDevice: params.isVerifyAddressAction ?? false,
                ...thirdPartyPassphraseParamsFromDeviceParams(
                  params.deviceParams,
                ),
              }),
            this.getBleFallbackOptions(),
          );

          if (!result.success) {
            throw convertThirdPartyDeviceError(result.payload, {
              vendor: 'Trezor',
              chain: 'Solana',
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
    const { feePayer, ataDetails } = unsignedTx.payload as {
      feePayer: string;
      ataDetails?: IATADetails[];
    };
    const feePayerPublicKey = new PublicKey(feePayer);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;

    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);
    const path = await this.vault.getAccountPath();

    const transaction = parseToNativeTx(encodedTx);
    if (!transaction) {
      throw new OneKeyLocalError('Failed to parse SOL transaction');
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;
    const serializedTx = isVersionedTransaction
      ? Buffer.from(transaction.message.serialize()).toString('hex')
      : transaction.serializeMessage().toString('hex');

    const encodedToken = await this._resolveSolTokenDefinition(ataDetails);

    const result = await callTrezorWithBleFallback(
      dbDevice,
      (connectId) =>
        adapter.hw.solSignTransaction(connectId, dbDevice.deviceId, {
          ...buildTrezorSolSignTransactionParams({
            path,
            serializedTx,
            ataDetails,
            encodedToken,
          }),
          ...thirdPartyPassphraseParamsFromDeviceParams(deviceParams),
        }),
      this.getBleFallbackOptions(),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Trezor',
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
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // Trezor firmware does not implement Solana message signing — only
    // SolanaSignTx exists. solSignMessage surfaces MethodNotSupported, so we
    // block proactively here, mirroring the Ledger SOL keyring.
    throw new ThirdPartyMethodNotSupported();
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
