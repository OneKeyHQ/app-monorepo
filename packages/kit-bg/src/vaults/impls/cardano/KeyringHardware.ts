/* eslint-disable @typescript-eslint/no-unused-vars */

import { EAdaNetworkId } from '@onekeyhq/core/src/chains/ada/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
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
  override coreApi = coreChainApi.evm.hd;

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

            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.cardanoGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle,
            });
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

  override signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new Error('Method not implemented.');
  }
}
