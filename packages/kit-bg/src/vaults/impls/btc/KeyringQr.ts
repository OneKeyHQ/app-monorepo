import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import type { IAirGapAccount } from '@onekeyhq/qr-wallet-sdk';
import {
  NotImplemented,
  OneKeyErrorAirGapAccountNotFound,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import localDb from '../../../dbs/local/localDb';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringQr extends KeyringQrBase {
  override coreApi = coreChainApi.btc.hd;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override buildAirGapAccountChildPathTemplate(params: {
    airGapAccount: IAirGapAccount;
  }): string {
    return accountUtils.buildUtxoAddressRelPath();
  }

  override signTransaction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;

    return this.basePrepareHdUtxoAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const { fullPath, airGapAccount, childPathTemplate } =
            await this.findQrWalletAirGapAccount(params, { index, wallet });

          if (!airGapAccount) {
            throw new OneKeyErrorAirGapAccountNotFound();
          }

          // let xpub = airGapAccount?.publicKey;
          let xpub = '';
          let addressRelPath: string | undefined;

          if (childPathTemplate) {
            const childPath = accountUtils.buildPathFromTemplate({
              template: childPathTemplate,
              index,
            });
            addressRelPath = childPath;
            const extendedPublicKey = airGapAccount?.extendedPublicKey;
            if (!extendedPublicKey) {
              throw new Error('xpub not found');
            }
            xpub = extendedPublicKey;
          }

          if (!xpub) {
            throw new Error('publicKey not found');
          }
          if (!addressRelPath) {
            throw new Error('addressRelPath not found');
          }

          const xpubAddressInfo = await this.coreApi.getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
            addressEncoding,
          });
          const { [addressRelPath]: address } = xpubAddressInfo.addresses;

          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey: '', // TODO return pub from getAddressFromXpub
            path: airGapAccount.path,
            relPath: addressRelPath,
            xpub,
            xpubSegwit: xpubAddressInfo.xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
          };
          ret.push(addressInfo);
          console.log('KeyringQr prepareAccounts', {
            params,
            wallet,
            fullPath,
            airGapAccount,
            addressInfo,
          });
        }
        return ret;
      },
    });
  }
}
