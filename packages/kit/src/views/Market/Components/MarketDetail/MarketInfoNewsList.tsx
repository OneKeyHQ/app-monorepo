import { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, FlatList, ListItem, Typography } from '@onekeyhq/components/src';
import { Image } from '@onekeyhq/components/src/NetImage';
import { MarketNews } from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

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
  <ListItem onPress={onPress} borderRadius={0} p={0}>
    <Box my="4" flexDirection="row" justifyContent="space-between" w="full">
      <Box flex={1} justifyContent="space-between">
        <Typography.Body1Strong noOfLines={2}>{title}</Typography.Body1Strong>
        <Box flexDirection="row">
          <Typography.Caption>{origin}</Typography.Caption>
          <Typography.Caption ml="2">{date}</Typography.Caption>
        </Box>
      </Box>
      <Box ml="4">
        <Image
          src={imageUrl}
          alt={imageUrl}
          key={imageUrl}
          width="80px"
          height="80px"
          borderRadius={12}
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
      <FlatList data={news} renderItem={renderItem} scrollEnabled={false} />
    </Box>
  );
};
