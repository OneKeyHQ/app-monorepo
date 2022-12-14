import React, { ComponentProps, memo } from 'react';
import type { FC } from 'react';

import {
  Box,
  Pressable,
  Text,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useNFTSymbolPrice } from '../../../../hooks/useTokens';

import { useNFTListContent } from './NFTListContent';
import NFTListImage from './NFTListImage';

type Props = ComponentProps<typeof Box> & {
  asset: NFTAsset;
  onSelectAsset?: (asset: NFTAsset) => void;
};

const NFTListAssetCard: FC<Props> = ({ onSelectAsset, asset, ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const nftContent = useNFTListContent();
  const { network } = useActiveWalletAccount();
  const symbolPrice = useNFTSymbolPrice({ networkId: network?.id ?? '' });

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
  const { latestTradePrice } = asset;

  const price = nftContent?.context.price ?? symbolPrice ?? 0;
  const value = price * (latestTradePrice ?? 0);

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
          if (onSelectAsset) {
            onSelectAsset(asset);
          }
        }}
      >
        <NFTListImage
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
          {asset.name ?? asset.collection.contractName ?? ''}
        </Text>
        {latestTradePrice ? (
          <Text typography="Body2" height="20px" color="text-subdued">
            <FormatCurrencyNumber
              value={0}
              decimals={2}
              convertValue={value > 0 ? value : ''}
            />
          </Text>
        ) : (
          <Box height="20px" />
        )}
      </Pressable>
    </Box>
  );
};

export default memo(NFTListAssetCard);
