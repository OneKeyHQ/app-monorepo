import { getSwapTokenIdentityKey } from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapStockDisplayBalanceSnapshot,
  SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS,
} from './swapStockDisplaySnapshotUtils';

export function resolveStockSnapshotBalanceForDisplay({
  displayAccountKey,
  displayInputToken,
  now = Date.now(),
  snapshotBalance,
}: {
  displayAccountKey?: string;
  displayInputToken?: Partial<ISwapToken>;
  now?: number;
  snapshotBalance?: ISwapStockDisplayBalanceSnapshot;
}) {
  const displayInputTokenKey = getSwapTokenIdentityKey(displayInputToken);
  if (
    !displayAccountKey ||
    !displayInputTokenKey ||
    snapshotBalance?.identity.accountKey !== displayAccountKey ||
    snapshotBalance.identity.inputTokenKey !== displayInputTokenKey ||
    snapshotBalance.inputTokenKey !== displayInputTokenKey ||
    snapshotBalance.updatedAt > now ||
    now - snapshotBalance.updatedAt > SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS
  ) {
    return undefined;
  }
  return snapshotBalance;
}
