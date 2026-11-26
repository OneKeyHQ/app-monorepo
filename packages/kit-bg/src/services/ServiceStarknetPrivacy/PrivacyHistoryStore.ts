import BigNumber from 'bignumber.js';

import type { IDecodedTxExtraStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import {
  scaleFeeFiatValueToNativeFee,
  sortHistoryTxsByTime,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { projectPrivacyChainHistoryTxToPool } from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type {
  IStrk20AccountKey,
  IStrk20HistoryCursor,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { buildPrivacyCacheKey } from './types';

import type { IStarknetPrivacyContext, IStoredHistoryCursor } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IStrk20InternalHistoryCursor } from '../../vaults/impls/starknet/strk20Adapter';

const MAX_HISTORY_CURSORS = 32;

type IPrivacyHistoryStoreDeps = {
  backgroundApi: IBackgroundApi;
  getGeneration: () => number;
  getKeyGeneration: (scopeKey: string) => number;
  getRegisteredPrivacyContext: (
    p: IStrk20AccountKey,
    purpose: 'read' | 'transfer',
    allowPrompt: boolean,
  ) => Promise<IStarknetPrivacyContext | undefined>;
};

/**
 * Background-only store for STRK20 private history pagination cursors
 * (so channelKeys never cross IPC) and merging discovered + local private txs.
 */
export class PrivacyHistoryStore {
  private readonly deps: IPrivacyHistoryStoreDeps;

  private readonly historyCursors = new Map<string, IStoredHistoryCursor>();

  constructor(deps: IPrivacyHistoryStoreDeps) {
    this.deps = deps;
  }

  clear(): void {
    this.historyCursors.clear();
  }

  dropScope(scopeKey: string): void {
    for (const [cursorId, stored] of this.historyCursors.entries()) {
      if (stored.scopeKey === scopeKey) {
        this.historyCursors.delete(cursorId);
      }
    }
  }

  private storeHistoryCursor(entry: IStoredHistoryCursor): string {
    const cursorId = generateUUID();
    if (this.historyCursors.size >= MAX_HISTORY_CURSORS) {
      const oldestKey = this.historyCursors.keys().next().value;
      if (oldestKey !== undefined) {
        this.historyCursors.delete(oldestKey);
      }
    }
    this.historyCursors.set(cursorId, entry);
    return cursorId;
  }

  async fetchPrivateHistory(
    p: IStrk20AccountKey & {
      tokenAddress: string;
      cursor?: IStrk20HistoryCursor;
    },
  ): Promise<{
    txs: IAccountHistoryTx[];
    discoveryTxIds: string[];
    hasMore: boolean;
    isEnabled?: boolean;
    cursorExpired?: boolean;
    cursor?: IStrk20HistoryCursor;
  }> {
    const ctx = await this.deps.getRegisteredPrivacyContext(p, 'read', false);
    if (!ctx) {
      return { txs: [], discoveryTxIds: [], hasMore: false, isEnabled: false };
    }
    const scopeKey = buildPrivacyCacheKey({
      networkId: p.networkId,
      accountId: p.accountId,
      poolAddress: ctx.poolAddress,
    });
    const generation = this.deps.getGeneration();
    const keyGeneration = this.deps.getKeyGeneration(scopeKey);
    let internalCursor: IStrk20InternalHistoryCursor | undefined;
    if (p.cursor?.cursorId) {
      const stored = this.historyCursors.get(p.cursor.cursorId);
      if (
        !stored ||
        stored.scopeKey !== scopeKey ||
        stored.generation !== generation ||
        stored.keyGeneration !== keyGeneration
      ) {
        return {
          txs: [],
          discoveryTxIds: [],
          hasMore: false,
          isEnabled: true,
          cursorExpired: true,
        };
      }
      internalCursor = { cursor: stored.cursor, blockRef: stored.blockRef };
    }
    const { fetchStrk20HistoryPage, buildOhttpOption } =
      await import('../../vaults/impls/starknet/strk20Adapter');
    const page = await fetchStrk20HistoryPage({
      discoveryUrl: ctx.config.discoveryUrl,
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
      viewingKey: ctx.viewing.viewingKey,
      cursor: internalCursor,
      ohttp: buildOhttpOption(ctx.config.ohttp),
    });
    ctx.assertSession();

    let tokenMetadata: Promise<IToken | undefined> | undefined;
    const getTokenInfo = () => {
      tokenMetadata ??= this.deps.backgroundApi.serviceToken
        .fetchTokensDetails({
          networkId: p.networkId,
          accountId: p.accountId,
          contractList: [p.tokenAddress],
        })
        .then((items) => items?.[0]?.info);
      return tokenMetadata;
    };
    const { buildStrk20HistoryTx } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const txs = await Promise.all(
      page.transactions.map((transaction) =>
        buildStrk20HistoryTx({
          vault: ctx.vault,
          networkId: p.networkId,
          accountId: p.accountId,
          accountAddress: ctx.account.address,
          poolAddress: ctx.poolAddress,
          transaction,
          tokenAddress: p.tokenAddress,
          getTokenInfo,
        }),
      ),
    );
    const localTxs = await this.fetchLocalPrivateHistory({
      ...p,
      ctx,
      getTokenInfo,
    });
    const byHash = new Map(
      localTxs.map((tx) => [BigInt(tx.decodedTx.txid).toString(), tx]),
    );
    for (const tx of txs) {
      if (tx) {
        const hash = BigInt(tx.decodedTx.txid).toString();
        const local = byHash.get(hash);
        const localExtra = local?.decodedTx.extraInfo as
          | IDecodedTxExtraStarknet
          | undefined;
        const discoveredExtra = tx.decodedTx.extraInfo as
          | IDecodedTxExtraStarknet
          | undefined;
        byHash.set(hash, {
          ...tx,
          isLocalCreated: local?.isLocalCreated ?? tx.isLocalCreated,
          decodedTx: {
            ...tx.decodedTx,
            createdAt: tx.decodedTx.createdAt ?? local?.decodedTx.createdAt,
            updatedAt: tx.decodedTx.updatedAt ?? local?.decodedTx.updatedAt,
            nonce: local?.decodedTx.nonce ?? tx.decodedTx.nonce,
            totalFeeInNative: local?.decodedTx.totalFeeInNative,
            protocolFeeInNative: local?.decodedTx.protocolFeeInNative,
            totalFeeFiatValue: local?.decodedTx.totalFeeFiatValue,
            extraInfo: localExtra
              ? {
                  ...localExtra,
                  ...discoveredExtra,
                  privacy: discoveredExtra?.privacy
                    ? { ...localExtra.privacy, ...discoveredExtra.privacy }
                    : localExtra.privacy,
                }
              : tx.decodedTx.extraInfo,
          },
        });
      }
    }
    const datedTxs = await Promise.all(
      [...byHash.values()].map(async (tx) => {
        const { block, createdAt, updatedAt } = tx.decodedTx;
        if (createdAt || updatedAt || block === undefined) return tx;
        const seconds = await ctx.client.getBlockTimestamp(block);
        if (seconds === undefined) return tx;
        const time = seconds * 1000;
        return {
          ...tx,
          decodedTx: { ...tx.decodedTx, createdAt: time, updatedAt: time },
        };
      }),
    );
    ctx.assertSession();
    const hasMore = !page.cursor.historyComplete;
    const cursor = hasMore
      ? {
          cursorId: this.storeHistoryCursor({
            scopeKey,
            generation,
            keyGeneration,
            cursor: page.cursor,
            blockRef: page.blockRef,
          }),
        }
      : undefined;
    return {
      txs: sortHistoryTxsByTime({ txs: datedTxs }),
      discoveryTxIds: txs.flatMap((tx) => (tx ? [tx.id] : [])),
      hasMore,
      isEnabled: true,
      ...(cursor ? { cursor } : {}),
    };
  }

  private async fetchLocalPrivateHistory(
    params: IStrk20AccountKey & {
      tokenAddress: string;
      ctx: IStarknetPrivacyContext;
      getTokenInfo: () => Promise<IToken | undefined>;
    },
  ): Promise<IAccountHistoryTx[]> {
    const { serviceHistory } = this.deps.backgroundApi;
    const query = {
      networkId: params.networkId,
      accountAddress: params.ctx.account.address,
      tokenIdOnNetwork: params.tokenAddress,
    };
    const [pending, confirmed] = await Promise.all([
      serviceHistory.getAccountLocalHistoryPendingTxs(query),
      serviceHistory.getAccountLocalHistoryConfirmedTxs(query),
    ]);
    const txs = [...pending, ...confirmed].filter((tx) => {
      const intent = (
        tx.decodedTx.extraInfo as IDecodedTxExtraStarknet | undefined
      )?.privacy;
      return (
        intent &&
        intent.kind !== 'register' &&
        intent.tokenAddress &&
        BigInt(intent.tokenAddress) === BigInt(params.tokenAddress) &&
        BigInt(intent.poolAddress) === BigInt(params.ctx.poolAddress)
      );
    });
    if (!txs.length) return [];
    const token = await params.getTokenInfo();
    if (!token) return [];
    const { getReceiptTxStatus, getReceiptFeeInNative } =
      await import('../../vaults/impls/starknet/utils');
    const { PRIVATE_HISTORY_POOL_ID } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const settled: IAccountHistoryTx[] = [];
    const projected = await Promise.all(
      txs.map(async (tx) => {
        const intent = (tx.decodedTx.extraInfo as IDecodedTxExtraStarknet)
          .privacy;
        if (!intent?.amount) return tx;
        let status = tx.decodedTx.status;
        let decodedTx = tx.decodedTx;
        if (status === EDecodedTxStatus.Pending) {
          const receipt = await params.ctx.client
            .getTransactionReceipt(tx.decodedTx.txid)
            .catch(() => null);
          const onChainStatus = getReceiptTxStatus(receipt);
          if (onChainStatus === EOnChainHistoryTxStatus.Success) {
            status = EDecodedTxStatus.Confirmed;
          }
          if (onChainStatus === EOnChainHistoryTxStatus.Failed) {
            status = EDecodedTxStatus.Failed;
          }
          if (status !== EDecodedTxStatus.Pending) {
            const totalFeeInNative =
              getReceiptFeeInNative(
                receipt,
                params.ctx.network.feeMeta.decimals,
              ) ?? decodedTx.totalFeeInNative;
            const protocolFeeInNative =
              (await params.ctx.vault.fetchProtocolFeeInNative?.({
                client: params.ctx.client,
                localTx: tx,
                receipt,
              })) ?? decodedTx.protocolFeeInNative;
            decodedTx = {
              ...decodedTx,
              status,
              isFinal: true,
              block: receipt?.block_number ?? decodedTx.block,
              totalFeeInNative,
              ...(protocolFeeInNative !== undefined
                ? { protocolFeeInNative }
                : {}),
              totalFeeFiatValue: scaleFeeFiatValueToNativeFee({
                feeFiatValue: decodedTx.totalFeeFiatValue,
                feeInNative: decodedTx.totalFeeInNative,
                nextFeeInNative: totalFeeInNative,
              }),
            };
            settled.push({ ...tx, decodedTx });
          }
        }
        const amount = new BigNumber(intent.amount).shiftedBy(-token.decimals);
        const isSelfTransfer =
          intent.kind === 'transfer' &&
          intent.recipient &&
          BigInt(intent.recipient) === BigInt(params.ctx.account.address);
        const delta = isSelfTransfer
          ? '0'
          : (intent.kind === 'deposit' ? amount : amount.negated()).toFixed();
        return projectPrivacyChainHistoryTxToPool({
          tx: {
            ...tx,
            privacyChainHistorySide: 'private',
            privacyChainHistoryPoolIds: [PRIVATE_HISTORY_POOL_ID],
            privacyChainHistoryPoolDeltas: { [PRIVATE_HISTORY_POOL_ID]: delta },
            privacyChainHistoryFeePoolId: 0,
            decodedTx,
          },
          selectedPoolId: PRIVATE_HISTORY_POOL_ID,
        });
      }),
    );
    params.ctx.assertSession();
    if (settled.length) {
      const latestConfirmed =
        await serviceHistory.getAccountLocalHistoryConfirmedTxs(query);
      const latestById = new Map(
        latestConfirmed.map((item) => [item.id, item]),
      );
      const mergedSettled = settled.map((item) => {
        const existing = latestById.get(item.id);
        if (
          !existing ||
          item.decodedTx.protocolFeeInNative !== undefined ||
          existing.decodedTx.protocolFeeInNative === undefined
        ) {
          return item;
        }
        return {
          ...item,
          decodedTx: {
            ...item.decodedTx,
            protocolFeeInNative: existing.decodedTx.protocolFeeInNative,
            totalFeeInNative:
              item.decodedTx.totalFeeInNative ??
              existing.decodedTx.totalFeeInNative,
            totalFeeFiatValue:
              item.decodedTx.totalFeeFiatValue ??
              existing.decodedTx.totalFeeFiatValue,
          },
        };
      });
      await this.deps.backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs(
        [
          {
            networkId: query.networkId,
            accountAddress: query.accountAddress,
            confirmedTxs: mergedSettled,
            confirmedTxsToSave: mergedSettled,
          },
        ],
      );
    }
    return projected;
  }
}
