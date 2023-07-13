import { memo, useMemo } from 'react';

import {
  Box,
  HStack,
  Pressable,
  Text,
  Token,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { parseTextProps } from '@onekeyhq/engine/src/managers/nft';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { BRCTokenType } from '@onekeyhq/engine/src/types/token';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { useActiveWalletAccount, useNetwork } from '../../../../hooks';

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
  const { networkId: activeNetworkId } = useActiveWalletAccount();

  const { network } = useNetwork({
    networkId: asset.networkId,
  });

  const networkIcon = useMemo(() => {
    if (!isAllNetworks(activeNetworkId)) {
      return null;
    }
    return network?.logoURI;
  }, [network, activeNetworkId]);

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
  const title = useMemo(() => {
    if (asset.inscription_number > 0) {
      return `#${asset.inscription_number}`;
    }
    return '';
  }, [asset.inscription_number]);

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
        <HStack justifyContent="space-between">
          <Text
            typography="Body2"
            height="20px"
            mt={`${padding}px`}
            numberOfLines={1}
          >
            {title}
          </Text>
          {networkIcon ? (
            <Token
              size={4}
              token={{
                logoURI: networkIcon,
              }}
            />
          ) : null}
        </HStack>
      </Pressable>
    </Box>
  );
}

export default memo(NFTBTCAssetCard);
