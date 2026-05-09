import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { DiscoveryItemCard } from '../../components/DiscoveryItemCard';

import type { IMatchDAppItemType } from '../../types';

export function TrendingSectionItem({
  logo,
  title,
  url,
  dApp,
  handleOpenWebSite,
  isLoading,
}: {
  logo?: string;
  title: string;
  url: string;
  dApp: IDApp;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
  isLoading?: boolean;
}) {
  return (
    <DiscoveryItemCard
      logo={logo}
      title={title}
      url={url}
      dApp={dApp}
      isAd={dApp.isAd}
      handleOpenWebSite={handleOpenWebSite}
      isLoading={isLoading}
      logoSize="$16"
      logoIconSize="$14"
      logoBorderRadius="$4"
      logoFullWidth
      contentPy="$1"
      contentGap="$2"
      titlePx="$0"
      titleMx="$-2.5"
      maxTitleWordLength={16}
    />
  );
}
