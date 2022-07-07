import React, { ComponentProps, memo } from 'react';
import type { FC } from 'react';

import { Row } from 'native-base';
import { useWindowDimensions } from 'react-native';

import { Box, Center, Text, useUserDevice } from '@onekeyhq/components';
import { Collectible, MoralisNFT } from '@onekeyhq/engine/src/types/moralis';

import CollectibleListImage from './CollectibleListImage';

type Props = ComponentProps<typeof Box> & {
  collectible: Collectible;
};

const CountView: FC<{ count: number; size: number }> = ({ count, size }) => (
  <Box
    position="absolute"
    right="0"
    bottom="0"
    borderRadius="6px"
    size={`${size}px`}
    bgColor="backdrop"
  >
    <Center flex={1}>
      <Text>{`+${count}`}</Text>
    </Center>
  </Box>
);

type SubItemListProps = {
  assets: MoralisNFT[];
  width: number;
};
const SubItemList: FC<SubItemListProps> = ({ width, assets }) => {
  console.log();
  const subItemSize = (width - 9) / 2;
  const filterAssets = assets.filter((item, index) => index < 4);
  if (filterAssets.length === 1) {
    return (
      <CollectibleListImage asset={assets[0]} borderRadius="6px" size={width} />
    );
  }
  return (
    <Row
      flexWrap="wrap"
      width={`${width}px`}
      height={`${width}px`}
      borderRadius="6px"
    >
      {filterAssets.map((asset, itemIndex) => {
        const marginRight = !(itemIndex % 2 === 0) ? 0 : 9;
        const marginBottom = itemIndex < 2 ? 9 : 0;
        return (
          <CollectibleListImage
            key={`CollectibleListImage${asset.tokenId}${itemIndex}`}
            asset={asset}
            borderRadius="6px"
            marginRight={`${marginRight}px`}
            marginBottom={`${marginBottom}px`}
            size={subItemSize}
          />
        );
      })}
      {assets.length > 4 ? (
        <CountView size={subItemSize} count={assets.length} />
      ) : null}
    </Row>
  );
};

const CollectionCard: FC<Props> = ({ collectible, ...rest }) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const dimensions = useWindowDimensions();
  const MARGIN = isSmallScreen ? 16 : 20;
  const padding = isSmallScreen ? 8 : 12;
  const width = isSmallScreen
    ? Math.floor((dimensions.width - MARGIN * 3) / 2)
    : 177;

  const contentSize = width - 2 * padding;

  return (
    <Box
      bgColor="surface-default"
      padding={`${padding}px`}
      overflow="hidden"
      borderRadius="12px"
      borderWidth={0}
      width={width}
      mb={`${padding}px`}
      flexDirection="column"
      {...rest}
    >
      <SubItemList assets={collectible.assets} width={contentSize} />
      <Text
        typography="Body2"
        height="20px"
        mt={`${padding}px`}
        numberOfLines={1}
      >
        {collectible.collection.name}
      </Text>
      <Text typography="Body2" height="20px" />
      {/* <Typography.Body2 numberOfLines={1}>{title}</Typography.Body2> */}
    </Box>
  );
};

export default memo(CollectionCard);
