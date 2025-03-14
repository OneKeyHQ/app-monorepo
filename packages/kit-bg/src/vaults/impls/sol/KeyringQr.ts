import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyErrorAirGapAccountNotFound } from '@onekeyhq/shared/src/errors';

import localDb from '../../../dbs/local/localDb';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult,
  IPrepareQrAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase = coreChainApi.sol.hd;

  override async prepareAccounts(
    params: IPrepareQrAccountsParams,
  ): Promise<IDBAccount[]> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });
    const networkInfo = await this.getCoreApiNetworkInfo();

    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          if (params?.isVerifyAddressAction) {
            return this.verifyQrWalletAddressByTwoWayScan(params, {
              indexes: usedIndexes,
            });
          }
          const { fullPath, airGapAccount } =
            await this.findAirGapAccountInPrepareAccounts(params, {
              index,
              wallet,
            });

          if (!airGapAccount) {
            throw new OneKeyErrorAirGapAccountNotFound();
          }

          const publicKey = airGapAccount?.publicKey;

          if (!publicKey) {
            throw new Error('publicKey not found');
          }

          const addressInfo = await this.coreApi.getAddressFromPublic({
            publicKey,
            networkInfo,
          });
          if (!addressInfo) {
            throw new Error('addressInfo not found');
          }
          const { normalizedAddress } = await this.vault.validateAddress(
            addressInfo.address,
          );
          addressInfo.address = normalizedAddress || addressInfo.address;
          addressInfo.path = fullPath;
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

  override getChildPathTemplates(
    _params: IGetChildPathTemplatesParams,
  ): IGetChildPathTemplatesResult {
    // Solana uses hardened derivation, so no child path templates are needed
    return {
      childPathTemplates: [],
    };
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return {
      encodedTx: ' ',
      txid: '',
      rawTx: '',
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    return [];
  }

  override async verifySignedTxMatched() {
    return undefined;
  }
}
