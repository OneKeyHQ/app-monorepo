import BigNumber from 'bignumber.js';
import { groupBy, keys } from 'lodash';

import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import { HistoryEntryStatus } from '@onekeyhq/engine/src/types/history';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import { InfiniteAmountText } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import type { IEncodedTxSol } from '@onekeyhq/engine/src/vaults/impl/sol/types';
import type {
  IEncodedTx,
  ISetApprovalForAll,
  ISignedTxPro,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import { IMPL_SOL, SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

const BATCH_SEND_TX_RETRY_MAX = 10;
const REFRESH_PENDING_TXS_RETRY_MAX = 10;

@backgroundClass()
export default class ServiceBatchTransfer extends ServiceBase {
  @backgroundMethod()
  async buildEncodedTxsFromBatchApprove(params: {
    accountId: string;
    networkId: string;
    transferInfos: ITransferInfo[];
    isUnlimited?: boolean;
    prevNonce?: number;
  }): Promise<IEncodedTx[]> {
    const { accountId, networkId, transferInfos, isUnlimited } = params;
    const { engine } = this.backgroundApi;
    const network = await engine.getNetwork(networkId);
    const vaultSettings = await engine.getVaultSettings(networkId);

    if (!vaultSettings.batchTransferApprovalRequired) {
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
    const { tokenId, isNFT, type } = transferInfo;
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
        const tokenInfo = await engine.ensureTokenInDB(
          networkId,
          transferInfo.token ?? '',
        );

        if (!tokenInfo) {
          throw new Error(`Token not found: ${transferInfo.token as string}`);
        }

        // one token to multiple addresses
        const { isUnlimited: isUnlimitedAllowance, allowance } =
          await this.checkIsUnlimitedAllowance({
            networkId,
            owner: transferInfo.from,
            spender: contract,
            token: transferInfo.token as string,
          });
        if (!isUnlimitedAllowance) {
          const amount = transferInfos.reduce(
            (result, info) => result.plus(info.amount),
            new BigNumber(0),
          );
          if (
            isUnlimited ||
            amount.shiftedBy(tokenInfo.decimals).isGreaterThan(allowance)
          ) {
            encodedApproveTxs = [
              await engine.buildEncodedTxFromApprove({
                networkId,
                accountId,
                token: transferInfo.token as string,
                amount: isUnlimited ? InfiniteAmountText : amount.toFixed(),
                spender: contract,
              }),
            ];
          }
        }
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
    isDeflationary?: boolean;
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
    const { accountId, networkId, pendingTxs, encodedTx } = params;
    const network = await engine.getNetwork(networkId);
    const vaultSettings = await engine.getVaultSettings(networkId);
    const { wait } = await CoreSDKLoader();
    let sendTxRetry = 0;
    let refreshPendingTxsRetry = 0;
    if (
      pendingTxs &&
      pendingTxs.length > 0 &&
      vaultSettings.batchTransferApprovalConfirmRequired &&
      (await this.checkIsBatchTransfer({ networkId, encodedTx }))
    ) {
      // Make sure to call the batch sending contract after approves take effect
      let signedTx: ISignedTxPro | null = null;
      const refreshPendingTxs = async () => {
        const txs = await this.refreshPendingTxs({ networkId, pendingTxs });
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
    if (network.impl === IMPL_SOL) {
      const transaction = await engine.solanaRefreshRecentBlockBash({
        accountId,
        networkId,
        transaction: params.encodedTx as IEncodedTxSol,
      });
      params.encodedTx = transaction;
    }

    return engine.signAndSendEncodedTx(params);
  }

  @backgroundMethod()
  async checkIsUnlimitedAllowance(params: {
    networkId: string;
    owner: string;
    spender: string;
    token: string;
  }) {
    const { networkId, owner, spender, token } = params;
    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);

    return vault.checkIsUnlimitedAllowance({ owner, spender, token });
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

    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);

    return vault.checkIsApprovedForAll({ owner, spender, token, type });
  }

  @backgroundMethod()
  async confirmTransaction(params: { networkId: string; txid: string }) {
    const { networkId, txid } = params;
    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);

    const [status] = await vault.getTransactionStatuses([txid]);
    return status;
  }

  @backgroundMethod()
  async checkIsBatchTransfer(params: {
    networkId: string;
    encodedTx: IEncodedTx;
  }) {
    const { networkId, encodedTx } = params;
    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);

    return vault.checkIsBatchTransfer(encodedTx);
  }

  @backgroundMethod()
  async refreshPendingTxs(params: {
    networkId: string;
    pendingTxs: Array<{ id: string }>;
  }): Promise<Record<string, HistoryEntryStatus>> {
    const { networkId, pendingTxs } = params;

    if (pendingTxs.length === 0) {
      return {};
    }

    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);

    const ret: Record<string, HistoryEntryStatus> = {};
    const regex = new RegExp(`^${networkId}${SEPERATOR}`);
    const updatedStatuses = await vault.getTransactionStatuses(
      pendingTxs.map((tx) => tx.id.replace(regex, '')),
    );

    console.log('updatedStatuses', updatedStatuses);

    updatedStatuses.forEach((status, index) => {
      const { id } = pendingTxs[index];
      if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
        ret[id] = HistoryEntryStatus.SUCCESS;
      } else if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
        ret[id] = HistoryEntryStatus.FAILED;
      }
    });

    return ret;
  }
}
