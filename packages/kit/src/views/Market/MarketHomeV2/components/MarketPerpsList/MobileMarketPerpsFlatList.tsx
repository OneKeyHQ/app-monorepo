import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ListEndIndicator,
  SizableText,
  Stack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { buildPerpsMarketRow } from '../MarketNativeList/marketNativeListRows';
import { WebMarketCompactList } from '../MarketNativeList/WebMarketCompactList';
import { TokenListSkeleton } from '../MarketTokenList/components/TokenListSkeleton';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

interface IMobileMarketPerpsFlatListProps {
  selectedCategoryId: string;
  shouldSuppressItemPress?: () => boolean;
}

const EMPTY_DATA: IMarketPerpsToken[] = [];

function MobileMarketPerpsFlatListImpl({
  selectedCategoryId,
  shouldSuppressItemPress,
}: IMobileMarketPerpsFlatListProps) {
  const { navigateToPerps } = usePerpsNavigation();
  const intl = useIntl();

  const { tokens, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const handleTokenPress = useCallback(
    (tokenName: string) => {
      if (shouldSuppressItemPress?.()) {
        return;
      }
      navigateToPerps(tokenName);
    },
    [navigateToPerps, shouldSuppressItemPress],
  );

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [showSkeleton, intl]);

  const ListFooterComponent = useMemo(() => {
    if (!isLoading && tokens.length > 0) {
      return <ListEndIndicator />;
    }
    return null;
  }, [isLoading, tokens.length]);

  const tabBarHeight = useScrollContentTabBarOffset();

  const handleWebItemPress = useCallback(
    (item: IMarketPerpsToken) => handleTokenPress(item.name),
    [handleTokenPress],
  );
  return (
    <WebMarketCompactList<IMarketPerpsToken>
      data={showSkeleton ? EMPTY_DATA : tokens}
      buildRow={buildPerpsMarketRow}
      onPress={handleWebItemPress}
      empty={ListEmptyComponent}
      contentPaddingBottom={tabBarHeight}
      footer={ListFooterComponent}
    />
  );
}

export const MobileMarketPerpsFlatList = memo(MobileMarketPerpsFlatListImpl);
