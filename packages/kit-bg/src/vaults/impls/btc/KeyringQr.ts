import {
  convertBtcScriptTypeForHardware,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyErrorAirGapAccountNotFound,
} from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import localDb from '../../../dbs/local/localDb';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult,
  IPrepareQrAccountsParams,
  IQrWalletGetVerifyAddressChainParamsQuery,
  IQrWalletGetVerifyAddressChainParamsResult,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringQr extends KeyringQrBase {
  override coreApi = coreChainApi.btc.hd;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override getChildPathTemplates(
    params: IGetChildPathTemplatesParams,
  ): IGetChildPathTemplatesResult {
    return {
      childPathTemplates: [accountUtils.buildUtxoAddressRelPath()],
    };
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

  override async getVerifyAddressChainParams(
    query: IQrWalletGetVerifyAddressChainParamsQuery,
  ): Promise<IQrWalletGetVerifyAddressChainParamsResult> {
    const { fullPath } = query;
    const { getHDPath, getScriptType } = await CoreSDKLoader();
    const addressN = getHDPath(fullPath);
    const scriptType = getScriptType(addressN);
    return {
      scriptType: String(convertBtcScriptTypeForHardware(scriptType)),
    };
  }

  override async prepareAccounts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareQrAccountsParams,
  ): Promise<IDBAccount[]> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;

    return this.basePrepareHdUtxoAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        // TODO move to base
        if (params?.isVerifyAddressAction) {
          return this.verifyQrWalletAddressByTwoWayScan(params, {
            indexes: usedIndexes,
          });
        }

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
          const { [addressRelPath]: publicKey } = xpubAddressInfo.publicKeys;

          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey,
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
