import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
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
import type {
  TronContract,
  TronSignTxParams,
} from '@onekeyfe/hwk-adapter-core';
import type { Types } from 'tronweb';

export function buildTrezorTronSignTransactionParams({
  path,
  encodedTx,
}: {
  path: string;
  encodedTx: IEncodedTxTron;
}): TronSignTxParams {
  const {
    ref_block_bytes: refBlockBytes,
    ref_block_hash: refBlockHash,
    expiration,
    timestamp,
    fee_limit: feeLimit,
    data,
    contract: rawContracts,
  } = encodedTx.raw_data;

  if (rawContracts.length !== 1) {
    throw new ThirdPartyMethodNotSupported();
  }

  const rawContract = rawContracts[0];
  const value = rawContract.parameter.value as { owner_address?: string };
  // Every TRON contract carries owner_address (hex 0x41-prefixed). Trezor's
  // contract message needs it explicitly (OneKey firmware derives it on-device).
  const ownerAddress = value.owner_address;
  if (!ownerAddress) {
    throw new OneKeyLocalError(
      'tron signTransaction: missing owner_address in raw_data contract',
    );
  }

  const rawData = typeof data === 'string' ? data : undefined;
  return {
    path,
    ownerAddress,
    refBlockBytes,
    refBlockHash,
    expiration,
    timestamp,
    ...(feeLimit !== undefined && feeLimit !== null
      ? { feeLimit: feeLimit as number }
      : {}),
    ...(rawData ? { data: rawData } : {}),
    contract: buildTrezorTronContract(rawContract),
  };
}

export function buildTrezorTronContract(
  rawContract: IEncodedTxTron['raw_data']['contract'][0],
): TronContract {
  switch (rawContract.type) {
    case 'TransferContract': {
      const { amount, to_address: toAddress } = rawContract.parameter
        .value as Types.TransferContract;
      return { transferContract: { toAddress, amount } };
    }
    case 'TriggerSmartContract': {
      const {
        contract_address: contractAddress,
        data,
        call_value: callValue,
      } = rawContract.parameter.value as Types.TriggerSmartContract;
      if (!contractAddress || !data) {
        throw new OneKeyLocalError(
          'Trezor TRON trigger smart contract is missing contract_address or data',
        );
      }
      // Trezor's TronTriggerSmartContract protobuf carries only
      // owner/contract/data. TRC-20 style calls have call_value 0; anything else
      // cannot be represented by the firmware protocol.
      if (
        callValue !== undefined &&
        callValue !== null &&
        Number(callValue) !== 0
      ) {
        throw new ThirdPartyMethodNotSupported();
      }
      return { triggerSmartContract: { contractAddress, data } };
    }
    case 'FreezeBalanceV2Contract': {
      const { frozen_balance: balance, resource } = rawContract.parameter
        .value as Types.FreezeBalanceV2Contract;
      return {
        freezeBalanceV2Contract: {
          balance,
          ...(resource && resource !== 'BANDWIDTH' ? { resource } : {}),
        },
      };
    }
    case 'UnfreezeBalanceV2Contract': {
      const { unfreeze_balance: balance, resource } = rawContract.parameter
        .value as Types.UnfreezeBalanceV2Contract;
      return {
        unfreezeBalanceV2Contract: {
          balance,
          ...(resource && resource !== 'BANDWIDTH' ? { resource } : {}),
        },
      };
    }
    case 'VoteWitnessContract': {
      const { votes } = rawContract.parameter
        .value as Types.VoteWitnessContract;
      return {
        voteWitnessContract: {
          votes: (votes ?? []).map((vote) => ({
            voteAddress: vote.vote_address,
            voteCount: vote.vote_count,
          })),
        },
      };
    }
    case 'WithdrawExpireUnfreezeContract': {
      return { withdrawExpireUnfreezeContract: {} };
    }
    // Unsupported by Trezor firmware / protobuf:
    //   DelegateResourceContract, UnDelegateResourceContract,
    //   WithdrawBalanceContract, CancelAllUnfreezeV2Contract
    default:
      throw new ThirdPartyMethodNotSupported();
  }
}

export function buildTrezorTronSignedRawTx({
  encodedTx,
  signature,
  serializedTx,
}: {
  encodedTx: IEncodedTxTron;
  signature: string;
  serializedTx?: string;
}) {
  return JSON.stringify({
    ...encodedTx,
    raw_data_hex: serializedTx || encodedTx.raw_data_hex,
    signature: [signature],
  });
}

// Trezor TRON keyring. Address methods mirror the EVM/SOL Trezor keyrings.
// signTransaction maps the decoded raw_data contract onto Trezor's STRUCTURED
// contract shape (vs Ledger's rawTxHex): addresses stay hex 0x41-prefixed (the
// device's native form — no base58 conversion), and owner_address is taken
// from the contract itself. Only the six contract types Trezor firmware
// supports are wired; the rest are reported as third-party unsupported methods.
export class KeyringHardwareTrezor extends KeyringHardwareBase {
  override coreApi = coreChainApi.tron.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'tron';

  private getBleFallbackOptions() {
    return buildTrezorBleFallbackOptions(this.backgroundApi);
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
              adapter.hw.tronGetAddress(connectId, dbDevice.deviceId, {
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
              chain: 'Tron',
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
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;
    const adapter = await getTrezorAdapterFromBackgroundApi(this.backgroundApi);
    const path = await this.vault.getAccountPath();

    const result = await callTrezorWithBleFallback(
      dbDevice,
      (connectId) =>
        adapter.hw.tronSignTransaction(connectId, dbDevice.deviceId, {
          ...buildTrezorTronSignTransactionParams({ path, encodedTx }),
          ...thirdPartyPassphraseParamsFromDeviceParams(deviceParams),
        }),
      this.getBleFallbackOptions(),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Trezor',
        chain: 'Tron',
      });
    }

    // Prefer the host-reconstructed raw_data the signature actually covers
    // (mirrors OneKey's `serialized_tx || raw_data_hex`). For our supported
    // single-contract types this equals encodedTx.raw_data_hex anyway.
    const { signature, serializedTx } = result.payload;
    return {
      txid: encodedTx.txID,
      encodedTx,
      rawTx: buildTrezorTronSignedRawTx({
        encodedTx,
        signature,
        serializedTx,
      }),
    };
  }

  override async signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // Trezor firmware has no TRON message signing (no TronSignMessage in the
    // protobuf) — block here.
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
