import { Box, Typography } from '@onekeyhq/components/src';
import { FC } from 'react';
import { MarketInfoExplorer } from './MarketInfoExplorer';
import { MarketInfoNewsList } from './MarketInfoNewsList';

type BaseInfoProps = { title?: string; value?: string };
const BaseInfo: FC<BaseInfoProps> = ({ title, value }) => {
  console.log('baseInfo');
  const formatValue = value ? `${value}` : '';
  return (
    <Box flexDirection="column" alignItems="center">
      <Typography.Body2 color="text-subdued">{title}</Typography.Body2>
      <Typography.Heading>{formatValue}</Typography.Heading>
    </Box>
  );
};

export const MarkeInfoContent: FC = () => {
  console.log('marketInfoContent');

  return (
    <Box flex={1}>
      <Typography.Heading>Info</Typography.Heading>
      <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
        <BaseInfo />
        <BaseInfo />
        <BaseInfo />
        <BaseInfo />
        <BaseInfo />
        <BaseInfo />
      </Box>
      <Typography.Heading>Explorers</Typography.Heading>
      <MarketInfoExplorer />
      <MarketInfoExplorer />
      <MarketInfoExplorer />
      <Typography.Heading>About</Typography.Heading>
      <Typography.Body2 maxH="100px">
        Ethereum is a global, open-source platform for decentralized
        applications. In other words, the vision is to create a world computer
        that anyone can build applications in a decentralized manner; while all
        states and data...
      </Typography.Body2>
      <Typography.Heading>News</Typography.Heading>
      <MarketInfoNewsList />
    </Box>
  );
};
