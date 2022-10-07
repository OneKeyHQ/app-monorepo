import { FlatList, Box, Pressable, Typography } from '@onekeyhq/components/src';
import { Image } from '@onekeyhq/components/src/NetImage';
import { FC, useCallback } from 'react';
import { ListRenderItem } from 'react-native';

import { MarketNews } from '../../../../store/reducers/market';
import { ListItem } from '../../../Components/stories/List/ListView';
import { useWebController } from '../../../Discover/Explorer/Controller/useWebController';

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
}) => {
  console.log('NewsItem');
  return (
    <ListItem onPress={onPress}>
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
};

type MarketInfoNewsListProps = {
  news?: MarketNews[];
};

export const MarketInfoNewsList: FC<MarketInfoNewsListProps> = ({ news }) => {
  const { gotoSite } = useWebController();
  const renderItem: ListRenderItem<MarketNews> = useCallback(
    ({ item }) => {
      console.log('item', item);
      return (
        <NewsItem
          title={item.title}
          origin={item.origin}
          date={item.date}
          imageUrl={item.imageUrl}
          onPress={() => {
            // to do 跳转打开webview
            gotoSite({ url: item.url });
          }}
        />
      );
    },
    [gotoSite],
  );
  return (
    <Box>
      <FlatList data={news} renderItem={renderItem} />
    </Box>
  );
};
