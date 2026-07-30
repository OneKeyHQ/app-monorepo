import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export type IHomeStartupPreparedDisplaySnapshot = {
  displaySnapshot: IPreparedHomeDisplaySnapshot | undefined;
  ownerScopeKey: string;
};

export function loadHomeStartupPreparedDisplaySnapshot():
  | IHomeStartupPreparedDisplaySnapshot
  | undefined {
  return undefined;
}
