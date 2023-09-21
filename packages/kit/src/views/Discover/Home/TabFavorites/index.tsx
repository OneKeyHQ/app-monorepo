import { type FC, useContext } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty, IconButton } from '@onekeyhq/components';

import FavListMenu from '../../../Overlay/Discover/FavListMenu';
import { useDiscoverFavorites } from '../../hooks';
import { convertMatchDAppItemType } from '../../utils';
import { DappItemPlain } from '../DappRenderItem';
import {
  DappItemPlainContainerLayout,
  PageLayout,
  PageWidthLayoutContext,
} from '../DappRenderLayout';
import { EmptySkeleton } from '../EmptySkeleton';

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

const SectionFavoritesContent = () => {
  const items = useDiscoverFavorites();
  const { fullwidth } = useContext(PageWidthLayoutContext);
  if (!fullwidth) {
    return (
      <Box mt="2">
        <EmptySkeleton />
      </Box>
    );
  }
  if (!items.length) {
    return <ListEmptyComponent />;
  }
  return (
    <Box py="4" px="4">
      <DappItemPlainContainerLayout space={2} offset={-32}>
        {items.map((item) => {
          const o = convertMatchDAppItemType(item);
          return (
            <DappItemPlain
              key={item.id}
              title={o.name || 'Unknown'}
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
  );
};

export const SectionFavorites = () => (
  <PageLayout>
    <SectionFavoritesContent />
  </PageLayout>
);
