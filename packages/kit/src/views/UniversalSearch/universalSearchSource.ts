import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EUniversalSearchSource } from '@onekeyhq/shared/types/search';

export function getUniversalSearchSource(
  tabRoute: ETabRoutes | undefined,
): EUniversalSearchSource {
  switch (tabRoute) {
    case ETabRoutes.Home:
    case ETabRoutes.BulkSend:
    case ETabRoutes.SubPage:
      return EUniversalSearchSource.Wallet;
    case ETabRoutes.Market:
      return EUniversalSearchSource.Market;
    case ETabRoutes.Swap:
      return EUniversalSearchSource.Swap;
    case ETabRoutes.Perp:
    case ETabRoutes.WebviewPerpTrade:
      return EUniversalSearchSource.Perps;
    case ETabRoutes.Earn:
      return EUniversalSearchSource.Earn;
    case ETabRoutes.Discovery:
    case ETabRoutes.MultiTabBrowser:
      return EUniversalSearchSource.Browser;
    case ETabRoutes.DeviceManagement:
      return EUniversalSearchSource.DeviceManagement;
    case ETabRoutes.ReferFriends:
      return EUniversalSearchSource.ReferFriends;
    case ETabRoutes.Developer:
      return EUniversalSearchSource.Developer;
    default:
      return EUniversalSearchSource.Unknown;
  }
}
