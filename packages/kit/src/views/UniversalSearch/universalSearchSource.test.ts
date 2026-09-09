import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchSource } from '@onekeyhq/shared/types/search';

import { getUniversalSearchSource } from './universalSearchSource';

describe('getUniversalSearchSource', () => {
  it.each([
    [ETabRoutes.Home, EUniversalSearchSource.Wallet],
    [ETabRoutes.BulkSend, EUniversalSearchSource.Wallet],
    [ETabRoutes.SubPage, EUniversalSearchSource.Wallet],
    [ETabRoutes.Market, EUniversalSearchSource.Market],
    [ETabRoutes.Swap, EUniversalSearchSource.Swap],
    [ETabRoutes.Perp, EUniversalSearchSource.Perps],
    [ETabRoutes.WebviewPerpTrade, EUniversalSearchSource.Perps],
    [ETabRoutes.Earn, EUniversalSearchSource.Earn],
    [ETabRoutes.Discovery, EUniversalSearchSource.Browser],
    [ETabRoutes.MultiTabBrowser, EUniversalSearchSource.Browser],
    [ETabRoutes.DeviceManagement, EUniversalSearchSource.DeviceManagement],
    [ETabRoutes.ReferFriends, EUniversalSearchSource.ReferFriends],
    [ETabRoutes.Developer, EUniversalSearchSource.Developer],
  ])('maps desktop tab %s to %s', (tabRoute, expected) => {
    expect(getUniversalSearchSource(tabRoute)).toBe(expected);
  });

  it.each([
    [ETabRoutes.Market, EUniversalSearchSource.Market],
    [ETabRoutes.Earn, EUniversalSearchSource.Earn],
    [ETabRoutes.Discovery, EUniversalSearchSource.Browser],
  ])('maps native Discovery sub-tab %s to %s', (tabRoute, expected) => {
    expect(getUniversalSearchSource(tabRoute)).toBe(expected);
  });

  it('maps the current desktop shortcut tab at invocation time', () => {
    expect(getUniversalSearchSource(ETabRoutes.Swap)).toBe(
      EUniversalSearchSource.Swap,
    );
  });

  it('falls back to unknown when no tab route is available', () => {
    expect(getUniversalSearchSource(undefined)).toBe(
      EUniversalSearchSource.Unknown,
    );
  });
});
