import type {
  IDustSweepItem,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { isDustSweepItemNotConverted } from '../stateMachine';

export type IDustSweepSkipGroup = {
  // Absent for the merged "others" row.
  label?: string;
  tokens: IDustSweepToken[];
};

const MAX_SKIP_GROUPS = 3;

// Groups tokens that were not converted by the reason text their token row
// shows, so both always read the same. Most common first; past the row limit
// the top reasons keep their rows and the rest merge into "others".
export function groupDustSweepSkips(
  items: IDustSweepItem[],
  getLabel: (item: IDustSweepItem) => string,
  maxGroups = MAX_SKIP_GROUPS,
): IDustSweepSkipGroup[] {
  const groups = new Map<string, IDustSweepSkipGroup>();
  items.filter(isDustSweepItemNotConverted).forEach((item) => {
    const label = getLabel(item);
    const group = groups.get(label);
    if (group) group.tokens.push(item.token);
    else groups.set(label, { label, tokens: [item.token] });
  });
  // Array sort is stable, so ties keep the order the reasons first appeared.
  const sorted = [...groups.values()].toSorted(
    (a, b) => b.tokens.length - a.tokens.length,
  );
  if (sorted.length <= maxGroups) return sorted;
  return [
    ...sorted.slice(0, maxGroups - 1),
    { tokens: sorted.slice(maxGroups - 1).flatMap((group) => group.tokens) },
  ];
}
