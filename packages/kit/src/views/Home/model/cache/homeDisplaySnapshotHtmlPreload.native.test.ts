import { getHomeDisplaySnapshotHtmlPreloadValues } from './homeDisplaySnapshotHtmlPreload.native';

describe('getHomeDisplaySnapshotHtmlPreloadValues native', () => {
  it('does not expose an HTML preload on native', async () => {
    await expect(
      getHomeDisplaySnapshotHtmlPreloadValues({
        ownerScopeKey: 'owner-a',
      }),
    ).resolves.toBeUndefined();
  });
});
