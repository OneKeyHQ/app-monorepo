import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import HDKey from 'hdkey';

import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyErrorAirGapAccountNotFound,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import localDb from '../../../dbs/local/localDb';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult,
  INormalizeGetMultiAccountsPathParams,
  IPrepareQrAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import { getAirGapSdk } from '@onekeyhq/qr-wallet-sdk';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export class KeyringQr extends KeyringQrBase {
  override coreApi: CoreChainApiBase = coreChainApi.tron.hd;

  override verifySignedTxMatched(..._args: any[]): Promise<void> {
    throw new NotImplemented();
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
          const { fullPath, airGapAccount, childPathTemplate } =
            await this.findAirGapAccountInPrepareAccounts(params, {
              index,
              wallet,
            });

          if (!airGapAccount) {
            throw new OneKeyErrorAirGapAccountNotFound();
          }

          let publicKey = airGapAccount?.publicKey;

          if (childPathTemplate) {
            const xpub = airGapAccount?.extendedPublicKey;
            if (!xpub) {
              throw new OneKeyLocalError('xpub not found');
            }
            let hdk = HDKey.fromExtendedKey(xpub);
            const childPath = accountUtils.buildPathFromTemplate({
              template: childPathTemplate,
              index,
            });
            hdk = hdk.derive(`m/${childPath}`);
            publicKey = hdk.publicKey.toString('hex');
          }

          if (!publicKey) {
            throw new OneKeyLocalError('publicKey not found');
          }

          const addressInfo = await this.coreApi.getAddressFromPublic({
            publicKey,
            networkInfo,
          });
          if (!addressInfo) {
            throw new OneKeyLocalError('addressInfo not found');
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
    return {
      childPathTemplates: ['0/*'],
    };
  }

  override async normalizeGetMultiAccountsPath(
    _params: INormalizeGetMultiAccountsPathParams,
  ): Promise<string> {
    const sdk = getAirGapSdk();
    return sdk.tron.normalizeGetMultiAccountsPath(_params.path);
  }
}
