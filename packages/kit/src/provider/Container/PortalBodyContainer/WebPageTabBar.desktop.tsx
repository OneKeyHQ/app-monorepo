import { useMedia } from '@onekeyhq/components';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

export function WebPageTabBar({ isExpanded }: { isExpanded?: boolean }) {
  const { gtMd } = useMedia();
  if (!gtMd) {
    return null;
  }
  return <DesktopCustomTabBar isExpanded={isExpanded} />;
}
