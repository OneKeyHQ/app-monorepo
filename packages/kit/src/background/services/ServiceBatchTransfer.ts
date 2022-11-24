import { wait } from '@onekeyfe/hd-core';
import { groupBy, keys } from 'lodash';

import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
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
    prevNonce?: number;
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
    prevNonce?: number;
  }) {
    return this.backgroundApi.engine.buildEncodedTxFromBatchTransfer(params);
  }

  @backgroundMethod()
  async signAndSendEncodedTx(params: {
    password: string;
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    signOnly: boolean;
    pendingTxs?: { id: string }[];
  }) {
    const { engine } = this.backgroundApi;
    const { networkId, pendingTxs, encodedTx } = params;
    const network = await engine.getNetwork(networkId);

    if (
      pendingTxs &&
      pendingTxs.length > 0 &&
      network.impl === IMPL_EVM &&
      (encodedTx as IEncodedTxEvm).to ===
        batchTransferContractAddress[network.id]
    ) {
      const refreshPendingTxs = async () => {
        const txs = await engine.providerManager.refreshPendingTxs(
          networkId,
          pendingTxs,
        );

        if (Object.keys(txs).length !== pendingTxs.length) {
          await wait(1000);
          refreshPendingTxs();
        }
      };

      refreshPendingTxs();
    }

    return engine.signAndSendEncodedTx(params);
  }
}
