import React from 'react';

import { Checkbox as BaseCheckBox, IBoxProps } from 'native-base';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components/src';

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
  ...props
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
          {/* <Box size="32px" overflow="hidden" rounded="full">
                  <Image
                    w="full"
                    h="hull"
                    src="https://x2y2.io/favicon.ico"
                    key="https://x2y2.io/favicon.ico"
                    alt="https://x2y2.io/favicon.ico"
                    fallbackElement={<Icon name="ConnectOutline" size={32} />}
                  />
                </Box> */}
          <Icon size={32} name="StarSolid" />
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
