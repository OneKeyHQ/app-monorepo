type IHomeDisplaySnapshotHtmlPreloadResult = {
  ownerScopeKey: string;
  values: ReadonlyMap<string, string>;
};

type IHomeDisplaySnapshotHtmlPreloadGlobal = typeof globalThis & {
  __ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__?: Promise<
    IHomeDisplaySnapshotHtmlPreloadResult | undefined
  >;
};

export async function getHomeDisplaySnapshotHtmlPreloadValues({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): Promise<ReadonlyMap<string, string> | undefined> {
  const task = (globalThis as IHomeDisplaySnapshotHtmlPreloadGlobal)
    .__ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__;
  if (!task) {
    return undefined;
  }
  try {
    const result = await task;
    return result?.ownerScopeKey === ownerScopeKey ? result.values : undefined;
  } catch {
    return undefined;
  }
}
