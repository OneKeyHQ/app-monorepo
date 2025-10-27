import { ETableSortType } from '../types';

export function getNextSortOrder(
  current: ETableSortType | undefined,
  disabled: ETableSortType[],
): ETableSortType | undefined {
  const isDisabled = (sort: ETableSortType | undefined) =>
    sort !== undefined && disabled.includes(sort);

  if (current === ETableSortType.DESC) {
    return isDisabled(ETableSortType.ASC) ? undefined : ETableSortType.ASC;
  }

  if (current === ETableSortType.ASC) {
    return undefined;
  }

  // current is undefined, find first available sort
  if (!isDisabled(ETableSortType.DESC)) return ETableSortType.DESC;
  if (!isDisabled(ETableSortType.ASC)) return ETableSortType.ASC;
  return undefined;
}
