import React, { ComponentProps, memo } from 'react';
import type { FC } from 'react';

import { Row } from 'native-base';

import {
  Box,
  Center,
  Text,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import CollectibleListImage from './CollectibleListImage';

type Props = ComponentProps<typeof Box> & {
  collectible: Collection;
  onSelectCollection?: (cols: Collection) => void;
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
  collectible: Collection;
  width: number;
};

const SubItemList: FC<SubItemListProps> = ({ width, collectible }) => {
  const subItemSize = (width - 9) / 2;
  const filterAssets = collectible.assets.filter((item, index) => index < 4);
  if (filterAssets.length === 1) {
    return (
      <CollectibleListImage
        asset={collectible.assets[0]}
        borderRadius="6px"
        size={width}
      />
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
            key={`CollectibleListImage${
              asset.tokenId ?? asset.tokenAddress ?? ''
            }${itemIndex}`}
            asset={asset}
            borderRadius="6px"
            marginRight={`${marginRight}px`}
            marginBottom={`${marginBottom}px`}
            size={subItemSize}
          />
        );
      })}
      {collectible.assets.length > 4 ? (
        <CountView size={subItemSize} count={collectible.assets.length} />
      ) : null}
    </Row>
  );
};

const CollectionCard: FC<Props> = ({
  onSelectCollection,
  collectible,
  ...rest
}) => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const padding = isSmallScreen ? 8 : 12;
  const width = isSmallScreen
    ? Math.floor((screenWidth - MARGIN * 3) / 2)
    : 177;
  const { themeVariant } = useTheme();
  const contentSize = width - 2 * padding;

  return (
    <Box mb="16px" {...rest}>
      <Pressable
        bgColor="surface-default"
        padding={`${padding}px`}
        overflow="hidden"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        width={width}
        flexDirection="column"
        _hover={{ bg: 'surface-hovered' }}
        onPress={() => {
          if (onSelectCollection) {
            onSelectCollection(collectible);
          }
        }}
      >
        <SubItemList collectible={collectible} width={contentSize} />
        <Text
          typography="Body2"
          height="20px"
          mt={`${padding}px`}
          numberOfLines={1}
        >
          {collectible.contractName}
        </Text>
        {/* <Text typography="Body2" height="20px" /> */}
        {/* <Typography.Body2 numberOfLines={1}>{title}</Typography.Body2> */}
      </Pressable>
    </Box>
  );
};

export default memo(CollectionCard);
