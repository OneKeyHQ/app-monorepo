/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  checkBtcAddressIsUsed,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type { IPrepareHardwareAccountsParams } from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.btc.hd;

  async signTransaction(): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  async signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;

    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
      buildAddressesInfo: async ({ usedIndexes }) => {
        const isChange = false;
        const addressIndex = 0;

        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            coinName,
            showOnOnekeyFn,
          }) => {
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.btcGetPublicKey(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams, // passpharse params
              bundle: usedIndexes.map((index, arrIndex) => ({
                path: `${pathPrefix}/${index}'`,
                coin: coinName?.toLowerCase(),
                showOnOneKey: showOnOnekeyFn(arrIndex),
              })),
            });
            return response;
          },
        });

        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const item = publicKeys[i];
          const { path, xpub, xpubSegwit } = item;
          const addressRelPath = `${isChange ? '1' : '0'}/${addressIndex}`;
          const { addresses: addressFromXpub } =
            await this.coreApi.getAddressFromXpub({
              network,
              xpub,
              relativePaths: [addressRelPath],
              addressEncoding,
            });
          const { [addressRelPath]: address } = addressFromXpub;
          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey: '', // TODO return pub from getAddressFromXpub
            path,
            relPath: addressRelPath,
            xpub,
            xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }
}
