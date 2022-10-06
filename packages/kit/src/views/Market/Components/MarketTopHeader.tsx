import React from 'react';

import {
  Box,
  Divider,
  IconButton,
  Pressable,
  Searchbar,
  Typography,
} from '@onekeyhq/components/src';

type MarketHeaderProps = {
  onChange: (keyword: string) => void;
  keyword: string;
};

const Header: React.FC<MarketHeaderProps> = ({ onChange, keyword }) => {
  // todo 大小屏  搜索组件
  console.log('hearder');
  return (
    <Box flexDirection="column">
      <Searchbar
        placeholder="Search Cryptos"
        width="360px"
        mt="3"
        ml="6"
        value={keyword}
        onChangeText={(text) => onChange(text)}
        onClear={() => onChange('')}
      />
      <Divider mt="3" />
      <Typography.DisplayLarge ml="3" mt="6">
        Market
      </Typography.DisplayLarge>
    </Box>
  );
};

const HeaderNative: React.FC = () => {
  console.log('');
  return (
    <Box
      p="3"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Box flexDirection="row">
        <Pressable>
          <Typography.DisplayMedium color="text-default">
            Market
          </Typography.DisplayMedium>
        </Pressable>
        <Pressable ml="3">
          <Typography.DisplayMedium color="text-disabled">
            Swap
          </Typography.DisplayMedium>
        </Pressable>
      </Box>
      <Box>
        <IconButton size="base" name="SearchSolid" iconSize={16} />
      </Box>
    </Box>
  );
};

export const MarketHeader: React.FC<MarketHeaderProps> = React.memo(Header);

export const MarketHeaderNative: React.FC = React.memo(HeaderNative);
