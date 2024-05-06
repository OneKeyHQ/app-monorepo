/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  transformToOneKeyInputs,
  transformToOneKeyOutputs,
} from '@onekeyhq/core/src/chains/ada/sdkAda/transformations';
import type { IEncodedTxAda } from '@onekeyhq/core/src/chains/ada/types';
import { EAdaNetworkId } from '@onekeyhq/core/src/chains/ada/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import sdk from './sdkAda';
import { getChangeAddress } from './sdkAda/adaUtils';

import type VaultCardano from './Vault';
import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { CardanoGetAddressMethodParams } from '@onekeyfe/hd-core';

const ProtocolMagic = 764824073;

const getCardanoConstant = async () => {
  const { PROTO } = await CoreSDKLoader();
  return {
    addressType: PROTO.CardanoAddressType.BASE,
    derivationType: PROTO.CardanoDerivationType.ICARUS,
    protocolMagic: ProtocolMagic,
    networkId: EAdaNetworkId.MAINNET,
  };
};

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.ada.hd;

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: () => Promise.resolve({ isUsed: true }),
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const { derivationType, addressType, networkId, protocolMagic } =
              await getCardanoConstant();
            const paths = usedIndexes.map(
              (index) => `${pathPrefix}/${index}'/0/0`,
            );
            const stakingPaths = usedIndexes.map(
              (index) => `${pathPrefix}/${index}'/2/0`,
            );
            const bundle = paths.map((path, index) => ({
              addressParameters: {
                addressType,
                path,
                stakingPath: stakingPaths[index],
              },
              networkId,
              protocolMagic,
              derivationType,
              showOnOneKey: showOnOnekeyFn(index),
            })) as CardanoGetAddressMethodParams[];

            const HardwareSDK = await this.getHardwareSDKInstance();
            const response = await HardwareSDK.cardanoGetAddress(
              connectId,
              deviceId,
              {
                ...params.deviceParams.deviceCommonParams,
                bundle,
              },
            );
            return response;
          },
        });

        const ret = [];
        const firstAddressRelPath = '0/0';
        const stakingAddressRelPath = '2/0';
        for (const addressInfo of addressesInfo) {
          const { address, xpub, serializedPath, stakeAddress } = addressInfo;
          if (address) {
            const addresses: Record<string, string> = {
              [firstAddressRelPath]: address,
            };
            if (stakeAddress) {
              addresses[stakingAddressRelPath] = stakeAddress;
            }
            const formattedPath = accountUtils.formatUtxoPath(serializedPath);
            ret.push({
              address,
              publicKey: '',
              path: formattedPath,
              relPath: firstAddressRelPath,
              xpub: xpub ?? '',
              addresses,
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
    const { PROTO } = await CoreSDKLoader();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;

    const vault = this.vault as VaultCardano;
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAda;
    const dbAccount = (await this.vault.getAccount()) as IDBUtxoAccount;
    const changeAddress = getChangeAddress(dbAccount);
    const { derivationType, networkId, protocolMagic } =
      await getCardanoConstant();
    const utxos = await vault._collectUTXOsInfoByApi({
      address: dbAccount.address,
      path: dbAccount.path,
      addresses: dbAccount.addresses,
      xpub: dbAccount.xpub,
    });

    const { inputs, outputs, fee, tx } = encodedTx;
    const isSignOnly = !!encodedTx.signOnly;
    const { rawTxHex } = tx;
    const CardanoApi = await sdk.getCardanoApi();
    let cardanoParams;

    // sign for DApp
    if (isSignOnly && rawTxHex) {
      const stakingPath = `${dbAccount.path
        .split('/')
        .slice(0, 4)
        .join('/')}/2/0`;
      const keys = {
        payment: { hash: null, path: dbAccount.path },
        stake: { hash: null, path: stakingPath },
      };
      cardanoParams = await CardanoApi.txToOneKey(
        rawTxHex,
        networkId,
        keys,
        dbAccount.xpub,
        changeAddress,
      );
    } else {
      cardanoParams = {
        signingMode: PROTO.CardanoTxSigningMode.ORDINARY_TRANSACTION,
        outputs: transformToOneKeyOutputs(
          outputs,
          changeAddress.addressParameters,
        ),
        fee,
        protocolMagic,
        networkId,
      };
    }

    const res = await HardwareSDK.cardanoSignTransaction(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
      inputs: transformToOneKeyInputs(inputs, utxos),
      derivationType,
      ...cardanoParams,
    } as any);
    if (!res.success) {
      throw convertDeviceError(res.payload);
    }

    const signedTx = await CardanoApi.hwSignTransaction(
      tx.body,
      res.payload.witnesses,
      {
        signOnly: !!encodedTx.signOnly,
      },
    );

    return {
      rawTx: signedTx,
      txid: tx.hash,
      encodedTx,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const { derivationType, networkId } = await getCardanoConstant();
    const dbAccount = (await this.vault.getAccount()) as IDBUtxoAccount;
    const result = await Promise.all(
      params.messages.map(
        // @ts-expect-error
        async ({ payload }: { payload: { addr: string; payload: string } }) => {
          const response = await HardwareSDK.cardanoSignMessage(
            connectId,
            deviceId,
            {
              ...params,
              path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
              networkId,
              derivationType,
              message: payload.payload,
            },
          );
          if (!response.success) {
            throw convertDeviceError(response.payload);
          }
          return response.payload;
        },
      ),
    );
    return result.map((ret) => JSON.stringify(ret));
  }
}
