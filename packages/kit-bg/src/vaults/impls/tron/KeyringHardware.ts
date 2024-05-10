/* eslint-disable @typescript-eslint/no-unused-vars */
import { isNil } from 'lodash';
import TronWeb from 'tronweb';

import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignTransactionParams,
} from '../../types';
import type { TronTransactionContract } from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.tron.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const chainId = await this.getNetworkChainId();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            pathSuffix,
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();

            const response = await sdk.tronGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${pathSuffix.replace(
                  '{index}',
                  `${index}`,
                )}`,
                showOnOneKey: showOnOnekeyFn(arrIndex),
                chainId: Number(chainId),
              })),
            });
            return response;
          },
        });

        console.log('tron-buildAddressesInfo', publicKeys);

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, address } = item;
          const { normalizedAddress } = await this.vault.validateAddress(
            address ?? '',
          );
          const addressInfo: ICoreApiGetAddressItem = {
            address: normalizedAddress || address || '',
            path,
            publicKey: '',
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;
    const {
      ref_block_bytes: refBlockBytes,
      ref_block_hash: refBlockHash,
      expiration,
      timestamp,
      fee_limit: feeLimit,
    } = encodedTx.raw_data;

    let contractCall: TronTransactionContract | undefined;
    switch (encodedTx.raw_data.contract[0].type) {
      case 'TransferContract': {
        const { amount, to_address: toAddressHex } =
          encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          transferContract: {
            amount,
            toAddress: TronWeb.address.fromHex(toAddressHex),
          },
        };
        break;
      }
      case 'TriggerSmartContract': {
        const {
          contract_address: contractAddressHex,
          call_value: callValue,
          data,
        } = encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          triggerSmartContract: {
            contractAddress: TronWeb.address.fromHex(contractAddressHex),
            data,
            callValue,
          },
        };
        break;
      }
      case 'FreezeBalanceV2Contract': {
        const { frozen_balance: frozenBalance, resource = 'BANDWIDTH' } =
          encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          freezeBalanceV2Contract: {
            frozenBalance,
            ...(resource === 'BANDWIDTH' ? null : { resource: 1 }),
          },
        };

        break;
      }
      case 'UnfreezeBalanceV2Contract': {
        const { unfreeze_balance: unfreezeBalance, resource = 'BANDWIDTH' } =
          encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          unfreezeBalanceV2Contract: {
            unfreezeBalance,
            ...(resource === 'BANDWIDTH' ? null : { resource: 1 }),
          },
        };
        break;
      }

      case 'DelegateResourceContract': {
        const {
          receiver_address: receiverAddress,
          resource = 'BANDWIDTH',
          balance,
          lock,
        } = encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          delegateResourceContract: {
            balance,
            receiverAddress: TronWeb.address.fromHex(receiverAddress),
            ...(lock ? { lock } : null),
            ...(resource === 'BANDWIDTH' ? null : { resource: 1 }),
          },
        };

        break;
      }
      case 'UnDelegateResourceContract': {
        const {
          receiver_address: receiverAddress,
          resource = 'BANDWIDTH',
          balance,
        } = encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          unDelegateResourceContract: {
            balance,
            receiverAddress: TronWeb.address.fromHex(receiverAddress),
            ...(resource === 'BANDWIDTH' ? null : { resource: 1 }),
          },
        };
        break;
      }
      case 'WithdrawBalanceContract': {
        const { owner_address: ownerAddress } =
          encodedTx.raw_data.contract[0].parameter.value;
        contractCall = {
          withdrawBalanceContract: {
            ownerAddress: TronWeb.address.fromHex(ownerAddress),
          },
        };
        break;
      }
      case 'WithdrawExpireUnfreezeContract': {
        contractCall = {
          // @ts-ignore
          withdrawExpireUnfreezeContract: {},
        };
        break;
      }
      default:
    }

    if (isNil(contractCall)) {
      throw new NotImplemented();
    }

    const sdk = await this.getHardwareSDKInstance();
    const path = await this.vault.getAccountPath();
    const { deviceCommonParams, dbDevice } = checkIsDefined(deviceParams);
    const { connectId, deviceId } = dbDevice;

    const result = await convertDeviceResponse(async () =>
      sdk.tronSignTransaction(connectId, deviceId, {
        path,
        transaction: {
          refBlockBytes,
          refBlockHash,
          expiration,
          timestamp,
          feeLimit,
          contract: contractCall as TronTransactionContract,
        },
        ...deviceCommonParams,
      }),
    );

    const { signature, serialized_tx: serializedTx } = result;
    return Promise.resolve({
      txid: encodedTx.txID,
      encodedTx,
      rawTx: JSON.stringify({
        ...encodedTx,
        raw_data_hex: serializedTx || encodedTx.raw_data_hex,
        signature: [signature],
      }),
    });
  }

  override signMessage(): Promise<ISignedMessagePro> {
    throw new NotImplemented('Signing tron message is not supported yet.');
  }
}
