import { getFeaturedChangelogForVersion } from '@onekeyhq/shared/src/appUpdate';
import type {
  IAppUpdateInfo,
  IFeaturedChangelog,
} from '@onekeyhq/shared/src/appUpdate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Pre-install surfaces describe the pending update target; post-install
// surfaces ("What's New", post-update popup) describe the installed app.
export function getFeaturedChangelogForEntry(
  appUpdateInfo: IAppUpdateInfo | null | undefined,
  isPreInstall: boolean,
): IFeaturedChangelog | undefined {
  return getFeaturedChangelogForVersion(
    appUpdateInfo,
    isPreInstall ? appUpdateInfo?.latestVersion : platformEnv.version,
  );
}
