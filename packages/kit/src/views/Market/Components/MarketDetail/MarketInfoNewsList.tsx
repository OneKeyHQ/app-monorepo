import { FlatList, Box, Pressable, Typography } from '@onekeyhq/components/src';
import { Image } from '@onekeyhq/components/src/NetImage';
import { FC, useCallback } from 'react';
import { ListRenderItem } from 'react-native';

import { MarketNews } from '../../../../store/reducers/market';
const mokeData = [
  {
    title: 'Miners Remain Unfazed by Crypto Sell-Off, Expect Mor...',
    origin: 'CoinDesk',
    date: 'Jul 06,18:22',
    image: '',
    url: '',
  },
  {
    title: 'Miners Remain Unfazed by Crypto Sell-Off, Expect Mor...',
    origin: 'CoinDesk',
    date: 'Jul 06,18:22',
    image: '',
    url: '',
  },
  {
    title: 'Miners Remain Unfazed by Crypto Sell-Off, Expect Mor...',
    origin: 'CoinDesk',
    date: 'Jul 06,18:22',
    image: '',
    url: '',
  },
  {
    title: 'Miners Remain Unfazed by Crypto Sell-Off, Expect Mor...',
    origin: 'CoinDesk',
    date: 'Jul 06,18:22',
    image: '',
    url: '',
  },
];

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
    <Pressable onPress={onPress}>
      <Box flexDirection="row">
        <Box>
          <Typography.Body1Strong numberOfLines={2}>
            {title}
          </Typography.Body1Strong>
          <Box flexDirection="row">
            <Typography.Caption>{origin}</Typography.Caption>
            <Typography.Caption>{date}</Typography.Caption>
          </Box>
        </Box>
        <Image src={imageUrl} width="80px" height="80px" />
      </Box>
    </Pressable>
  );
};

export const MarketInfoNewsList: FC = () => {
  console.log('MarketInfoNews');
  const renderItem: ListRenderItem<MarketNews> = useCallback(({ item }) => {
    console.log('item', item);
    return (
      <NewsItem
        title={item.title}
        origin={item.origin}
        date={item.date}
        imageUrl={item.imageUrl}
        onPress={() => {}}
      />
    );
  }, []);
  return (
    <Box>
      <FlatList data={mokeData} renderItem={renderItem} />
    </Box>
  );
};
