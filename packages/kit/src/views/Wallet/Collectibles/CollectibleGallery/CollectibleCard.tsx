import React, { ComponentProps, memo } from 'react';
import type { FC } from 'react';

import {
  Box,
  Text,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import { NFTScanAsset } from '@onekeyhq/engine/src/types/nftscan';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';

import CollectibleListImage from './CollectibleListImage';

type Props = ComponentProps<typeof Box> & {
  asset: NFTScanAsset;
};

const CollectibleCard: FC<Props> = ({ asset, ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();

  const MARGIN = isSmallScreen ? 16 : 20;
  const padding = isSmallScreen ? 8 : 12;

  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  // const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));
  const cardWidth = isSmallScreen
    ? Math.floor((pageWidth - MARGIN * 3) / 2)
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
      width={cardWidth}
      mb="16px"
      {...rest}
    >
      <CollectibleListImage
        asset={asset}
        borderRadius="6px"
        size={cardWidth - 2 * padding}
      />
      <Text
        typography="Body2"
        height="20px"
        mt={`${padding}px`}
        numberOfLines={1}
      >
        {asset.name}
      </Text>
      {/* <Text typography="Body2" height="20px" /> */}
      {/* <Typography.Body2 numberOfLines={1}>{title}</Typography.Body2> */}
    </Box>
  );
};

export default memo(CollectibleCard);
