import { getHomeDisplaySnapshotHtmlPreloadValues } from './homeDisplaySnapshotHtmlPreload';

type IHtmlPreloadGlobal = typeof globalThis & {
  __ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__?: Promise<
    | {
        ownerScopeKey: string;
        values: ReadonlyMap<string, string>;
      }
    | undefined
  >;
};

const globalPreload = globalThis as IHtmlPreloadGlobal;

afterEach(() => {
  delete globalPreload.__ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__;
});

describe('getHomeDisplaySnapshotHtmlPreloadValues', () => {
  it('returns raw records for the matching owner', async () => {
    const values = new Map([['route/owner-a', 'route']]);
    globalPreload.__ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__ = Promise.resolve({
      ownerScopeKey: 'owner-a',
      values,
    });

    await expect(
      getHomeDisplaySnapshotHtmlPreloadValues({
        ownerScopeKey: 'owner-a',
      }),
    ).resolves.toBe(values);
  });

  it('ignores records prepared for another owner', async () => {
    globalPreload.__ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__ = Promise.resolve({
      ownerScopeKey: 'owner-a',
      values: new Map(),
    });

    await expect(
      getHomeDisplaySnapshotHtmlPreloadValues({
        ownerScopeKey: 'owner-b',
      }),
    ).resolves.toBeUndefined();
  });

  it('degrades to the repository fallback when the HTML read fails', async () => {
    globalPreload.__ONEKEY_HOME_DISPLAY_SNAPSHOT_PRELOAD__ = Promise.reject(
      new Error('IndexedDB unavailable'),
    );

    await expect(
      getHomeDisplaySnapshotHtmlPreloadValues({
        ownerScopeKey: 'owner-a',
      }),
    ).resolves.toBeUndefined();
  });
});
