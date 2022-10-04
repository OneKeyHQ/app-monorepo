import React from 'react';

import { Checkbox as BaseCheckBox, IBoxProps } from 'native-base';

import { Box, Token, Pressable, Typography } from '@onekeyhq/components/src';

type RecomendedTokenProps = {
  name: string;
  symbol: string;
  icon: string;
  width?: string;
  height?: string;
};

const RecommendedTokenBox: React.FC<RecomendedTokenProps> = ({
  name,
  symbol,
  icon,
  width = '173px',
  height = '64px',
}) => {
  console.log('RecommendedToken');
  // token 的图标和名字组件单独抽出来
  return (
    <Pressable width={width} height={height}>
      <Box
        borderWidth={1}
        borderRadius="12px"
        borderColor="border-default"
        flexDirection="row"
        alignItems="center"
      >
        <Box ml="3" flexDirection="row" width="100px">
          <Token size={8} src={icon} />
          <Box flexDirection="column" ml="2">
            <Typography.Body2Strong>{symbol}</Typography.Body2Strong>
            <Typography.Body2Strong color="text-subdued">
              {name}
            </Typography.Body2Strong>
          </Box>
        </Box>
        <BaseCheckBox size="sm" value="" />
      </Box>
    </Pressable>
  );
};

export default RecommendedTokenBox;
