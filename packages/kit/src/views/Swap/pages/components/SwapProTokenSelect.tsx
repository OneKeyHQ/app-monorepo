import { useMemo } from 'react';

import { Badge, Icon, SizableText, Skeleton } from '@onekeyhq/components';
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
    return <Skeleton w="$20" h="$9" borderRadius="$2" />;
  }
  return (
    <Badge
      gap="$3"
      bg="$bgApp"
      cursor="pointer"
      hoverStyle={{
        borderRadius: '$full',
        bg: '$bgHover',
      }}
      pressStyle={{
        borderRadius: '$full',
        bg: '$bgActive',
      }}
      onPress={onSelectTokenClick}
    >
      <Token
        size="md"
        borderRadius="$full"
        tokenImageUri={swapProTokenSelect?.logoURI}
        networkImageUri={swapProTokenNetworkImageUri}
        bg={themeVariant === 'light' ? undefined : '$bgInverse'}
        fallbackIcon="CryptoCoinOutline"
      />

      {/* Token Name */}
      <SizableText size="$heading2xl">{swapProTokenSelect?.symbol}</SizableText>
      <Icon name="ChevronBottomOutline" size="$4" />
    </Badge>
  );
};

export default SwapProTokenSelector;
