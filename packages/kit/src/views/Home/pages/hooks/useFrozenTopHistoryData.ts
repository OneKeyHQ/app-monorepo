import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

// Web / desktop / extension render history through a different list path
// (react-virtualized with fixed row heights) that anchors content
// deterministically on insert, so the top-insertion jitter of OK-57070 is a
// native-only concern. This default export is a pass-through; the real logic
// lives in `useFrozenTopHistoryData.native.ts`.
export function useFrozenTopHistoryData(
  combined: IAccountHistoryTx[],
  _enabled: boolean,
): IAccountHistoryTx[] {
  return combined;
}
