import { groupBy, keys } from 'lodash';

import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import {
  IEncodedTx,
  ISetApprovalForAll,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceBatchTransfer extends ServiceBase {
  @backgroundMethod()
  async buildEncodedTxsFromBatchApprove(params: {
    accountId: string;
    networkId: string;
    transferInfos: ITransferInfo[];
  }): Promise<IEncodedTx[]> {
    const { accountId, networkId, transferInfos } = params;
    const { engine } = this.backgroundApi;

    const network = await engine.getNetwork(networkId);
    const { address } = await engine.getAccount(accountId, networkId);
    const contract = batchTransferContractAddress[networkId];
    let encodedApproveTxs: IEncodedTx[] = [];

    if (!contract) {
      throw new Error(
        `${network.name} has not deployed a batch transfer contract`,
      );
    }

    const transferInfo = transferInfos[0];
    const { tokenId, isNFT, type, amount } = transferInfo;
    const isTransferToken = Boolean(transferInfo.token);

    if (isTransferToken) {
      // mutiple NFTs to one address
      if (isNFT && tokenId && type) {
        const approveInfos: ISetApprovalForAll[] = keys(
          groupBy(transferInfos, 'token'),
        ).map((token) => ({
          from: address,
          to: token,
          spender: contract,
          approved: true,
        }));

        encodedApproveTxs = await engine.buildEncodedTxsFromSetApproveForAll({
          networkId,
          accountId,
          approveInfos,
        });
      } else {
        // one token to multiple addresses
        encodedApproveTxs = [
          await engine.buildEncodedTxFromApprove({
            networkId,
            accountId,
            token: transferInfo.token as string,
            amount,
            spender: contract,
          }),
        ];
      }
    }
    return Promise.resolve(encodedApproveTxs);
  }

  @backgroundMethod()
  async buildEncodedTxFromBatchTransfer(params: {
    accountId: string;
    networkId: string;
    transferInfos: ITransferInfo[];
  }) {
    return this.backgroundApi.engine.buildEncodedTxFromBatchTransfer(params);
  }
}
