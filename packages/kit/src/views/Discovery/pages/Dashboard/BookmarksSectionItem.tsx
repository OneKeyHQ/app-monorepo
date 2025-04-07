import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { DiscoveryItemCard } from '../../components/DiscoveryItemCard';

import type { IMatchDAppItemType } from '../../types';

export function BookmarksSectionItem({
  logo,
  title,
  url,
  dApp,
  handleOpenWebSite,
}: {
  logo?: string;
  title: string;
  url: string;
  dApp?: IDApp;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  return (
    <DiscoveryItemCard
      isLoading={false}
      logo={logo}
      title={title}
      url={url}
      dApp={dApp}
      handleOpenWebSite={handleOpenWebSite}
    />
  );
}
