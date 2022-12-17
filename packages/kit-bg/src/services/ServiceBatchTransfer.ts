import { providers as multicall } from '@0xsequence/multicall';
import { wait } from '@onekeyfe/hd-core';
import ERC1155MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC1155.json';
import ERC721MetadataArtifact from '@openzeppelin/contracts/build/contracts/ERC721.json';
import { Contract } from 'ethers';
import { groupBy, keys } from 'lodash';

import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IEncodedTx,
  ISetApprovalForAll,
  ISignedTx,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

const BATCH_SEND_TX_RETRY_MAX = 20;
const REFRESH_PENDING_TXS_RETRY_MAX = 20;

const ERC721 = ERC721MetadataArtifact.abi;
const ERC1155 = ERC1155MetadataArtifact.abi;

@backgroundClass()
export default class ServiceBatchTransfer extends ServiceBase {
  @backgroundMethod()
  async getProvider(networkId: string) {
    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);
    return vault.getEthersProvider();
  }

  @backgroundMethod()
  async getReadProvider(networkId: string) {
    const provider = await this.getProvider(networkId);
    if (!provider) {
      return;
    }
    return new multicall.MulticallProvider(provider, { verbose: true });
  }

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

    if (network.impl === IMPL_SOL) {
      return Promise.resolve([]);
    }

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
        let approveInfos: ISetApprovalForAll[] = keys(
          groupBy(transferInfos, 'token'),
        ).map((token) => ({
          from: address,
          to: token,
          spender: contract,
          approved: true,
        }));

        const isApproved = await Promise.all(
          approveInfos.map((approveInfo) =>
            this.checkIsApprovedForAll({
              networkId,
              owner: approveInfo.from,
              spender: approveInfo.spender,
              token: approveInfo.to,
              type: approveInfo.type,
            }),
          ),
        );

        approveInfos = approveInfos.filter(
          (approveInfo, index) => !isApproved[index],
        );

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
    let sendTxRetry = 0;
    let refreshPendingTxsRetry = 0;
    if (
      pendingTxs &&
      pendingTxs.length > 0 &&
      network.impl === IMPL_EVM &&
      (encodedTx as IEncodedTxEvm).to ===
        batchTransferContractAddress[network.id]
    ) {
      // Make sure to call the batch sending contract after approves take effect
      let signedTx: ISignedTx | null = null;
      const refreshPendingTxs = async () => {
        const txs = await engine.providerManager.refreshPendingTxs(
          networkId,
          pendingTxs,
        );

        if (
          Object.keys(txs).length !== pendingTxs.length &&
          refreshPendingTxsRetry < REFRESH_PENDING_TXS_RETRY_MAX
        ) {
          refreshPendingTxsRetry += 1;
          await wait(1000);
          await refreshPendingTxs();
        }
      };

      const resendTx = async () => {
        try {
          signedTx = await engine.signAndSendEncodedTx(params);
        } catch (e) {
          if (e instanceof OneKeyError) {
            throw e;
          }
          if (sendTxRetry > BATCH_SEND_TX_RETRY_MAX) {
            throw e;
          }
          sendTxRetry += 1;
          await wait(1000);
          await resendTx();
        }
      };

      await refreshPendingTxs();
      await resendTx();
      return signedTx;
    }

    return engine.signAndSendEncodedTx(params);
  }

  @backgroundMethod()
  async checkIsApprovedForAll(params: {
    networkId: string;
    owner: string;
    spender: string;
    token: string;
    type?: string;
  }): Promise<boolean> {
    const { networkId, owner, spender, token, type } = params;
    try {
      const readProvider = await this.getReadProvider(networkId);
      const contract = new Contract(
        token,
        type === 'erc1155' ? ERC1155 : ERC721,
        readProvider,
      );

      const [isApprovedForAll]: boolean[] =
        await contract.functions.isApprovedForAll(owner, spender);
      return isApprovedForAll;
    } catch {
      return false;
    }
  }
}
