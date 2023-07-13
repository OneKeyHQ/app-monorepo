import { memo, useMemo } from 'react';

import {
  Badge,
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
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useActiveWalletAccount, useNetwork } from '../../../../hooks';
import { useTokenPrice } from '../../../../hooks/useTokens';
import { convertToMoneyFormat } from '../utils';

import NFTListImage from './NFTListImage';

import type { ListDataType, ListItemComponentType, ListItemType } from './type';

export function keyExtractor(
  item: ListItemType<ListDataType>,
  index: number,
): string {
  const data = item.data as NFTAsset;
  if (data.contractAddress && data.tokenId) {
    return data.contractAddress + data.tokenId;
  }
  if (data.tokenAddress) {
    return data.tokenAddress;
  }
  return `NFTAsset ${index}`;
}

function NFTListAssetCard({
  onSelect,
  data: asset,
  ...rest
}: ListItemComponentType<NFTAsset>) {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const { networkId: activeNetworkId } = useActiveWalletAccount();

  const { network } = useNetwork({
    networkId: asset.networkId,
  });

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

  const symbolPrice = useTokenPrice({
    networkId: asset.networkId ?? '',
    tokenIdOnNetwork: '',
    vsCurrency: 'usd',
  });
  const price = symbolPrice ?? 0;
  const value = price * (latestTradePrice ?? 0);

  const networkIcon = useMemo(() => {
    if (isAllNetworks(activeNetworkId)) {
      return null;
    }
    return network?.logoURI;
  }, [network, activeNetworkId]);

  const AmountTag = useMemo(() => {
    if (
      asset?.amount &&
      Number(asset?.amount) > 1 &&
      asset.ercType === 'erc1155'
    ) {
      return (
        <Badge
          position="absolute"
          right="8px"
          bottom="8px"
          title={`X ${convertToMoneyFormat(asset.amount)}`}
          size="sm"
          type="default"
        />
      );
    }
    return null;
  }, [asset?.amount, asset.ercType]);
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
        <Box>
          <NFTListImage
            asset={asset}
            borderRadius="6px"
            size={cardWidth - 2 * padding}
          />
          {AmountTag}
        </Box>
        <HStack mt={`${padding}px`} w="100%" justifyContent="space-between">
          <Text flex={1} typography="Body2" height="20px" numberOfLines={1}>
            {asset.name ?? asset.collection.contractName ?? ''}
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
}

export default memo(NFTListAssetCard);
