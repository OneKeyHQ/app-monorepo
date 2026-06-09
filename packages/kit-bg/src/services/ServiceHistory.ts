import BigNumber from 'bignumber.js';
import { isNil, unionBy, uniqBy } from 'lodash';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type ILightningVault from '@onekeyhq/kit-bg/src/vaults/impls/lightning/Vault';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { HISTORY_TIME_RANGE_MONTHS } from '@onekeyhq/shared/src/consts/walletConsts';
import type { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  filterHistoryTxs,
  getOnChainHistoryTxStatus,
  isAccountCompatibleWithTx,
  isHistoryCursorAdvanced,
  sortHistoryTxsByTime,
} from '@onekeyhq/shared/src/utils/historyUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  PROMISE_CONCURRENCY_LIMIT,
  promiseAllSettledEnhanced,
} from '@onekeyhq/shared/src/utils/promiseUtils';
import {
  getPrivateSendHistoryDisplayStatus,
  isPrivateSendAccountHistoryTx,
  isPrivateSendSwapHistoryItem,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressBadge,
  IAddressInfo,
} from '@onekeyhq/shared/types/address';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAccountHistoryTx,
  IAllNetworkHistoryExtraItem,
  IChangedPendingTxInfo,
  IFetchAccountHistoryParams,
  IFetchAccountHistoryResp,
  IFetchHistoryTxDetailsParams,
  IFetchMergeDeriveAccountHistoryParams,
  IFetchTransferRecipientsResp,
  IFetchTxDetailsParams,
  IOnChainHistoryTx,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
  IServerFetchAccountHistoryDetailParams,
  ITransferRecipient,
} from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
import type {
  IReplaceTxInfo,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';
import {
  EBtcF2poolReplaceState,
  EDecodedTxStatus,
  EReplaceTxType,
} from '@onekeyhq/shared/types/tx';

import simpleDb from '../dbs/simple/simpleDb';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IAllNetworkAccountInfo } from './ServiceAllNetwork/ServiceAllNetwork';
import type { IDBAccount } from '../dbs/local/types';
import type { ISimpleDBAppStatus } from '../dbs/simple/entity/SimpleDbEntityAppStatus';
import type { IAccountDeriveTypes } from '../vaults/types';

const HISTORY_TIME_RANGE_MS = timerUtils.getTimeDurationMs({
  month: HISTORY_TIME_RANGE_MONTHS,
});

const PRIVATE_SEND_SWAP_HISTORY_TERMINAL_STATUSES = new Set([
  ESwapTxHistoryStatus.SUCCESS,
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.PARTIALLY_FILLED,
]);

type IHistoryDecodedAction = IAccountHistoryTx['decodedTx']['actions'][number];
type IHistoryDecodedTransfer = NonNullable<
  IHistoryDecodedAction['assetTransfer']
>['sends'][number];
type IPrivateSendSwapHistoryToken = ISwapTxHistory['baseInfo']['fromToken'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function shouldPreferPrivateSendSwapHistory(
  next: ISwapTxHistory,
  current: ISwapTxHistory,
) {
  const isNextTerminal = PRIVATE_SEND_SWAP_HISTORY_TERMINAL_STATUSES.has(
    next.status,
  );
  const isCurrentTerminal = PRIVATE_SEND_SWAP_HISTORY_TERMINAL_STATUSES.has(
    current.status,
  );

  if (isNextTerminal !== isCurrentTerminal) {
    return isNextTerminal;
  }

  return (
    (next.date.updated ?? next.date.created) >
    (current.date.updated ?? current.date.created)
  );
}

function mergeNullishRecordFields<T extends Record<string, unknown>>({
  primary,
  fallback,
}: {
  primary: T;
  fallback: T;
}) {
  const result: Record<string, unknown> = { ...primary };
  Object.entries(fallback).forEach(([key, fallbackValue]) => {
    const primaryValue = result[key];
    if (primaryValue === undefined || primaryValue === null) {
      if (fallbackValue !== undefined && fallbackValue !== null) {
        result[key] = fallbackValue;
      }
      return;
    }
    if (isRecord(primaryValue) && isRecord(fallbackValue)) {
      result[key] = mergeNullishRecordFields({
        primary: primaryValue,
        fallback: fallbackValue,
      });
    }
  });
  return result as T;
}

function mergePrivateSendPayloadFields({
  localPayload,
  onChainPayload,
}: {
  localPayload: IAccountHistoryTx['decodedTx']['payload'];
  onChainPayload: IAccountHistoryTx['decodedTx']['payload'];
}): IAccountHistoryTx['decodedTx']['payload'] {
  if (!localPayload) {
    return onChainPayload;
  }
  if (!onChainPayload) {
    return localPayload;
  }

  const nextPayload = mergeNullishRecordFields({
    primary: onChainPayload as unknown as Record<string, unknown>,
    fallback: localPayload as unknown as Record<string, unknown>,
  }) as IAccountHistoryTx['decodedTx']['payload'];

  const localPrivateSend = localPayload.privateSend;
  const onChainPrivateSend = onChainPayload.privateSend;
  if (localPrivateSend && onChainPrivateSend) {
    return {
      ...nextPayload,
      privateSend: mergeNullishRecordFields({
        primary: onChainPrivateSend as unknown as Record<string, unknown>,
        fallback: localPrivateSend as unknown as Record<string, unknown>,
      }) as NonNullable<
        IAccountHistoryTx['decodedTx']['payload']
      >['privateSend'],
    } as IAccountHistoryTx['decodedTx']['payload'];
  }

  return nextPayload;
}

function mergePrivateSendExtraInfoFields({
  localExtraInfo,
  onChainExtraInfo,
}: {
  localExtraInfo: IAccountHistoryTx['decodedTx']['extraInfo'];
  onChainExtraInfo: IAccountHistoryTx['decodedTx']['extraInfo'];
}) {
  if (!localExtraInfo) {
    return onChainExtraInfo;
  }
  if (!onChainExtraInfo) {
    return localExtraInfo;
  }
  if (!isRecord(localExtraInfo) || !isRecord(onChainExtraInfo)) {
    return onChainExtraInfo;
  }

  return mergeNullishRecordFields({
    primary: onChainExtraInfo,
    fallback: localExtraInfo,
  }) as IAccountHistoryTx['decodedTx']['extraInfo'];
}

function getPrivateSendPositivePriceValue(value?: number | string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const valueBN = new BigNumber(value);
  if (valueBN.isNaN() || !valueBN.isFinite() || !valueBN.isGreaterThan(0)) {
    return undefined;
  }

  return valueBN.toFixed();
}

function hasPrivateSendTransferPrice(transfer?: IHistoryDecodedTransfer) {
  return !!getPrivateSendPositivePriceValue(transfer?.price);
}

function hasPrivateSendSwapHistoryTokenPrice(
  token?: IPrivateSendSwapHistoryToken,
) {
  return !!getPrivateSendPositivePriceValue(token?.price);
}

function normalizePrivateSendTransferTokenId(tokenId?: string) {
  return tokenId?.trim().toLowerCase() ?? '';
}

function isSamePrivateSendTransferSwapToken({
  transfer,
  token,
}: {
  transfer: IHistoryDecodedTransfer;
  token?: IPrivateSendSwapHistoryToken;
}) {
  if (!token) {
    return false;
  }

  if (
    normalizePrivateSendTransferTokenId(transfer.tokenIdOnNetwork) &&
    normalizePrivateSendTransferTokenId(transfer.tokenIdOnNetwork) ===
      normalizePrivateSendTransferTokenId(token.contractAddress)
  ) {
    return true;
  }

  return Boolean(
    (!transfer.networkId ||
      !token.networkId ||
      transfer.networkId === token.networkId) &&
    (transfer.isNative || !transfer.tokenIdOnNetwork) &&
    (token.isNative || !token.contractAddress),
  );
}

function isSamePrivateSendTransferForPrice({
  localTransfer,
  onChainTransfer,
}: {
  localTransfer: IHistoryDecodedTransfer;
  onChainTransfer: IHistoryDecodedTransfer;
}) {
  return (
    localTransfer.amount === onChainTransfer.amount &&
    localTransfer.symbol === onChainTransfer.symbol &&
    localTransfer.isNative === onChainTransfer.isNative &&
    normalizePrivateSendTransferTokenId(localTransfer.tokenIdOnNetwork) ===
      normalizePrivateSendTransferTokenId(onChainTransfer.tokenIdOnNetwork)
  );
}

function findPrivateSendLocalTransferWithPrice({
  localTransfers,
  onChainTransfer,
  index,
}: {
  localTransfers: IHistoryDecodedTransfer[];
  onChainTransfer: IHistoryDecodedTransfer;
  index: number;
}) {
  const sameIndexTransfer = localTransfers[index];
  if (
    sameIndexTransfer &&
    hasPrivateSendTransferPrice(sameIndexTransfer) &&
    isSamePrivateSendTransferForPrice({
      localTransfer: sameIndexTransfer,
      onChainTransfer,
    })
  ) {
    return sameIndexTransfer;
  }

  return localTransfers.find(
    (localTransfer) =>
      hasPrivateSendTransferPrice(localTransfer) &&
      isSamePrivateSendTransferForPrice({
        localTransfer,
        onChainTransfer,
      }),
  );
}

function mergePrivateSendTransferPrices({
  localTransfers,
  onChainTransfers,
}: {
  localTransfers: IHistoryDecodedTransfer[];
  onChainTransfers: IHistoryDecodedTransfer[];
}) {
  let updated = false;
  const transfers = onChainTransfers.map((onChainTransfer, index) => {
    if (hasPrivateSendTransferPrice(onChainTransfer)) {
      return onChainTransfer;
    }

    const localTransfer = findPrivateSendLocalTransferWithPrice({
      localTransfers,
      onChainTransfer,
      index,
    });
    if (!localTransfer?.price) {
      return onChainTransfer;
    }

    updated = true;
    return {
      ...onChainTransfer,
      price: localTransfer.price,
    };
  });

  return { transfers, updated };
}

function getPrivateSendAssetTransferActions(actions?: IHistoryDecodedAction[]) {
  return actions?.filter((action) => !!action.assetTransfer) ?? [];
}

function mergePrivateSendActionTransferPrices({
  localActions,
  onChainActions,
}: {
  localActions?: IHistoryDecodedAction[];
  onChainActions?: IHistoryDecodedAction[];
}) {
  if (!onChainActions?.length) {
    return { actions: onChainActions, updated: false };
  }

  let assetTransferActionIndex = 0;
  let updated = false;
  const localAssetTransferActions =
    getPrivateSendAssetTransferActions(localActions);
  const actions = onChainActions.map((action) => {
    const { assetTransfer } = action;
    if (!assetTransfer) {
      return action;
    }

    const localAssetTransfer =
      localAssetTransferActions[assetTransferActionIndex]?.assetTransfer;
    assetTransferActionIndex += 1;
    if (!localAssetTransfer) {
      return action;
    }

    const sendsResult = mergePrivateSendTransferPrices({
      localTransfers: localAssetTransfer.sends,
      onChainTransfers: assetTransfer.sends,
    });
    const receivesResult = mergePrivateSendTransferPrices({
      localTransfers: localAssetTransfer.receives,
      onChainTransfers: assetTransfer.receives,
    });
    if (!sendsResult.updated && !receivesResult.updated) {
      return action;
    }

    updated = true;
    return {
      ...action,
      assetTransfer: {
        ...assetTransfer,
        sends: sendsResult.transfers,
        receives: receivesResult.transfers,
      },
    };
  });

  return { actions, updated };
}

function applyPrivateSendSwapHistoryTokenPriceToTransfers({
  transfers,
  token,
}: {
  transfers: IHistoryDecodedTransfer[];
  token: IPrivateSendSwapHistoryToken;
}) {
  if (!hasPrivateSendSwapHistoryTokenPrice(token)) {
    return { transfers, updated: false };
  }

  let updated = false;
  const nextTransfers = transfers.map((transfer) => {
    if (
      hasPrivateSendTransferPrice(transfer) ||
      !isSamePrivateSendTransferSwapToken({ transfer, token })
    ) {
      return transfer;
    }

    updated = true;
    return {
      ...transfer,
      price: token.price,
    };
  });

  return { transfers: nextTransfers, updated };
}

function applyPrivateSendSwapHistoryTokenPricesToActions({
  actions,
  swapHistory,
}: {
  actions?: IHistoryDecodedAction[];
  swapHistory: ISwapTxHistory;
}) {
  if (!actions?.length) {
    return { actions, updated: false };
  }

  let updated = false;
  const nextActions = actions.map((action) => {
    const { assetTransfer } = action;
    if (!assetTransfer) {
      return action;
    }

    const sendsResult = applyPrivateSendSwapHistoryTokenPriceToTransfers({
      transfers: assetTransfer.sends,
      token: swapHistory.baseInfo.fromToken,
    });
    const receivesResult = applyPrivateSendSwapHistoryTokenPriceToTransfers({
      transfers: assetTransfer.receives,
      token: swapHistory.baseInfo.toToken,
    });
    if (!sendsResult.updated && !receivesResult.updated) {
      return action;
    }

    updated = true;
    return {
      ...action,
      assetTransfer: {
        ...assetTransfer,
        sends: sendsResult.transfers,
        receives: receivesResult.transfers,
      },
    };
  });

  return { actions: nextActions, updated };
}

function applyPrivateSendSwapHistoryTokenPricesToHistoryTx({
  tx,
  swapHistory,
}: {
  tx: IAccountHistoryTx;
  swapHistory: ISwapTxHistory;
}) {
  const actionsResult = applyPrivateSendSwapHistoryTokenPricesToActions({
    actions: tx.decodedTx.actions,
    swapHistory,
  });
  const outputActionsResult = applyPrivateSendSwapHistoryTokenPricesToActions({
    actions: tx.decodedTx.outputActions,
    swapHistory,
  });
  if (!actionsResult.updated && !outputActionsResult.updated) {
    return tx;
  }

  return {
    ...tx,
    decodedTx: {
      ...tx.decodedTx,
      ...(actionsResult.updated ? { actions: actionsResult.actions } : {}),
      ...(outputActionsResult.updated
        ? { outputActions: outputActionsResult.actions }
        : {}),
    },
  };
}

function normalizePrivateSendHistoryAddress(address?: string) {
  const normalized = address?.trim();
  return normalized || '';
}

function isSamePrivateSendHistoryAddress(a?: string, b?: string) {
  const normalizedA = normalizePrivateSendHistoryAddress(a);
  const normalizedB = normalizePrivateSendHistoryAddress(b);
  if (!normalizedA || !normalizedB) {
    return false;
  }
  if (normalizedA === normalizedB) {
    return true;
  }
  const normalizedLowerA = normalizedA.toLowerCase();
  const normalizedLowerB = normalizedB.toLowerCase();
  if (normalizedLowerA.startsWith('0x') && normalizedLowerB.startsWith('0x')) {
    return normalizedLowerA === normalizedLowerB;
  }
  return false;
}

function getPrivateSendPayinAddressFromSwapHistory(
  swapHistory: ISwapTxHistory,
) {
  const payinAddress = isRecord(swapHistory.ctx)
    ? swapHistory.ctx.payinAddress
    : undefined;
  return typeof payinAddress === 'string'
    ? normalizePrivateSendHistoryAddress(payinAddress)
    : '';
}

function applyPrivateSendSwapHistoryRecipientToHistoryTx({
  tx,
  swapHistory,
}: {
  tx: IAccountHistoryTx;
  swapHistory: ISwapTxHistory;
}): IAccountHistoryTx {
  const payload = tx.decodedTx.payload;
  const privateSendPayload = payload?.privateSend ?? {};
  if (
    normalizePrivateSendHistoryAddress(privateSendPayload.originalRecipient)
  ) {
    return tx;
  }

  const receiver = normalizePrivateSendHistoryAddress(
    swapHistory.txInfo.receiver,
  );
  if (!payload || !receiver) {
    return tx;
  }

  const payinAddress = getPrivateSendPayinAddressFromSwapHistory(swapHistory);
  if (isSamePrivateSendHistoryAddress(receiver, payinAddress)) {
    return tx;
  }

  return {
    ...tx,
    decodedTx: {
      ...tx.decodedTx,
      payload: {
        ...payload,
        privateSend: {
          ...privateSendPayload,
          originalRecipient: receiver,
          ...(payinAddress && !privateSendPayload.payinAddress
            ? { payinAddress }
            : {}),
        },
      },
    },
  };
}

function mergePrivateSendLocalDecodedTxFields({
  localTx,
  onChainHistoryTx,
}: {
  localTx: IAccountHistoryTx;
  onChainHistoryTx: IAccountHistoryTx;
}): IAccountHistoryTx {
  if (!isPrivateSendAccountHistoryTx(localTx)) {
    return onChainHistoryTx;
  }

  const localPayload = localTx.decodedTx.payload;
  const localExtraInfo = localTx.decodedTx.extraInfo;
  const actionsResult = mergePrivateSendActionTransferPrices({
    localActions: localTx.decodedTx.actions,
    onChainActions: onChainHistoryTx.decodedTx.actions,
  });
  const outputActionsResult = mergePrivateSendActionTransferPrices({
    localActions: localTx.decodedTx.outputActions,
    onChainActions: onChainHistoryTx.decodedTx.outputActions,
  });
  if (
    !localPayload &&
    !localExtraInfo &&
    !actionsResult.updated &&
    !outputActionsResult.updated
  ) {
    return onChainHistoryTx;
  }

  return {
    ...onChainHistoryTx,
    decodedTx: {
      ...onChainHistoryTx.decodedTx,
      payload: mergePrivateSendPayloadFields({
        localPayload,
        onChainPayload: onChainHistoryTx.decodedTx.payload,
      }),
      extraInfo: mergePrivateSendExtraInfoFields({
        localExtraInfo,
        onChainExtraInfo: onChainHistoryTx.decodedTx.extraInfo,
      }),
      ...(actionsResult.updated ? { actions: actionsResult.actions } : {}),
      ...(outputActionsResult.updated
        ? { outputActions: outputActionsResult.actions }
        : {}),
    },
  };
}

// Sentinel value stored inside a merge-derive opaque cursor map to mark a
// deriveType that has finished paginating. Future pages skip it entirely
// instead of issuing a request that would just return an empty page.
const MERGE_DERIVE_EXHAUSTED = '__exhausted__' as const;

@backgroundClass()
class ServiceHistory extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // Clear the BTC replace-state memo on critical memory pressure;
    // pending-tx state in simpleDb is the authoritative source and
    // does not need an in-process cache.
    appEventBus.on(EAppEventBusNames.MemoryPressureWarning, (event) => {
      if (event.level !== 'critical') return;
      this.memoizedFetchBtcReplaceState.clear();
    });
  }

  private async attachPrivateSendDisplayStatus(
    txs: IAccountHistoryTx[],
  ): Promise<IAccountHistoryTx[]> {
    if (!txs.some((tx) => isPrivateSendAccountHistoryTx(tx))) {
      return txs;
    }

    const swapHistories =
      await this.backgroundApi.simpleDb.swapHistory.getSwapHistoryList();
    const privateSendSwapHistoryByTxId = new Map<string, ISwapTxHistory>();
    swapHistories.forEach((item) => {
      if (isPrivateSendSwapHistoryItem(item) && item.txInfo.txId) {
        const current = privateSendSwapHistoryByTxId.get(item.txInfo.txId);
        if (!current || shouldPreferPrivateSendSwapHistory(item, current)) {
          privateSendSwapHistoryByTxId.set(item.txInfo.txId, item);
        }
      }
    });

    return txs.map((tx) => {
      if (!isPrivateSendAccountHistoryTx(tx)) {
        return tx;
      }

      const swapHistory = privateSendSwapHistoryByTxId.get(tx.decodedTx.txid);
      if (!swapHistory) {
        return this.clearHistoryTxDisplayStatus(tx);
      }
      const txWithSwapHistoryRecipient =
        applyPrivateSendSwapHistoryRecipientToHistoryTx({
          tx,
          swapHistory,
        });
      const txWithSwapHistoryTokenPrices =
        applyPrivateSendSwapHistoryTokenPricesToHistoryTx({
          tx: txWithSwapHistoryRecipient,
          swapHistory,
        });

      const displayStatus = getPrivateSendHistoryDisplayStatus({
        historyTx: txWithSwapHistoryTokenPrices,
        swapHistory,
      });

      if (!displayStatus || displayStatus === tx.decodedTx.status) {
        return this.clearHistoryTxDisplayStatus(txWithSwapHistoryTokenPrices);
      }

      return {
        ...txWithSwapHistoryTokenPrices,
        displayStatus,
        displayStatusSource: 'privateSendOrder',
      };
    });
  }

  private clearHistoryTxDisplayStatus(tx: IAccountHistoryTx) {
    if (!tx.displayStatus && !tx.displayStatusSource) {
      return tx;
    }
    const { displayStatus, displayStatusSource, ...rest } = tx;
    return rest;
  }

  private isSameScopedHistoryTx(a: IAccountHistoryTx, b: IAccountHistoryTx) {
    if (
      a.decodedTx.networkId &&
      b.decodedTx.networkId &&
      a.decodedTx.networkId !== b.decodedTx.networkId
    ) {
      return false;
    }
    if (
      a.decodedTx.accountId &&
      b.decodedTx.accountId &&
      a.decodedTx.accountId !== b.decodedTx.accountId
    ) {
      return false;
    }
    if (
      a.decodedTx.owner &&
      b.decodedTx.owner &&
      a.decodedTx.owner.toLowerCase() !== b.decodedTx.owner.toLowerCase()
    ) {
      return false;
    }
    if (
      a.decodedTx.xpub &&
      b.decodedTx.xpub &&
      a.decodedTx.xpub !== b.decodedTx.xpub
    ) {
      return false;
    }

    if (
      a.id === b.id ||
      (!!a.originalId && a.originalId === b.id) ||
      (!!b.originalId && b.originalId === a.id) ||
      (!!a.originalId && a.originalId === b.originalId)
    ) {
      return true;
    }

    const aTxIds = [a.decodedTx.txid, a.decodedTx.originalTxId].filter(
      (txId): txId is string => !!txId,
    );
    const bTxIds = new Set(
      [b.decodedTx.txid, b.decodedTx.originalTxId].filter(
        (txId): txId is string => !!txId,
      ),
    );

    return aTxIds.some((txId) => bTxIds.has(txId));
  }

  private async _resolveHistoryRequestParams(
    params: IFetchAccountHistoryParams,
  ): Promise<IFetchAccountHistoryParams> {
    // AllNetworks aggregates server-side and does not accept the new pagination
    // contract — keep its request body untouched.
    if (networkUtils.isAllNetwork({ networkId: params.networkId })) {
      return params;
    }
    // First-page callers omit `page`; the new contract requires page=1 so the
    // backend can route consistently. Load-more callers already set page>1.
    const resolved: IFetchAccountHistoryParams =
      typeof params.page === 'number' ? params : { ...params, page: 1 };
    if (resolved.minTimestampMs || resolved.maxTimestampMs) {
      return resolved;
    }
    let network;
    try {
      network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId: resolved.networkId,
      });
    } catch {
      network = undefined;
    }
    // Indexer-backed chains (only EVM-like presets opt-in via
    // `backendIndex: true`) paginate without a time window. Everything else —
    // explicit `false`, or undefined — is treated as non-indexer so RPC-based
    // scans stay bounded by a 6-month window.
    if (network?.backendIndex === true) {
      return resolved;
    }
    const now = Date.now();
    return {
      ...resolved,
      minTimestampMs: now - HISTORY_TIME_RANGE_MS,
      maxTimestampMs: now,
    };
  }

  private _isHistoryLoadMoreParams(
    params: IFetchAccountHistoryParams,
  ): boolean {
    if (networkUtils.isAllNetwork({ networkId: params.networkId })) {
      return false;
    }
    if (typeof params.cursor === 'string' && params.cursor.length > 0) {
      return true;
    }
    if (typeof params.page === 'number' && params.page > 1) return true;
    return false;
  }

  // Opaque cursor for merge-derive aggregation: a JSON-encoded map from
  // deriveType to that deriveType's per-chain cursor (or '__exhausted__' once
  // the deriveType has run out of pages). The hook treats the whole string as
  // an opaque token; only this service encodes/decodes it.
  private _decodeMergeDeriveCursor(
    cursor: string | undefined,
  ): Record<string, string | typeof MERGE_DERIVE_EXHAUSTED> {
    if (!cursor) return {};
    try {
      const parsed = JSON.parse(cursor) as Record<string, string>;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // fall through — a malformed cursor is treated as a first-page request.
    }
    return {};
  }

  private _encodeMergeDeriveCursor(
    cursorMap: Record<string, string | typeof MERGE_DERIVE_EXHAUSTED>,
  ): string | undefined {
    const entries = Object.entries(cursorMap);
    if (entries.length === 0) return undefined;
    const hasAny = entries.some(([, v]) => v !== MERGE_DERIVE_EXHAUSTED);
    if (!hasAny) return undefined;
    return JSON.stringify(cursorMap);
  }

  private async _fetchMoreAccountHistory(params: IFetchAccountHistoryParams) {
    const {
      accountId,
      networkId,
      filterScam,
      filterLowValue,
      sourceCurrency,
      targetCurrency,
      currencyMap,
    } = params;
    let dbAccount;
    try {
      dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId,
      });
    } catch {
      dbAccount = undefined;
    }
    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        dbAccount,
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        dbAccount,
        accountId,
        networkId,
      }),
    ]);

    const onChainResult = await this.fetchAccountOnChainHistory({
      ...params,
      isAllNetworks: false,
      isManualRefresh: false,
      accountAddress,
      xpub,
    });

    const filtered = filterHistoryTxs({
      txs: onChainResult.txs,
      sourceCurrency,
      targetCurrency,
      currencyMap,
      filterScam,
      filterLowValue,
    });
    const txsWithPrivateSendDisplayStatus =
      await this.attachPrivateSendDisplayStatus(filtered);

    // Load-more is single-network (the AllNetworks branch never reaches here),
    // so resolve the logo once and stamp every tx instead of per-tx fetching.
    const logoNetwork = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    for (const tx of txsWithPrivateSendDisplayStatus) {
      tx.decodedTx.networkLogoURI = logoNetwork.logoURI;
    }

    return {
      hasMoreOnChainHistory: !!onChainResult.hasMore,
      next: onChainResult.next,
      // Indexer chains feed `next` back as `maxTimestampMs` (a strictly
      // decreasing ms timestamp); non-indexer chains treat `next` as opaque.
      // Surface this so the UI hook can pick the right cursor-advancement rule.
      isIndexer: !!onChainResult.isIndexer,
      accounts: [] as IAllNetworkAccountInfo[],
      allAccounts: [] as IAllNetworkAccountInfo[],
      txs: txsWithPrivateSendDisplayStatus,
      addressMap: onChainResult.addressMap,
      accountsWithChangedPendingTxs: [] as {
        accountId: string;
        networkId: string;
      }[],
      accountsWithChangedConfirmedTxs: [] as {
        accountId: string;
        networkId: string;
      }[],
      accountsWithChangedTxs: [] as { accountId: string; networkId: string }[],
    };
  }

  @backgroundMethod()
  public async fetchAccountHistory(params: IFetchAccountHistoryParams) {
    const resolvedParams = await this._resolveHistoryRequestParams(params);
    if (this._isHistoryLoadMoreParams(resolvedParams)) {
      return this._fetchMoreAccountHistory(resolvedParams);
    }
    const {
      accountId,
      networkId,
      tokenIdOnNetwork,
      filterScam,
      filterLowValue,
      sourceCurrency,
      targetCurrency,
      currencyMap,
      excludeTestNetwork,
      limit: _limit,
    } = resolvedParams;
    let dbAccount;
    try {
      dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId,
      });
    } catch (_error) {
      dbAccount = undefined;
    }
    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        dbAccount,
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        dbAccount,
        accountId,
        networkId,
      }),
    ]);

    const isAllNetworks = networkUtils.isAllNetwork({ networkId });

    let onChainHistoryTxs: IAccountHistoryTx[] = [];
    let localHistoryConfirmedTxs: IAccountHistoryTx[] = [];
    let localHistoryPendingTxs: IAccountHistoryTx[] = [];
    let accounts: IAllNetworkAccountInfo[] = [];
    let allAccounts: IAllNetworkAccountInfo[] = [];

    if (isAllNetworks) {
      const resp =
        await this.backgroundApi.serviceAllNetwork.getAllNetworkAccountsWithEnabledNetworks(
          {
            accountId,
            networkId,
            excludeTestNetwork,
          },
        );
      accounts = resp.accountsInfo;
      allAccounts = resp.allAccountsInfo;
    }

    // 1. Get the locally pending transactions

    if (isAllNetworks) {
      const allNetworksParams = accounts.map((account) => ({
        networkId: account.networkId,
        accountAddress: account.apiAddress,
        xpub: account.accountXpub,
      }));

      localHistoryPendingTxs =
        await this.getAccountsLocalHistoryPendingTxs(allNetworksParams);
    } else {
      localHistoryPendingTxs = await this.getAccountLocalHistoryPendingTxs({
        networkId,
        accountAddress,
        xpub,
        tokenIdOnNetwork,
      });
    }

    // 2. Check if the locally pending transactions have been confirmed

    // Confirmed transactions
    let confirmedTxs: IAccountHistoryTx[] = [];
    // Transactions still in pending status
    const pendingTxs: IAccountHistoryTx[] = [];

    // Fetch details of locally pending transactions
    const onChainHistoryTxsDetails = await promiseAllSettledEnhanced(
      localHistoryPendingTxs.map(
        (tx) => () =>
          this.fetchHistoryTxDetails({
            accountId: tx.decodedTx.accountId,
            networkId: tx.decodedTx.networkId,
            txid: tx.decodedTx.txid,
          }),
      ),
      { continueOnError: true, concurrency: PROMISE_CONCURRENCY_LIMIT },
    );

    for (const localHistoryPendingTx of localHistoryPendingTxs) {
      const confirmedTx = onChainHistoryTxsDetails.find(
        (txDetails) =>
          localHistoryPendingTx.decodedTx.txid === txDetails?.data.tx &&
          (txDetails.data.status === EOnChainHistoryTxStatus.Success ||
            txDetails.data.status === EOnChainHistoryTxStatus.Failed),
      );

      if (confirmedTx) {
        const confirmedTxNetworkId = localHistoryPendingTx.decodedTx.networkId;
        const vaultSettings =
          await this.backgroundApi.serviceNetwork.getVaultSettings({
            networkId: confirmedTxNetworkId,
          });
        let fixedLocalHistoryId: string | undefined;
        const remoteTxId = confirmedTx.data.eventId || confirmedTx.data.tx;
        // If the vault uses the remote transaction ID, the local transaction ID needs to be fixed, like Ton
        if (vaultSettings.useRemoteTxId) {
          const confirmedTxAccountAddress =
            await this.backgroundApi.serviceAccount.getAccountAddressForApi({
              accountId: localHistoryPendingTx.decodedTx.accountId,
              networkId: confirmedTxNetworkId,
            });
          fixedLocalHistoryId = accountUtils.buildLocalHistoryId({
            networkId: localHistoryPendingTx.decodedTx.networkId,
            accountAddress: confirmedTxAccountAddress,
            txid: remoteTxId,
          });
        }
        confirmedTxs.push({
          ...localHistoryPendingTx,
          originalId: localHistoryPendingTx.id,
          id: vaultSettings.useRemoteTxId
            ? fixedLocalHistoryId || localHistoryPendingTx.id
            : localHistoryPendingTx.id,
          decodedTx: {
            ...localHistoryPendingTx.decodedTx,
            txid: vaultSettings.useRemoteTxId
              ? remoteTxId
              : localHistoryPendingTx.decodedTx.txid,
            originalTxId: localHistoryPendingTx.decodedTx.originalTxId,
            status:
              confirmedTx?.data.status === EOnChainHistoryTxStatus.Success
                ? EDecodedTxStatus.Confirmed
                : EDecodedTxStatus.Failed,
            totalFeeInNative: isNil(confirmedTx.data.gasFee)
              ? localHistoryPendingTx.decodedTx.totalFeeInNative
              : confirmedTx.data.gasFee,
            totalFeeFiatValue: isNil(confirmedTx.data.gasFeeFiatValue)
              ? localHistoryPendingTx.decodedTx.totalFeeFiatValue
              : confirmedTx.data.gasFeeFiatValue,
            isFinal: true,
          },
        });
      } else {
        pendingTxs.push(localHistoryPendingTx);
      }
    }

    // Notify subscribers (e.g. DeFi scheduler) that locally-pending txs
    // submitted by this app have just transitioned to confirmed/failed.
    // Resolve indexedAccountId so UI subscribers in All Networks mode (where
    // the active account.id may not share a walletId with the tx's per-
    // network accountId) can do a reliable equality match.
    for (const tx of confirmedTxs) {
      const txAccountId = tx.decodedTx.accountId;
      const txDBAccount =
        await this.backgroundApi.serviceAccount.getDBAccountSafe({
          accountId: txAccountId,
        });
      appEventBus.emit(EAppEventBusNames.LocalPendingTxConfirmed, {
        accountId: txAccountId,
        indexedAccountId: txDBAccount?.indexedAccountId,
        networkId: tx.decodedTx.networkId,
        txid: tx.decodedTx.txid,
        status: tx.decodedTx.status,
      });
    }

    // 3. Get the locally confirmed transactions
    if (isAllNetworks) {
      const allNetworksParams = accounts.map((account) => ({
        networkId: account.networkId,
        accountAddress: account.apiAddress,
        xpub: account.accountXpub,
      }));

      localHistoryConfirmedTxs =
        await this.getAccountsLocalHistoryConfirmedTxs(allNetworksParams);
    } else {
      localHistoryConfirmedTxs = await this.getAccountLocalHistoryConfirmedTxs({
        networkId,
        accountAddress,
        xpub,
        tokenIdOnNetwork,
      });
    }

    // 4. Fetch the on-chain history
    const {
      txs,
      addressMap,
      hasMore: hasMoreOnChainHistory,
      next,
      isIndexer: isIndexerChain,
    } = await this.fetchAccountOnChainHistory({
      ...resolvedParams,
      isAllNetworks,
      accountAddress,
      xpub,
    });
    onChainHistoryTxs = txs;

    const privateSendDisplayStatusTxs =
      await this.attachPrivateSendDisplayStatus(
        unionBy(
          [...confirmedTxs, ...localHistoryConfirmedTxs, ...onChainHistoryTxs],
          (tx) => tx.id,
        ),
      );
    const privateSendDisplayStatusTxById = new Map(
      privateSendDisplayStatusTxs.map((tx) => [tx.id, tx]),
    );
    const withPrivateSendDisplayStatus = (txsToMap: IAccountHistoryTx[]) =>
      txsToMap.map((tx) => privateSendDisplayStatusTxById.get(tx.id) ?? tx);

    confirmedTxs = withPrivateSendDisplayStatus(confirmedTxs);
    localHistoryConfirmedTxs = withPrivateSendDisplayStatus(
      localHistoryConfirmedTxs,
    );
    onChainHistoryTxs = withPrivateSendDisplayStatus(onChainHistoryTxs);

    // 5. Merge the just-confirmed transactions, locally confirmed transactions, and on-chain history

    // Merge the locally confirmed transactions and the just-confirmed transactions
    const mergedConfirmedTxs = unionBy(
      [...confirmedTxs, ...localHistoryConfirmedTxs],
      (tx) => tx.id,
    );

    // Merge the merged confirmed transactions with the on-chain history

    let finalPendingTxs: IAccountHistoryTx[] = [];
    let confirmedTxsToSave: IAccountHistoryTx[] = [];

    if (isAllNetworks) {
      const allNetworksParams = (
        await promiseAllSettledEnhanced(
          accounts.map((account) => async () => {
            const filteredPendingTxs = pendingTxs.filter((tx) =>
              isAccountCompatibleWithTx({ account, tx }),
            );
            let pendingTxsToModify: IAccountHistoryTx[] = [];
            try {
              pendingTxsToModify = await this.getPendingTxsToModify({
                accountId: account.accountId,
                networkId: account.networkId,
                pendingTxs: filteredPendingTxs,
              });
            } catch (error) {
              console.error(
                `Failed to get pendingTxsToUpdate for account ${account.accountId}:`,
                error,
              );
              pendingTxsToModify = [];
            }
            return {
              networkId: account.networkId,
              accountAddress: account.apiAddress,
              xpub: account.accountXpub,
              pendingTxs: filteredPendingTxs,
              confirmedTxs: mergedConfirmedTxs.filter((tx) =>
                isAccountCompatibleWithTx({ account, tx }),
              ),
              onChainHistoryTxs: onChainHistoryTxs.filter((tx) =>
                isAccountCompatibleWithTx({ account, tx }),
              ),
              pendingTxsToModify,
            };
          }),
          { continueOnError: true, concurrency: PROMISE_CONCURRENCY_LIMIT },
        )
      ).filter(Boolean);

      const updateResult =
        await this.batchUpdateLocalHistoryTxs(allNetworksParams);
      finalPendingTxs = updateResult.allFinalPendingTxs;
      confirmedTxsToSave = updateResult.allConfirmedTxsToSave;
      onChainHistoryTxs = updateResult.allMergedOnChainHistoryTxs;
    } else {
      let pendingTxsToModify: IAccountHistoryTx[] = [];
      try {
        pendingTxsToModify = await this.getPendingTxsToModify({
          accountId,
          networkId,
          pendingTxs,
        });
      } catch (error) {
        console.error(
          `Failed to get pendingTxsToUpdate for account ${accountId}:`,
          error,
        );
        pendingTxsToModify = [];
      }

      const updateResult = await this.batchUpdateLocalHistoryTxs([
        {
          accountAddress,
          xpub,
          networkId,
          pendingTxs,
          confirmedTxs: mergedConfirmedTxs,
          onChainHistoryTxs,
          pendingTxsToModify,
        },
      ]);
      finalPendingTxs = updateResult.allFinalPendingTxs;
      confirmedTxsToSave = updateResult.allConfirmedTxsToSave;
      onChainHistoryTxs = updateResult.allMergedOnChainHistoryTxs;
    }

    // Merge the locally pending transactions, confirmed transactions, and on-chain history to return

    let result = unionBy(
      [
        ...finalPendingTxs,
        ...[...confirmedTxsToSave, ...onChainHistoryTxs].toSorted(
          (b, a) =>
            (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
            (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
        ),
      ],
      (tx) => tx.id,
    );

    for (let i = 0; i < result.length; i += 1) {
      const tx = result[i];
      const network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId: tx.decodedTx.networkId,
      });
      tx.decodedTx.networkLogoURI = network.logoURI;
    }

    result = await this.attachPrivateSendDisplayStatus(result);

    const accountsWithChangedPendingTxs = new Set<string>(); // accountId_networkId
    const accountsWithChangedConfirmedTxs = new Set<string>(); // accountId_networkId
    const changedPendingTxInfos: IChangedPendingTxInfo[] = [];
    localHistoryPendingTxs.forEach((tx) => {
      const txInResult = finalPendingTxs.find((item) =>
        this.isSameScopedHistoryTx(item, tx),
      );
      if (!txInResult) {
        accountsWithChangedPendingTxs.add(
          `${tx.decodedTx.accountId}_${tx.decodedTx.networkId}`,
        );
        const confirmedTx = result.find((item) =>
          this.isSameScopedHistoryTx(item, tx),
        );
        if (confirmedTx) {
          changedPendingTxInfos.push({
            accountId: confirmedTx.decodedTx.accountId,
            networkId: confirmedTx.decodedTx.networkId,
            txId: confirmedTx.decodedTx.txid,
            status: confirmedTx.decodedTx.status,
          });
        }
      }
    });

    // Find accounts with new on-chain confirmed transactions
    // (transactions that are on-chain but not in local confirmed history)
    onChainHistoryTxs.forEach((tx) => {
      const txInLocalConfirmed = localHistoryConfirmedTxs.find((item) =>
        this.isSameScopedHistoryTx(item, tx),
      );
      if (!txInLocalConfirmed) {
        accountsWithChangedConfirmedTxs.add(
          `${tx.decodedTx.accountId}_${tx.decodedTx.networkId}`,
        );
      }
    });

    if (changedPendingTxInfos.length > 0) {
      // Check if staking transaction status has changed, if so request backend to update order status
      await this.backgroundApi.serviceStaking.updateEarnOrder({
        txs: changedPendingTxInfos,
      });
    }

    result = filterHistoryTxs({
      txs: result,
      sourceCurrency,
      targetCurrency,
      currencyMap,
      filterScam,
      filterLowValue,
    });

    return {
      hasMoreOnChainHistory,
      next,
      // AllNetworks isn't paginated, so only the single-network branch
      // carries an indexer cursor.
      isIndexer: !isAllNetworks && !!isIndexerChain,
      accounts,
      allAccounts,
      txs: result,
      addressMap,
      accountsWithChangedPendingTxs: Array.from(
        accountsWithChangedPendingTxs,
      ).map((item) => {
        const [a, n] = item.split('_');
        return {
          accountId: a,
          networkId: n,
        };
      }),
      accountsWithChangedConfirmedTxs: Array.from(
        accountsWithChangedConfirmedTxs,
      ).map((item) => {
        const [a, n] = item.split('_');
        return {
          accountId: a,
          networkId: n,
        };
      }),
      accountsWithChangedTxs: Array.from(
        new Set([
          ...accountsWithChangedPendingTxs,
          ...accountsWithChangedConfirmedTxs,
        ]),
      ).map((item) => {
        const [a, n] = item.split('_');
        return {
          accountId: a,
          networkId: n,
        };
      }),
    };
  }

  // Aggregated history fetch for chains whose vault opts into
  // `mergeDeriveAssetsEnabled` (currently BTC / LTC). One indexed account fans
  // out into multiple deriveType-specific network accounts, each paginated
  // independently. Callers see a single `txs` list and a single opaque cursor;
  // this service handles the per-deriveType cursor bookkeeping internally so
  // the UI hook (useHistoryListLoadMore) stays uniform across chain types.
  @backgroundMethod()
  public async fetchAccountHistoryForMergeDerive(
    params: IFetchMergeDeriveAccountHistoryParams,
  ) {
    const {
      indexedAccountId,
      networkId,
      tokenIdOnNetwork,
      isManualRefresh,
      filterScam,
      filterLowValue,
      excludeTestNetwork,
      sourceCurrency,
      targetCurrency,
      currencyMap,
      limit,
      page,
      cursor,
    } = params;

    const { networkAccounts } =
      await this.backgroundApi.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId,
          indexedAccountId,
          excludeEmptyAccount: true,
        },
      );

    const cursorMap = this._decodeMergeDeriveCursor(cursor);
    // Derive load-more from the decoded map, not the raw `cursor` string —
    // a malformed cursor decodes to {} and must restart from page 1,
    // otherwise every deriveType would be requested with page=2 and no
    // per-deriveType cursor, which is an unsupported wire combination.
    const isLoadMore = Object.keys(cursorMap).length > 0;

    type IFetchedOutcome = {
      kind: 'fetched';
      deriveType: IAccountDeriveTypes;
      prevCursor: string | undefined;
      response: Awaited<ReturnType<ServiceHistory['fetchAccountHistory']>>;
    };
    type IPerTypeOutcome =
      | { kind: 'skipped'; deriveType: IAccountDeriveTypes }
      | IFetchedOutcome;

    const perTypeOutcomes = (
      await Promise.all(
        networkAccounts.map(async (na): Promise<IPerTypeOutcome | null> => {
          const accountId = na.account?.id;
          const { deriveType } = na;
          if (!accountId) return null;

          const stored = cursorMap[deriveType];
          // Already finished paginating this deriveType in a prior page — skip
          // outright so we neither issue a request nor count it toward
          // `hasMore`.
          if (stored === MERGE_DERIVE_EXHAUSTED) {
            return { kind: 'skipped', deriveType };
          }

          const perCursor =
            typeof stored === 'string' && stored.length > 0
              ? stored
              : undefined;

          const subParams: IFetchAccountHistoryParams = {
            accountId,
            networkId,
            tokenIdOnNetwork,
            isManualRefresh,
            filterScam,
            filterLowValue,
            excludeTestNetwork,
            sourceCurrency,
            targetCurrency,
            currencyMap,
            limit,
            page: isLoadMore ? (page ?? 2) : 1,
            ...(perCursor ? { cursor: perCursor } : {}),
          };

          const response = await this.fetchAccountHistory(subParams);
          return {
            kind: 'fetched',
            deriveType,
            prevCursor: perCursor,
            response,
          };
        }),
      )
    ).filter((o): o is IPerTypeOutcome => o !== null);

    const nextCursorMap: Record<
      string,
      string | typeof MERGE_DERIVE_EXHAUSTED
    > = {};
    const aggregatedTxs: IAccountHistoryTx[] = [];
    const aggregatedAddressMap: Record<string, IAddressBadge> = {};
    const pendingByKey = new Map<
      string,
      { accountId: string; networkId: string }
    >();
    const confirmedByKey = new Map<
      string,
      { accountId: string; networkId: string }
    >();
    const aggregatedAllAccounts: IAllNetworkAccountInfo[] = [];
    const keyOf = (i: { accountId: string; networkId: string }) =>
      `${i.accountId}_${i.networkId}`;

    for (const outcome of perTypeOutcomes) {
      if (outcome.kind === 'skipped') {
        nextCursorMap[outcome.deriveType] = MERGE_DERIVE_EXHAUSTED;
      } else {
        const { deriveType, prevCursor, response } = outcome;
        aggregatedTxs.push(...response.txs);
        Object.assign(aggregatedAddressMap, response.addressMap);
        for (const item of response.accountsWithChangedPendingTxs) {
          pendingByKey.set(keyOf(item), item);
        }
        for (const item of response.accountsWithChangedConfirmedTxs) {
          confirmedByKey.set(keyOf(item), item);
        }
        aggregatedAllAccounts.push(...response.allAccounts);

        const nextCursor =
          typeof response.next === 'string' && response.next.length > 0
            ? response.next
            : undefined;
        const advanced = isHistoryCursorAdvanced(prevCursor, nextCursor, {
          indexerTimestampCursor: !!response.isIndexer,
        });
        const keepCursor =
          response.hasMoreOnChainHistory &&
          response.txs.length > 0 &&
          nextCursor &&
          advanced;
        nextCursorMap[deriveType] = keepCursor
          ? nextCursor
          : MERGE_DERIVE_EXHAUSTED;
      }
    }

    // BTC/LTC deriveTypes own disjoint xpubs so tx ids do not overlap in
    // practice, but defensively dedupe by id before sorting so future chains
    // with overlapping derive paths don't surface duplicates here.
    const mergedTxs = sortHistoryTxsByTime({
      txs: unionBy(aggregatedTxs, (tx) => tx.id),
    });

    const dedupedPending = Array.from(pendingByKey.values());
    const dedupedConfirmed = Array.from(confirmedByKey.values());
    const dedupedAll = Array.from(
      new Map([...pendingByKey, ...confirmedByKey]).values(),
    );

    const hasMore = Object.values(nextCursorMap).some(
      (v) => v !== MERGE_DERIVE_EXHAUSTED,
    );
    const nextOpaque = hasMore
      ? this._encodeMergeDeriveCursor(nextCursorMap)
      : undefined;
    // Surfaced so downstream callers know whether per-deriveType cursors were
    // timestamps without re-deriving it from the network.
    const aggregatedIsIndexer = perTypeOutcomes.some(
      (o) => o.kind === 'fetched' && !!o.response.isIndexer,
    );

    return {
      hasMoreOnChainHistory: hasMore,
      next: nextOpaque,
      isIndexer: aggregatedIsIndexer,
      accounts: [] as IAllNetworkAccountInfo[],
      allAccounts: uniqBy(aggregatedAllAccounts, 'networkId'),
      txs: mergedTxs,
      addressMap: aggregatedAddressMap,
      accountsWithChangedPendingTxs: dedupedPending,
      accountsWithChangedConfirmedTxs: dedupedConfirmed,
      accountsWithChangedTxs: dedupedAll,
    };
  }

  @backgroundMethod()
  public async getAccountsLocalHistoryTxs({
    accountId,
    networkId,
    filterScam,
    filterLowValue,
    sourceCurrency,
    targetCurrency,
    currencyMap,
    excludeTestNetwork,
  }: {
    accountId: string;
    networkId: string;
    filterScam?: boolean;
    filterLowValue?: boolean;
    excludeTestNetwork?: boolean;
    sourceCurrency?: string;
    targetCurrency?: string;
    currencyMap?: Record<string, ICurrencyItem>;
  }) {
    if (networkUtils.isAllNetwork({ networkId })) {
      const accounts = (
        await this.backgroundApi.serviceAllNetwork.getAllNetworkAccountsWithEnabledNetworks(
          {
            accountId,
            networkId,
            excludeTestNetwork,
          },
        )
      ).accountsInfo;
      const allNetworksParams = accounts.map((account) => ({
        networkId: account.networkId,
        accountAddress: account.apiAddress,
        xpub: account.accountXpub,
      }));
      const localHistoryConfirmedTxs =
        await this.getAccountsLocalHistoryConfirmedTxs(allNetworksParams);

      const localHistoryPendingTxs =
        await this.getAccountsLocalHistoryPendingTxs(allNetworksParams);

      const result = unionBy(
        [
          ...localHistoryPendingTxs,
          ...localHistoryConfirmedTxs.toSorted(
            (b, a) =>
              (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
              (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
          ),
        ],
        (tx) => tx.id,
      );

      for (let i = 0; i < result.length; i += 1) {
        const tx = result[i];
        const network = await this.backgroundApi.serviceNetwork.getNetwork({
          networkId: tx.decodedTx.networkId,
        });
        tx.decodedTx.networkLogoURI = network.logoURI;
      }

      const resultWithPrivateSendDisplayStatus =
        await this.attachPrivateSendDisplayStatus(result);

      return filterHistoryTxs({
        txs: resultWithPrivateSendDisplayStatus,
        sourceCurrency,
        targetCurrency,
        currencyMap,
        filterScam,
        filterLowValue,
      });
    }
    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
    ]);

    const localHistoryConfirmedTxs =
      await this.getAccountLocalHistoryConfirmedTxs({
        networkId,
        accountAddress,
        xpub,
      });
    const localHistoryPendingTxs = await this.getAccountLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
    });

    const result = unionBy(
      [...localHistoryPendingTxs, ...localHistoryConfirmedTxs],
      (tx) => tx.id,
    );

    const resultWithPrivateSendDisplayStatus =
      await this.attachPrivateSendDisplayStatus(result);

    return filterHistoryTxs({
      txs: resultWithPrivateSendDisplayStatus,
      filterScam,
      filterLowValue,
      sourceCurrency,
      targetCurrency,
      currencyMap,
    });
  }

  @backgroundMethod()
  public async getAllNetworksPendingTxs({
    accountId,
    networkId,
    allNetworkAccounts,
  }: {
    accountId: string;
    networkId: string;
    allNetworkAccounts?: IAllNetworkAccountInfo[];
  }) {
    const accounts =
      allNetworkAccounts ||
      (
        await this.backgroundApi.serviceAllNetwork.getAllNetworkAccountsWithEnabledNetworks(
          {
            accountId,
            networkId,
          },
        )
      ).accountsInfo;

    const allNetworksParams = accounts.map((account) => ({
      networkId: account.networkId,
      accountAddress: account.apiAddress,
      xpub: account.accountXpub,
    }));

    const allNetworksPendingTxs =
      await this.getAccountsLocalHistoryPendingTxs(allNetworksParams);

    return allNetworksPendingTxs;
  }

  @backgroundMethod()
  async batchUpdateLocalHistoryTxs(
    params: {
      accountAddress: string;
      xpub?: string;
      networkId: string;
      onChainHistoryTxs: IAccountHistoryTx[];
      confirmedTxs: IAccountHistoryTx[];
      pendingTxs: IAccountHistoryTx[];
      pendingTxsToModify: IAccountHistoryTx[];
    }[],
  ) {
    const allConfirmedTxsToSave: IAccountHistoryTx[] = [];
    const allMergedOnChainHistoryTxs: IAccountHistoryTx[] = [];
    const allNonceHasBeenUsedTxs: IAccountHistoryTx[] = [];
    const allFinalPendingTxs: IAccountHistoryTx[] = [];

    const updateQuery: {
      accountAddress: string;
      xpub?: string;
      networkId: string;
      confirmedTxs?: IAccountHistoryTx[];
      confirmedTxsToSave?: IAccountHistoryTx[];
      confirmedTxsToRemove?: IAccountHistoryTx[];
      pendingTxsToModify?: IAccountHistoryTx[];
    }[] = [];

    for (const param of params) {
      const {
        accountAddress,
        xpub,
        networkId,
        onChainHistoryTxs,
        confirmedTxs,
        pendingTxs,
        pendingTxsToModify,
      } = param;
      const localHistoryTxs = [...confirmedTxs, ...pendingTxs];
      const mergedOnChainHistoryTxs = onChainHistoryTxs.map(
        (onChainHistoryTx) => {
          const localHistoryTx = localHistoryTxs.find((tx) =>
            this.isSameScopedHistoryTx(onChainHistoryTx, tx),
          );
          return localHistoryTx
            ? mergePrivateSendLocalDecodedTxFields({
                localTx: localHistoryTx,
                onChainHistoryTx,
              })
            : onChainHistoryTx;
        },
      );
      allMergedOnChainHistoryTxs.push(...mergedOnChainHistoryTxs);

      // Find transactions confirmed through history details query but not in on-chain history, these need to be saved
      let confirmedTxsToSave: IAccountHistoryTx[] = [];

      confirmedTxsToSave = confirmedTxs
        .map((tx) => {
          const onChainHistoryTx = mergedOnChainHistoryTxs.find((item) =>
            this.isSameScopedHistoryTx(item, tx),
          );
          if (onChainHistoryTx) {
            return onChainHistoryTx;
          }
          return tx;
        })
        .filter((tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending);

      const resp = unionBy(
        [...mergedOnChainHistoryTxs, ...confirmedTxsToSave],
        (tx) => tx.id,
      );

      const finalConfirmedTxs = [];
      const confirmedTxsToRemove = [];

      for (let i = 0; i < resp.length; i += 1) {
        const tx = resp[i];
        if (
          tx.decodedTx.status === EDecodedTxStatus.Pending ||
          (!isNil(xpub) &&
            !isNil(tx.decodedTx.xpub) &&
            xpub !== tx.decodedTx.xpub)
        ) {
          confirmedTxsToRemove.push(tx);
        } else {
          finalConfirmedTxs.push(tx);
        }
      }

      const vaultSettings =
        await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });

      const nonceHasBeenUsedTxs: IAccountHistoryTx[] = [];
      let finalPendingTxs: IAccountHistoryTx[] = [];
      if (vaultSettings.nonceRequired) {
        pendingTxs.forEach((tx) => {
          if (
            onChainHistoryTxs.find(
              (onChainHistoryTx) =>
                !isNil(onChainHistoryTx.decodedTx.nonce) &&
                !isNil(tx.decodedTx.nonce) &&
                onChainHistoryTx.decodedTx.nonce === tx.decodedTx.nonce,
            )
          ) {
            nonceHasBeenUsedTxs.push(tx);
          } else {
            finalPendingTxs.push(tx);
          }
        });
      } else {
        finalPendingTxs = pendingTxs;
      }

      // For fast-confirming chains (e.g. Solana), fetchHistoryTxDetails may be
      // slower than fetchAccountOnChainHistory. When on-chain history already
      // contains a confirmed tx that matches a local pending tx by ID, we must
      // filter it out of finalPendingTxs so that accountsWithChangedPendingTxs
      // detection fires and the pending record is cleaned from simpleDb.
      const onChainMatchedPendingTxs: IAccountHistoryTx[] = [];
      finalPendingTxs = finalPendingTxs.filter((tx) => {
        const matched = onChainHistoryTxs.find((onChainTx) =>
          this.isSameScopedHistoryTx(onChainTx, tx),
        );
        if (matched) {
          onChainMatchedPendingTxs.push(tx);
          return false;
        }
        return true;
      });

      allNonceHasBeenUsedTxs.push(...nonceHasBeenUsedTxs);
      allFinalPendingTxs.push(...finalPendingTxs);
      allConfirmedTxsToSave.push(...confirmedTxsToSave);

      updateQuery.push({
        networkId,
        accountAddress,
        xpub,
        confirmedTxs: [
          ...confirmedTxs,
          ...nonceHasBeenUsedTxs,
          ...onChainMatchedPendingTxs,
        ],
        confirmedTxsToSave: finalConfirmedTxs,
        confirmedTxsToRemove,
        pendingTxsToModify,
      });
    }

    await this.backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs(
      updateQuery,
    );

    return {
      allConfirmedTxsToSave,
      allMergedOnChainHistoryTxs,
      allNonceHasBeenUsedTxs,
      allFinalPendingTxs,
    };
  }

  @backgroundMethod()
  async getPendingTxsToModify(params: {
    accountId: string;
    networkId: string;
    pendingTxs: IAccountHistoryTx[];
  }) {
    const { accountId, networkId } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const pendingTxsToUpdate = await vault.getPendingTxsToUpdate({
      pendingTxs: params.pendingTxs,
    });
    return pendingTxsToUpdate;
  }

  @backgroundMethod()
  async buildFetchHistoryListParams(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
  }) {
    const { networkId, accountId } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildFetchHistoryListParams(params);
  }

  @backgroundMethod()
  public async fetchAccountOnChainHistory(
    params: IFetchAccountHistoryParams & {
      accountAddress: string;
      xpub?: string;
    },
  ) {
    const {
      accountId,
      networkId,
      xpub,
      tokenIdOnNetwork,
      accountAddress,
      isManualRefresh,
      isAllNetworks,
      filterScam,
      filterLowValue,
      limit,
      page,
      cursor,
      minTimestampMs,
      maxTimestampMs,
    } = params;
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });

    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId,
      });
    if (isCustomNetwork) {
      return {
        txs: [],
        addressMap: {},
        hasMore: false,
        next: undefined as string | undefined,
        isIndexer: false,
      };
    }

    let networkInfo;
    try {
      networkInfo = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId,
      });
    } catch {
      networkInfo = undefined;
    }
    const isIndexerChain = networkInfo?.backendIndex === true;

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    let resp;
    let extraParams: any;
    const fetchHistoryFromServer = async () => {
      extraParams = await this.buildFetchHistoryListParams(params);
      let extraRequestParams = extraParams;
      if (networkId === getNetworkIdsMap().onekeyall) {
        extraRequestParams = {
          allNetworkAccounts: (
            extraParams as unknown as {
              allNetworkAccounts: IAllNetworkHistoryExtraItem[];
            }
          ).allNetworkAccounts.map((i) => ({
            networkId: i.networkId,
            accountAddress: i.accountAddress,
            xpub: i.accountXpub,
          })),
        };
      }
      const normalizedCursor =
        typeof cursor === 'string' && cursor.length > 0 ? cursor : undefined;

      // Indexer chains paginate via maxTimestampMs only — the backend's
      // `next` is a millisecond timestamp that we feed back as the upper
      // bound of the next request. They never carry `page` or `cursor` on
      // the wire. Non-indexer chains keep the page+cursor contract.
      const paginationBody: Record<string, number | string> = {};
      if (isIndexerChain) {
        if (normalizedCursor) {
          const ts = Number(normalizedCursor);
          if (Number.isFinite(ts)) {
            paginationBody.maxTimestampMs = ts;
          }
        } else if (typeof maxTimestampMs === 'number') {
          paginationBody.maxTimestampMs = maxTimestampMs;
        }
      } else {
        if (typeof page === 'number') paginationBody.page = page;
        if (normalizedCursor) paginationBody.cursor = normalizedCursor;
        if (typeof minTimestampMs === 'number') {
          paginationBody.minTimestampMs = minTimestampMs;
        }
        if (typeof maxTimestampMs === 'number') {
          paginationBody.maxTimestampMs = maxTimestampMs;
        }
      }

      return client.post<{ data: IFetchAccountHistoryResp }>(
        '/wallet/v1/account/history/list',
        {
          networkId,
          accountAddress,
          xpub,
          tokenAddress: tokenIdOnNetwork,
          ...extraRequestParams,
          isForceRefresh: isManualRefresh,
          isAllNetwork: isAllNetworks,
          onlySafe: filterScam,
          withoutDust: filterLowValue,
          limit,
          ...paginationBody,
        },
        {
          headers: {
            ...(await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              {
                accountId: params.accountId,
              },
            )),
            // Authenticate this request only so the server can attach per-user
            // KYT risk data, without authenticating the whole shared wallet client.
            // Watch-only accounts are excluded from KYT: withhold the token so the
            // server never enrols their addresses (no queue / no data / no push).
            ...(accountUtils.isWatchingAccount({ accountId: params.accountId })
              ? {}
              : await this.getOneKeyIdAuthHeaders()),
          },
        },
      );
    };
    try {
      resp = await fetchHistoryFromServer();
    } catch (e) {
      const error = e as OneKeyServerApiError;
      // Exchange the token on the first error to ensure subsequent polling requests succeed
      if (error.data?.code === 50_401) {
        // 50401 -> Lightning service special error code
        await (vault as ILightningVault).exchangeToken();
        resp = await fetchHistoryFromServer();
      } else {
        throw e;
      }
    }

    const {
      data: onChainHistoryTxs,
      tokens,
      nfts,
      addressMap,
      hasMore,
      next: rawNext,
    } = resp.data.data;
    // Backend contract: `next` is a string cursor, but some chains return a
    // numeric offset that needs string-coercion before being sent back as the
    // next request's `cursor`. null / undefined / empty string mean "no more".
    const next =
      rawNext === null || rawNext === undefined || (rawNext as unknown) === ''
        ? undefined
        : String(rawNext);

    const dbAccountCache: {
      [accountId: string]: IDBAccount;
    } = {};

    const txs = (
      await Promise.all(
        onChainHistoryTxs.map((tx, index) =>
          vault.buildOnChainHistoryTx({
            dbAccountCache,
            accountId,
            networkId,
            accountAddress,
            xpub,
            onChainHistoryTx: tx,
            tokens,
            nfts,
            index,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            allNetworkHistoryExtraItems: extraParams?.allNetworkAccounts,
          }),
        ),
      )
    ).filter(Boolean);

    return {
      txs,
      addressMap,
      hasMore,
      next,
      isIndexer: isIndexerChain,
    };
  }

  @backgroundMethod()
  public async fetchTransferRecipients(params: {
    accountId: string;
    networkId: string;
    limit?: number;
  }): Promise<{
    supported: boolean;
    data: ITransferRecipient[];
    lastUsedDeriveType?: string;
  }> {
    const { accountId, networkId, limit = 10 } = params;

    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });

    // For merge-derive chains (BTC/LTC) one user-facing account owns
    // multiple xpubs; the /transfer-recipient API is xpub-scoped so we must
    // call it once per xpub and merge, otherwise the result only reflects
    // the derive type of the currently-selected address (OK-52897).
    const xpubEntries =
      await this.backgroundApi.serviceAccount.safeGetAccountXpubsForAllDeriveTypes(
        {
          accountId,
          networkId,
        },
      );

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const headers =
      await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
        accountId,
      });

    const callOnce = async (xpub: string | undefined, perCallLimit: number) => {
      try {
        const resp = await client.get<{ data: IFetchTransferRecipientsResp }>(
          '/wallet/v1/account/transfer-recipient',
          {
            params: {
              networkId,
              accountAddress,
              limit: perCallLimit,
              xpub,
            },
            headers,
          },
        );
        const { supported, data } = resp.data.data;
        return { supported: supported ?? true, data: data ?? [] };
      } catch (error) {
        console.error('Failed to fetch transfer recipients:', error);
        return { supported: false, data: [] as ITransferRecipient[] };
      }
    };

    if (xpubEntries.length <= 1) {
      return callOnce(xpubEntries[0]?.xpub, limit);
    }

    // Each xpub requests the full limit so that addresses concentrated
    // on a single derive path aren't truncated (e.g. all 20 recent sends
    // via Native SegWit). The response per xpub is small (~20 addresses).
    const settled = await promiseAllSettledEnhanced(
      xpubEntries.map((entry) => async () => ({
        deriveType: entry.deriveType,
        ...(await callOnce(entry.xpub, limit)),
      })),
      { continueOnError: true, concurrency: xpubEntries.length },
    );
    const responses = settled.filter(
      (
        r,
      ): r is {
        deriveType: IAccountDeriveTypes;
        supported: boolean;
        data: ITransferRecipient[];
      } => !!r,
    );

    // A single derive-path returning supported=true is enough to mark the
    // whole query as supported; the merged list is deduped by lowercase
    // address and sorted by most-recent time.
    const anySupported = responses.some((r) => r.supported);
    const seenIndex = new Map<string, number>();
    const merged: ITransferRecipient[] = [];
    // Track which derive type produced the newest record overall,
    // so the Accounts tab can default to it (e.g. user last sent via Taproot).
    let newestTime = 0;
    let newestDeriveType: string | undefined;
    for (const r of responses) {
      for (const item of r.data) {
        if (item.time > newestTime) {
          newestTime = item.time;
          newestDeriveType = r.deriveType;
        }
        const key = item.address.toLowerCase();
        const existingIdx = seenIndex.get(key);
        if (existingIdx === undefined) {
          seenIndex.set(key, merged.length);
          merged.push(item);
        } else if (item.time > (merged[existingIdx].time ?? 0)) {
          merged[existingIdx] = item;
        }
      }
    }
    merged.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
    return {
      supported: anySupported,
      data: merged.slice(0, limit),
      lastUsedDeriveType: newestDeriveType,
    };
  }

  @backgroundMethod()
  public async fetchHistoryTxDetails(params: IFetchHistoryTxDetailsParams) {
    try {
      const { accountId, networkId, txid, withUTXOs } = params;

      let accountAddress = params.accountAddress;
      let xpub = params.xpub;

      try {
        const [a, x] = await Promise.all([
          this.backgroundApi.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          }),
          this.backgroundApi.serviceAccount.getAccountXpub({
            accountId,
            networkId,
          }),
        ]);
        accountAddress = a;
        xpub = x;
      } catch (_e) {
        // pass
      }

      const extraParams = await this.buildFetchHistoryListParams({
        ...params,
        accountAddress: accountAddress || '',
      });

      const requestParams: IServerFetchAccountHistoryDetailParams = withUTXOs
        ? {
            accountId,
            networkId,
            txid,
            ...extraParams,
          }
        : {
            accountId,
            networkId,
            txid,
            xpub,
            accountAddress,
            ...extraParams,
          };
      const vault = await vaultFactory.getVault({ networkId, accountId });
      const resp = await vault.fetchAccountHistoryDetail(requestParams);

      if (params.fixConfirmedTxStatus) {
        void this.updateLocalHistoryConfirmedTxStatus({
          networkId,
          accountAddress,
          xpub,
          txid,
          status: getOnChainHistoryTxStatus(resp.data.data.data.status),
        });
      }
      return resp.data.data;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  @backgroundMethod()
  public async updateLocalHistoryConfirmedTxStatus(params: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txid: string;
    status: EDecodedTxStatus;
  }) {
    await this.backgroundApi.simpleDb.localHistory.updateLocalHistoryConfirmedTxStatus(
      params,
    );
  }

  @backgroundMethod()
  public async decodeOnChainHistoryTx(params: {
    accountId: string;
    networkId: string;
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
    accountAddress?: string;
    xpub?: string;
  }) {
    const { accountId, networkId, tx, tokens, nfts } = params;

    let accountAddress = params.accountAddress;
    let xpub = params.xpub;

    try {
      const [x, a] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
      ]);
      accountAddress = a;
      xpub = x;
    } catch (_e) {
      // pass
    }

    const vault = await vaultFactory.getVault({ networkId, accountId });

    const resp = await vault.buildOnChainHistoryTx({
      accountId,
      networkId,
      accountAddress: accountAddress || '',
      xpub: xpub || '',
      onChainHistoryTx: tx,
      tokens,
      nfts,
    });

    if (resp) return resp;
  }

  @backgroundMethod()
  public async fetchTxDetails({
    accountId,
    networkId,
    txid,
  }: IFetchTxDetailsParams) {
    return this.fetchHistoryTxDetails({
      accountId,
      networkId,
      txid,
    });
  }

  @backgroundMethod()
  public async getAccountLocalHistoryPendingTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
    limit?: number;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;
    const localHistoryPendingTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryPendingTxs(
        {
          networkId,
          accountAddress,
          xpub,
          tokenIdOnNetwork,
        },
      );

    return localHistoryPendingTxs;
  }

  @backgroundMethod()
  public async getAccountsLocalHistoryPendingTxs(
    params: {
      networkId: string;
      accountAddress: string;
      xpub?: string;
      tokenIdOnNetwork?: string;
    }[],
  ) {
    const localHistoryPendingTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountsLocalHistoryPendingTxs(
        params,
      );

    return localHistoryPendingTxs;
  }

  @backgroundMethod()
  public async getLocalHistoryTxById(params: {
    accountId: string;
    networkId: string;
    historyId: string;
  }) {
    const { accountId, networkId, historyId } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    return this.backgroundApi.simpleDb.localHistory.getLocalHistoryTxById({
      networkId,
      accountAddress,
      xpub,
      historyId,
    });
  }

  @backgroundMethod()
  public async saveLocalHistoryPendingTxs(params: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    pendingTxs: IAccountHistoryTx[];
  }) {
    const { networkId, accountAddress, xpub, pendingTxs } = params;

    return this.backgroundApi.simpleDb.localHistory.saveLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
      txs: pendingTxs,
    });
  }

  @backgroundMethod()
  public async clearLocalHistoryPendingTxs() {
    return this.backgroundApi.simpleDb.localHistory.clearLocalHistoryPendingTxs();
  }

  @backgroundMethod()
  public async clearLocalHistoryPendingTxByTxId(params: {
    accountId?: string;
    networkId: string;
    txid?: string;
    accountAddress?: string;
  }) {
    const { accountId, networkId, txid } = params;
    if (!networkId || !txid) {
      return false;
    }

    let accountAddress = params.accountAddress;
    let xpub: string | undefined;
    if (accountId) {
      try {
        [accountAddress, xpub] = await Promise.all([
          this.backgroundApi.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          }),
          this.backgroundApi.serviceAccount.getAccountXpub({
            accountId,
            networkId,
          }),
        ]);
      } catch (_e) {
        // fall back to the caller-provided account address
      }
    }

    if (!accountAddress && !xpub) {
      return false;
    }

    const localHistoryPendingTxs = await this.getAccountLocalHistoryPendingTxs({
      networkId,
      accountAddress: accountAddress ?? '',
      xpub,
    });
    const shouldIgnoreTxIdCase = networkUtils.isEvmNetwork({ networkId });
    const txidForCompare = shouldIgnoreTxIdCase ? txid.toLowerCase() : txid;
    const pendingTxsToClear = localHistoryPendingTxs.filter((tx) => {
      const pendingTxId = tx.decodedTx.txid;
      return (
        (shouldIgnoreTxIdCase ? pendingTxId?.toLowerCase() : pendingTxId) ===
        txidForCompare
      );
    });
    if (!pendingTxsToClear.length) {
      return false;
    }

    await simpleDb.localHistory.batchUpdateLocalHistoryTxs([
      {
        networkId,
        accountAddress: accountAddress ?? '',
        xpub,
        confirmedTxs: pendingTxsToClear,
      },
    ]);
    appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
    return true;
  }

  @backgroundMethod()
  public async clearLocalHistory() {
    return this.backgroundApi.simpleDb.localHistory.clearLocalHistory();
  }

  @backgroundMethod()
  public async getAccountLocalHistoryConfirmedTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
    limit?: number;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;
    const localHistoryConfirmedTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryConfirmedTxs(
        {
          networkId,
          accountAddress,
          xpub,
          tokenIdOnNetwork,
        },
      );

    return localHistoryConfirmedTxs;
  }

  @backgroundMethod()
  public async getAccountsLocalHistoryConfirmedTxs(
    params: {
      networkId: string;
      accountAddress: string;
      xpub?: string;
      tokenIdOnNetwork?: string;
    }[],
  ) {
    const localHistoryConfirmedTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountsLocalHistoryConfirmedTxs(
        params,
      );

    return localHistoryConfirmedTxs;
  }

  @backgroundMethod()
  public async getAccountLocalPendingTxsNonceList(params: {
    networkId: string;
    accountId: string;
  }) {
    const { networkId, accountId } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);
    return this.backgroundApi.simpleDb.localHistory.getPendingNonceList({
      networkId,
      accountAddress,
      xpub,
    });
  }

  @backgroundMethod()
  public async saveSendConfirmHistoryTxs(params: {
    networkId: string;
    accountId: string;
    data: ISendTxOnSuccessData;
    replaceTxInfo?: IReplaceTxInfo;
  }) {
    const { networkId, accountId, data, replaceTxInfo } = params;

    if (!data || !data.decodedTx) {
      return;
    }

    const { decodedTx, signedTx } = data;
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });

    const vault = await vaultFactory.getVault({ networkId, accountId });
    const newHistoryTx = await vault.buildHistoryTx({
      decodedTx,
      signedTx,
      isSigner: true,
      isLocalCreated: true,
    });

    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    if (signedTx.stakingInfo) {
      newHistoryTx.stakingInfo = signedTx.stakingInfo;
    }

    if (vaultSettings.replaceTxEnabled) {
      try {
        newHistoryTx.decodedTx.encodedTxEncrypted =
          newHistoryTx.decodedTx.encodedTxEncrypted ||
          (await this.backgroundApi.servicePassword.encryptByInstanceId(
            JSON.stringify(decodedTx.encodedTx),
          ));
      } catch (error) {
        console.error(error);
      }
    }

    let prevTx: IAccountHistoryTx | undefined;
    if (replaceTxInfo && replaceTxInfo.replaceHistoryId) {
      prevTx = await simpleDb.localHistory.getLocalHistoryTxById({
        historyId: replaceTxInfo.replaceHistoryId,
        networkId,
        accountAddress,
        xpub,
      });
      if (prevTx) {
        prevTx.decodedTx.status = EDecodedTxStatus.Dropped;
        prevTx.replacedNextId = newHistoryTx.id;

        newHistoryTx.replacedPrevId = prevTx.id;
        newHistoryTx.replacedType = replaceTxInfo.replaceType;
        newHistoryTx.decodedTx.interactInfo =
          newHistoryTx.decodedTx.interactInfo || prevTx.decodedTx.interactInfo;

        if (replaceTxInfo.replaceType === EReplaceTxType.Cancel) {
          newHistoryTx.decodedTx.actions =
            prevTx.decodedTx.actions || newHistoryTx.decodedTx.actions;
        }

        // if the prev tx is a cancel tx, the new tx should keep canceled status
        if (prevTx.replacedType === EReplaceTxType.Cancel) {
          newHistoryTx.decodedTx.actions =
            prevTx.decodedTx.actions || newHistoryTx.decodedTx.actions;
          newHistoryTx.replacedType = EReplaceTxType.Cancel;
        }

        void this.backgroundApi.serviceSwap.updateSwapHistoryTx({
          oldTxId: prevTx.decodedTx.txid,
          newTxId: newHistoryTx.decodedTx.txid,
          status:
            replaceTxInfo.replaceType === EReplaceTxType.Cancel
              ? ESwapTxHistoryStatus.CANCELING
              : ESwapTxHistoryStatus.PENDING,
        });

        // Listen for staking transaction speed-up changes
        void this.backgroundApi.serviceStaking.updateOrderStatusByTxId({
          currentTxId: prevTx.decodedTx.txid,
          newTxId: newHistoryTx.decodedTx.txid,
          status:
            replaceTxInfo.replaceType === EReplaceTxType.Cancel
              ? EDecodedTxStatus.Removed
              : EDecodedTxStatus.Pending,
        });
      }
    }

    if (prevTx) {
      await this.backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs(
        [
          {
            networkId,
            accountAddress,
            xpub,
            confirmedTxs: [prevTx],
          },
        ],
      );
    }

    await this.saveLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
      pendingTxs: [newHistoryTx],
    });

    if (replaceTxInfo) {
      appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
    }

    // refresh BTC fresh address for HD or HW accounts if needed
    void this.backgroundApi.serviceFreshAddress.syncBTCFreshAddressByAccountId({
      accountId,
      networkId,
    });
  }

  @backgroundMethod()
  public async getLocalHistoryMinPendingNonce(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }) {
    return this.backgroundApi.simpleDb.localHistory.getMinPendingNonce(params);
  }

  @backgroundMethod()
  public async canAccelerateTx({
    networkId,
    accountId,
    encodedTx,
    txId,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    txId: string;
  }) {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.canAccelerateTx({ encodedTx, txId });
  }

  @backgroundMethod()
  public async checkTxSpeedUpStateEnabled({
    networkId,
    accountId,
    historyTx,
  }: {
    networkId: string;
    accountId: string;
    historyTx: IAccountHistoryTx;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    return vault.checkTxSpeedUpStateEnabled({ historyTx });
  }

  @backgroundMethod()
  public async getReplaceInfoForBtc(params: {
    networkId: string;
    accountId: string;
    txid: string;
  }) {
    const { networkId, accountId, txid } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    const pendingTxs =
      await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs({
        networkId,
        accountAddress,
        xpub,
      });
    const pendingTxIds = pendingTxs
      .filter((tx) => tx.decodedTx.networkId === networkId)
      .map((tx) => tx.decodedTx.txid);

    const btcReplaceStateMap = await this.fetchBtcReplaceStateFromF2pool({
      networkId,
      txIds: pendingTxIds,
    });
    return btcReplaceStateMap?.[txid] ?? EBtcF2poolReplaceState.NOT_ACCELERATED;
  }

  @backgroundMethod()
  public async fetchBtcReplaceStateFromF2pool(params: {
    networkId: string;
    txIds: string[];
  }) {
    return this.memoizedFetchBtcReplaceState(params);
  }

  private memoizedFetchBtcReplaceState = memoizee(
    async (params: {
      networkId: string;
      txIds: string[];
    }): Promise<Record<string, number>> => {
      console.log('🚀 call f2pool api:', params.txIds);
      const { txIds } = params;

      const [btcReplaceStateMap] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<
          Record<string, number>
        >({
          networkId: 'btc--0',
          body: [
            {
              route: 'f2pool',
              params: {
                url: '/user/tx-acc/onekey-query',
                method: 'GET',
                params: {},
                data: {
                  txids: txIds,
                },
              },
            },
          ],
        });

      return btcReplaceStateMap;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  @backgroundMethod()
  public async updateLocalAddressesInfo({
    data,
    merge = true,
  }: {
    data: Record<string, IAddressInfo>;
    merge?: boolean;
  }) {
    return this.backgroundApi.simpleDb.addressInfo.updateAddressesInfo({
      data,
      merge,
    });
  }

  @backgroundMethod()
  public async clearLocalAddressesInfo() {
    return this.backgroundApi.simpleDb.addressInfo.clearAddressesInfo();
  }

  @backgroundMethod()
  public async getLocalAddressesInfo() {
    return this.backgroundApi.simpleDb.addressInfo.getAddressesInfo();
  }

  @backgroundMethod()
  async migrateFilterScamHistorySetting() {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (appStatus?.filterScamHistorySettingMigrated) {
      console.log('migrateFilterScamHistorySetting: already migrated');
      return;
    }

    await this.backgroundApi.serviceSetting.setFilterScamHistoryEnabled(true);

    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        filterScamHistorySettingMigrated: true,
      }),
    );
  }
}

export default ServiceHistory;
