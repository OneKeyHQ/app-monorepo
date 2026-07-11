import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export function shouldInitializeSwapTypeFromRoute({
  defaultSwapType,
  hasPreparedSwapProEntry,
}: {
  defaultSwapType?: ESwapTabSwitchType;
  hasPreparedSwapProEntry: boolean;
}) {
  return Boolean(defaultSwapType && !hasPreparedSwapProEntry);
}
