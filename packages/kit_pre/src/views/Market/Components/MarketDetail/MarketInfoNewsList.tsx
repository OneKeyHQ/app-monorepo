import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  FlatList,
  Icon,
  ListItem,
  NetImage,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { MarketNews } from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import type { ListRenderItem } from 'react-native';

type NewsItemProps = {
  title?: string;
  origin?: string;
  date?: string;
  imageUrl?: string;
  onPress?: () => void;
};
const NewsItem: FC<NewsItemProps> = ({
  title,
  origin,
  date,
  imageUrl,
  onPress,
}) => (
  <ListItem onPress={onPress}>
    <Box my="2" flexDirection="row" justifyContent="space-between" w="full">
      <Box flex={1} justifyContent="space-between">
        <Typography.Body1Strong noOfLines={2}>{title}</Typography.Body1Strong>
        <Box flexDirection="row">
          <Typography.Caption>{origin}</Typography.Caption>
          <Typography.Caption ml="2">{date}</Typography.Caption>
        </Box>
      </Box>
      <Box ml="4">
        <NetImage
          skeleton
          src={imageUrl}
          alt={imageUrl}
          key={imageUrl}
          width="80px"
          height="80px"
          borderRadius={12}
          fallbackElement={
            <Box
              w="80px"
              height="80px"
              borderRadius={12}
              bgColor="surface-neutral-default"
              flexDirection="row"
              justifyContent="center"
              alignItems="center"
            >
              <Icon name="ImageBrokenIllus" color="icon-default" />
            </Box>
          }
        />
      </Box>
    </Box>
  </ListItem>
);

type MarketInfoNewsListProps = {
  news?: MarketNews[];
};

export const MarketInfoNewsList: FC<MarketInfoNewsListProps> = ({ news }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const renderItem: ListRenderItem<MarketNews> = useCallback(
    ({ item }) => (
      <NewsItem
        title={item.title}
        origin={item.origin}
        date={item.date}
        imageUrl={item.imageUrl}
        onPress={() => {
          openUrl(item.url ?? '', intl.formatMessage({ id: 'title__news' }), {
            modalMode: true,
          });
        }}
      />
    ),
    [intl],
  );
  return (
    <Box>
      <FlatList
        mx={isVertical ? -2 : 0}
        data={news}
        renderItem={renderItem}
        scrollEnabled={false}
      />
    </Box>
  );
};
