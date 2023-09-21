import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty, IconButton } from '@onekeyhq/components';

import FavListMenu from '../../../Overlay/Discover/FavListMenu';
import { useDiscoverFavorites } from '../../hooks';
import { convertMatchDAppItemType } from '../../utils';
import { DappItemPlain } from '../DappRenderItem';
import { DappItemPlainContainerLayout, PageLayout } from '../DappRenderLayout';

import type { MatchDAppItemType } from '../../Explorer/explorerUtils';

const DappItemPlainFavMenu: FC<{ item: MatchDAppItemType }> = ({ item }) => (
  <Box flexDirection="column" justifyContent="center">
    <FavListMenu isFav item={item}>
      <IconButton type="plain" name="EllipsisVerticalOutline" size="sm" />
    </FavListMenu>
  </Box>
);

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Box py="10">
      <Empty
        emoji="⭐️"
        title={intl.formatMessage({ id: 'title__no_favorite_dapp' })}
        subTitle={intl.formatMessage({ id: 'title__no_favorite_dapp_desc' })}
      />
    </Box>
  );
};

export const SectionFavorites = () => {
  const items = useDiscoverFavorites();
  if (!items.length) {
    return <ListEmptyComponent />;
  }
  return (
    <PageLayout>
      <Box py="4" px="4">
        <DappItemPlainContainerLayout space={2}>
          {items.map((item) => {
            const o = convertMatchDAppItemType(item);
            return (
              <DappItemPlain
                key={item.id}
                title={o.name}
                description={o.subtitle}
                networkIds={o.networkIds}
                logoURI={o.logoURL}
                url={o.url}
                rightElement={<DappItemPlainFavMenu item={item} />}
              />
            );
          })}
        </DappItemPlainContainerLayout>
      </Box>
    </PageLayout>
  );
};
