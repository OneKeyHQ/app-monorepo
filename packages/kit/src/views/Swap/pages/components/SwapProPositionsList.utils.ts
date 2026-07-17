import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

type IStockPositionsMetadataPhase =
  | 'idle'
  | 'initial-loading'
  | 'refreshing'
  | 'ready'
  | 'empty'
  | 'stale-empty'
  | 'failed'
  | 'stale-error';

export const STOCK_POSITIONS_METADATA_MAX_ATTEMPTS = 2;
export const STOCK_POSITIONS_METADATA_RETRY_DELAY_MS = 300;

export function getSwapProPositionTokenIdentity(
  token: Pick<ISwapToken, 'contractAddress' | 'isNative' | 'networkId'>,
) {
  const tokenAddress = token.isNative
    ? 'native'
    : (token.contractAddress ?? '').toLowerCase();
  return `${token.networkId}:${tokenAddress}`;
}

export function buildStockPositionsMetadataOwnerKey({
  filterToken,
  sourceOwnerKey,
}: {
  filterToken?: ISwapToken[];
  sourceOwnerKey: string;
}) {
  if (!sourceOwnerKey) {
    return '';
  }
  const filterKey = filterToken
    ? filterToken.map(getSwapProPositionTokenIdentity).toSorted().join(',')
    : 'all';
  return `${sourceOwnerKey}::${filterKey}`;
}

export function buildStockPositionsMetadataRequestKey({
  locale,
  tokens,
}: {
  locale: string;
  tokens: ISwapToken[];
}) {
  if (!tokens.length) {
    return '';
  }
  return `${locale}::${tokens
    .map(getSwapProPositionTokenIdentity)
    .toSorted()
    .join(',')}`;
}

export function getExactStockPositionsMetadataSnapshot<
  T extends { ownerKey: string; requestKey: string },
>({
  ownerKey,
  requestKey,
  snapshot,
}: {
  ownerKey: string;
  requestKey: string;
  snapshot?: T;
}) {
  if (snapshot?.ownerKey === ownerKey && snapshot.requestKey === requestKey) {
    return snapshot;
  }
  return undefined;
}

export function requireCompleteStockPositionsMetadataList<T>({
  expectedCount,
  list,
}: {
  expectedCount: number;
  list?: T[];
}) {
  const isComplete =
    list?.length === expectedCount &&
    Array.from({ length: expectedCount }).every(
      (_, index) =>
        Object.prototype.hasOwnProperty.call(list, index) &&
        list[index] !== undefined &&
        list[index] !== null,
    );
  if (!isComplete || !list) {
    throw new OneKeyLocalError(
      'Stock positions metadata response is incomplete',
    );
  }
  return list;
}

export async function loadStockPositionsMetadataWithRetry<T>({
  load,
  maxAttempts = STOCK_POSITIONS_METADATA_MAX_ATTEMPTS,
  retryDelayMs = STOCK_POSITIONS_METADATA_RETRY_DELAY_MS,
}: {
  load: () => Promise<T>;
  maxAttempts?: number;
  retryDelayMs?: number;
}): Promise<T> {
  const runAttempt = async (attempt: number): Promise<T> => {
    try {
      return await load();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      if (retryDelayMs > 0) {
        await timerUtils.wait(retryDelayMs);
      }
      return runAttempt(attempt + 1);
    }
  };
  if (maxAttempts < 1) {
    throw new OneKeyLocalError(
      'Stock positions metadata retry requires at least one attempt',
    );
  }
  return runAttempt(1);
}

export function getSwapProPositionsFailureState({
  hasExactPositionSnapshot,
  hasUsableMetadataSnapshot,
  isExactPositionRequestFailed,
  metadataPhase,
}: {
  hasExactPositionSnapshot: boolean;
  hasUsableMetadataSnapshot: boolean;
  isExactPositionRequestFailed: boolean;
  metadataPhase?: IStockPositionsMetadataPhase;
}): 'blocking' | 'stale' | undefined {
  const isMetadataRequestFailed =
    metadataPhase === 'failed' || metadataPhase === 'stale-error';
  // Metadata classifies raw holdings into Stock positions. Without an exact
  // usable metadata snapshot, a raw last-good list alone is unsafe to render
  // as an authoritative empty Stock result.
  if (isMetadataRequestFailed && !hasUsableMetadataSnapshot) {
    return 'blocking';
  }
  if (isExactPositionRequestFailed && !hasExactPositionSnapshot) {
    return 'blocking';
  }
  if (isMetadataRequestFailed || isExactPositionRequestFailed) {
    return 'stale';
  }
  return undefined;
}

export function retrySwapProPositionsFailures({
  isExactPositionRequestFailed,
  metadataPhase,
  onMetadataRetry,
  onPositionSourceRetry,
}: {
  isExactPositionRequestFailed: boolean;
  metadataPhase?: IStockPositionsMetadataPhase;
  onMetadataRetry: () => void;
  onPositionSourceRetry?: () => void;
}) {
  if (isExactPositionRequestFailed) {
    onPositionSourceRetry?.();
  }
  if (metadataPhase === 'failed' || metadataPhase === 'stale-error') {
    onMetadataRetry();
  }
}

export function isStockPositionsMetadataSnapshotUsable({
  displayTokenCount,
  isVisibleExact,
  visibleTokenIdentityCount,
}: {
  displayTokenCount: number;
  isVisibleExact: boolean;
  visibleTokenIdentityCount?: number;
}) {
  if (visibleTokenIdentityCount === undefined) {
    return false;
  }
  if (isVisibleExact) {
    return true;
  }
  return visibleTokenIdentityCount > 0 && displayTokenCount > 0;
}

export function isSwapProPositionsSourceReady({
  exactPositionTokenCount,
  hasExactPositionSnapshot,
  hasSettledCurrentOwnerRequest,
  sourceUnavailable,
}: {
  exactPositionTokenCount: number;
  hasExactPositionSnapshot: boolean;
  hasSettledCurrentOwnerRequest: boolean;
  sourceUnavailable: boolean;
}) {
  if (sourceUnavailable) {
    return true;
  }
  if (!hasExactPositionSnapshot) {
    return false;
  }
  return exactPositionTokenCount > 0 || hasSettledCurrentOwnerRequest;
}

export function shouldRenderStockPositionsSkeleton({
  hasUsableMetadataSnapshot,
  metadataPhase,
  metadataRequired,
  sourceReady,
  stockOnly,
}: {
  hasUsableMetadataSnapshot: boolean;
  metadataPhase?: IStockPositionsMetadataPhase;
  metadataRequired: boolean;
  sourceReady: boolean;
  stockOnly: boolean;
}) {
  if (!stockOnly) {
    return false;
  }
  if (!sourceReady) {
    return true;
  }
  if (!metadataRequired) {
    return false;
  }
  return (
    metadataPhase === 'initial-loading' ||
    (metadataPhase === 'refreshing' && !hasUsableMetadataSnapshot)
  );
}

export function shouldRenderSwapProPositionsSourceSkeleton({
  hasScopedSource,
  hasUsableLegacyCache,
  legacyLoading,
  sourceReady,
  stockOnly,
}: {
  hasScopedSource: boolean;
  hasUsableLegacyCache: boolean;
  legacyLoading: boolean;
  sourceReady: boolean;
  stockOnly: boolean;
}) {
  if (hasScopedSource) {
    return !sourceReady;
  }
  return !stockOnly && legacyLoading && !hasUsableLegacyCache;
}
