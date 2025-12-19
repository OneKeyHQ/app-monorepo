import { useMemo } from 'react';

import { Icon, SizableText, Skeleton, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSwapProSelectTokenAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

interface ISwapProTokenSelector {
  onSelectTokenClick: () => void;
  configLoading: boolean;
}

const SwapProTokenSelector = ({
  onSelectTokenClick,
  configLoading,
}: ISwapProTokenSelector) => {
  const [swapProTokenSelect] = useSwapProSelectTokenAtom();
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
  if (configLoading) {
    return <Skeleton w="$20" h="$8" borderRadius="$2" />;
  }
  return (
    <XStack
      gap="$3"
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
    >
      <Token
        size="md"
        borderRadius="$full"
        tokenImageUri={swapProTokenSelect?.logoURI}
        networkImageUri={swapProTokenNetworkImageUri}
        bg={themeVariant === 'light' ? undefined : '$bgInverse'}
        fallbackIcon="CryptoCoinOutline"
      />

      <SizableText
        size="$headingLg"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
      >
        {swapProTokenSelect?.symbol}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
};

export default SwapProTokenSelector;
