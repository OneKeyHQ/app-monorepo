import { hasFeaturedChangelog } from '@onekeyhq/shared/src/appUpdate';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

/**
 * Returns true when the featured-changelog overlay handled the open, telling
 * the caller to skip its legacy modal push. Dynamic import keeps the dialog
 * code out of the main update bundle until it's actually needed.
 */
export async function tryShowFeaturedDialog(
  isPreInstall: boolean,
): Promise<boolean> {
  const currentInfo = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
  if (!hasFeaturedChangelog(currentInfo.featuredChangelog)) return false;
  const { showFeaturedChangelogDialog } =
    await import('./showFeaturedChangelogDialog');
  showFeaturedChangelogDialog({ isPreInstall });
  return true;
}
