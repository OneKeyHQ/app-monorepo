import React, { ComponentProps, memo } from 'react';
import type { FC } from 'react';

import { useWindowDimensions } from 'react-native';

import { Box, Text, useTheme, useUserDevice } from '@onekeyhq/components';
import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';

import CollectibleListImage from './CollectibleListImage';

type Props = ComponentProps<typeof Box> & {
  asset: MoralisNFT;
};

const CollectibleCard: FC<Props> = ({ asset, ...rest }) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const dimensions = useWindowDimensions();
  const MARGIN = isSmallScreen ? 16 : 20;
  const padding = isSmallScreen ? 8 : 12;
  const width = isSmallScreen
    ? Math.floor((dimensions.width - MARGIN * 3) / 2)
    : 177;
  const { themeVariant } = useTheme();

  return (
    <Box
      flexDirection="column"
      bgColor="surface-default"
      padding={`${padding}px`}
      overflow="hidden"
      borderRadius="12px"
      borderColor="border-subdued"
      borderWidth={themeVariant === 'light' ? 1 : undefined}
      width={width}
      mb="16px"
      {...rest}
    >
      <CollectibleListImage
        asset={asset}
        borderRadius="6px"
        size={width - 2 * padding}
      />
      <Text
        typography="Body2"
        height="20px"
        mt={`${padding}px`}
        numberOfLines={1}
      >
        {asset.assetName}
      </Text>
      {/* <Text typography="Body2" height="20px" /> */}
      {/* <Typography.Body2 numberOfLines={1}>{title}</Typography.Body2> */}
    </Box>
  );
};

export default memo(CollectibleCard);
