import { useMemo } from 'react';

import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useSwapProSelectTokenAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import {
  StockIsOpenBadge,
  StockSourceLogo,
} from '../../../Market/components/PerpsBadges';

interface ISwapProTokenSelector {
  onSelectTokenClick: () => void;
  configLoading: boolean;
}

const SwapProTokenSelector = ({
  onSelectTokenClick,
  configLoading,
}: ISwapProTokenSelector) => {
  const [swapProTokenSelect] = useSwapProSelectTokenAtom();
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const themeVariant = useThemeVariant();
  const swapProTokenNetworkImageUri = useMemo(() => {
    if (swapProTokenSelect?.networkLogoURI) {
      return swapProTokenSelect.networkLogoURI;
    }
    if (swapProTokenSelect?.networkId) {
      const localNetwork = networkUtils.getLocalNetworkInfo(
        swapProTokenSelect?.networkId,
      );
      return localNetwork?.logoURI;
    }
    return undefined;
  }, [swapProTokenSelect]);
  const selectedTokenStock = useMemo(() => {
    if (!swapProTokenSelect || !tokenMarketDetailInfo?.stock) {
      return undefined;
    }
    const isCurrentToken = equalTokenNoCaseSensitive({
      token1: {
        networkId: tokenMarketDetailInfo.networkId,
        contractAddress: tokenMarketDetailInfo.address,
      },
      token2: swapProTokenSelect,
    });
    return isCurrentToken ? tokenMarketDetailInfo.stock : undefined;
  }, [swapProTokenSelect, tokenMarketDetailInfo]);

  if (configLoading) {
    return <Skeleton w="$20" h="$8" borderRadius="$2" />;
  }
  return (
    <XStack
      gap="$2"
      bg="$bgApp"
      cursor="pointer"
      hoverStyle={{
        opacity: 0.8,
      }}
      pressStyle={{
        opacity: 0.7,
      }}
      onPress={onSelectTokenClick}
      alignItems="center"
      flex={1}
      flexShrink={1}
      minWidth={0}
    >
      <Token
        size="md"
        borderRadius="$full"
        tokenImageUri={swapProTokenSelect?.logoURI}
        networkImageUri={swapProTokenNetworkImageUri}
        bg={themeVariant === 'light' ? undefined : '$bgInverse'}
        fallbackIcon="CryptoCoinOutline"
      />

      <YStack flex={1} minWidth={0} gap="$0.5">
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText
            size="$headingLg"
            color="$text"
            numberOfLines={1}
            ellipsizeMode="tail"
            maxWidth="$40"
            flexShrink={1}
          >
            {swapProTokenSelect?.symbol}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
        {selectedTokenStock ? (
          <XStack alignItems="center" gap="$1" minWidth={0}>
            {selectedTokenStock.subtitle ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {selectedTokenStock.subtitle}
              </SizableText>
            ) : null}
            <StockSourceLogo stock={selectedTokenStock} />
            <StockIsOpenBadge stock={selectedTokenStock} />
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
};

export default SwapProTokenSelector;
