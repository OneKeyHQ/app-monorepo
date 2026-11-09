import { isFeaturedChangelogRelevantToAppUpdate } from '@onekeyhq/shared/src/appUpdate';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

/**
 * Returns true when the featured-changelog overlay handled the open, telling
 * the caller to skip its legacy modal push. Dynamic import keeps the dialog
 * code out of the main update bundle until it's actually needed.
 *
 * The relevance check runs against the background-runtime atom (the source of
 * truth) because a persisted Featured Changelog can outlive the update check
 * that delivered it — e.g. a cancelled test release — and must not replace the
 * installed version's changelog. The validated payload is then passed into the
 * dialog: on native the dialog otherwise renders the split runtime's own atom
 * copy, which can keep fields the background runtime already cleared.
 */
export async function tryShowFeaturedDialog(
  isPreInstall: boolean,
): Promise<boolean> {
  const currentInfo = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
  const featuredChangelog = currentInfo?.featuredChangelog;
  if (
    !isFeaturedChangelogRelevantToAppUpdate(
      featuredChangelog,
      currentInfo,
      isPreInstall,
    )
  ) {
    return false;
  }
  const { showFeaturedChangelogDialog } =
    await import('./showFeaturedChangelogDialog');
  showFeaturedChangelogDialog({ isPreInstall, featuredChangelog });
  return true;
}
