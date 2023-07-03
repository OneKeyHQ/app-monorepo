import { memo } from 'react';

import {
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import NFTBTCContent from './NFTBTCContent';

import type { ListDataType, ListItemComponentType, ListItemType } from './type';

export function keyExtractor(item: ListItemType<ListDataType>): string {
  const data = item.data as NFTBTCAssetModel;
  return data.inscription_id;
}

function NFTBTCAssetCard({
  onSelect,
  data: asset,
  ...rest
}: ListItemComponentType<NFTBTCAssetModel>) {
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
    <Box mb="16px" {...rest}>
      <Pressable
        flexDirection="column"
        bgColor="surface-default"
        padding={`${padding}px`}
        overflow="hidden"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        width={cardWidth}
        _hover={{ bg: 'surface-hovered' }}
        onPress={() => {
          if (onSelect) {
            onSelect(asset);
          }
        }}
      >
        <NFTBTCContent size={cardWidth - 2 * padding} asset={asset} />
        {asset.inscription_number > 0 ? (
          <Text
            typography="Body2"
            height="20px"
            mt={`${padding}px`}
            numberOfLines={1}
          >
            {`Inscription #${asset.inscription_number}`}
          </Text>
        ) : (
          <Box height="20px" />
        )}
      </Pressable>
    </Box>
  );
}

export default memo(NFTBTCAssetCard);
