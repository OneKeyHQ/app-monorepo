import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

export interface INativeHomeCustomTokenScope {
  accountXpubOrAddress: string;
  networkId: string;
}

const ACCOUNT_KEY_SPLITTER = '__account:';

export function projectNativeHomeCustomTokens({
  rawData,
  scopes,
}: {
  rawData: ICustomTokenDBStruct | null | undefined;
  scopes: INativeHomeCustomTokenScope[];
}): ICustomTokenItem[] {
  if (!rawData) {
    return [];
  }
  const tokenKeys = new Set<string>();
  scopes.forEach(({ accountXpubOrAddress, networkId }) => {
    if (!accountXpubOrAddress || !networkId) {
      return;
    }
    const accountKey = `${networkId}${ACCOUNT_KEY_SPLITTER}${accountXpubOrAddress}`;
    Object.keys(rawData.customMap[accountKey] ?? {}).forEach((tokenKey) =>
      tokenKeys.add(tokenKey),
    );
  });
  return Array.from(tokenKeys)
    .map((tokenKey) => rawData.tokens[tokenKey])
    .filter((token): token is ICustomTokenItem => Boolean(token));
}

export async function commitNativeHomeSnapshotAfterProjection<
  TSnapshot,
  TProjection,
>({
  commit,
  getCurrentGeneration,
  generation,
  projectionTask,
  snapshot,
}: {
  commit: (value: { projection: TProjection; snapshot: TSnapshot }) => void;
  getCurrentGeneration: () => number;
  generation: number;
  projectionTask: Promise<TProjection>;
  snapshot: TSnapshot;
}): Promise<boolean> {
  const projection = await projectionTask;
  if (getCurrentGeneration() !== generation) {
    return false;
  }
  commit({ projection, snapshot });
  return true;
}
