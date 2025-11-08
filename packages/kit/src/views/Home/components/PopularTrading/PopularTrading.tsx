import { memo, useCallback } from 'react';

import {
  usePopularTradingAtom,
  usePopularTradingStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/walletHome';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { useMedia, YStack } from '@onekeyhq/components';
import { StyleSheet } from 'react-native';
import type { IPopularTradingToken } from '@onekeyhq/shared/types/swap/types';
import { PopularTradingItem } from './PopularTradingItem';

function PopularTrading() {
  const [popularTradingState] = usePopularTradingStateAtom();
  const [{ popularTradingTokens }] = usePopularTradingAtom();
  const media = useMedia();

  const handlePressPopularTradingToken = useCallback(
    (token: IPopularTradingToken) => {
      console.log('token', token);
    },
    [],
  );

  const renderPopularTradingTokens = useCallback(() => {
    if (!popularTradingState.isInitialized && !popularTradingState.isLoading) {
      return <ListLoading isTokenSelectorView={false} />;
    }
    return popularTradingTokens.map((token) => (
      <PopularTradingItem
        key={`${token.networkId}-${token.tokenDetail.info.address}`}
        token={token}
        onPress={handlePressPopularTradingToken}
        tableLayout={media.gtMd}
      />
    ));
  }, [
    handlePressPopularTradingToken,
    media.gtMd,
    popularTradingState.isInitialized,
    popularTradingState.isLoading,
    popularTradingTokens,
  ]);

  return (
    <YStack
      px="$4"
      py="$3"
      borderRadius="$5"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderBorder"
    >
      {renderPopularTradingTokens()}
    </YStack>
  );
}

export default memo(PopularTrading);
