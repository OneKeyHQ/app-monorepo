import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
  GradientMask,
  ScrollView,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { MarketStarV2 } from '../../../components/MarketStarV2';
import { useTokenDetail } from '../../hooks/useTokenDetail';

import { ShareButton } from './ShareButton';
import { TokenDetailHeaderLeft } from './TokenDetailHeaderLeft';
import { TokenDetailHeaderRight } from './TokenDetailHeaderRight';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const SCROLL_THRESHOLD = 2;
const SCROLL_BREAKPOINT = 720;

export function TokenDetailHeader({
  showStats = true,
  showMediaAndSecurity = true,
  containerProps,
}: {
  showStats?: boolean;
  showMediaAndSecurity?: boolean;
  containerProps?: ComponentProps<typeof XStack>;
}) {
  const { lg, md } = useMedia();
  const { tokenDetail, networkId, isNative } = useTokenDetail();
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const shouldScroll = useMemo(() => {
    if (!containerWidth) {
      return false;
    }
    return containerWidth < SCROLL_BREAKPOINT;
  }, [containerWidth]);

  const networkData = useMemo(() => {
    return networkId ? networkUtils.getLocalNetworkInfo(networkId) : undefined;
  }, [networkId]);

  const shouldShowRightGradient = useMemo(() => {
    if (!shouldScroll) {
      return false;
    }
    return (
      contentWidth > scrollViewWidth &&
      scrollX < contentWidth - scrollViewWidth - SCROLL_THRESHOLD
    );
  }, [contentWidth, scrollViewWidth, scrollX, shouldScroll]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!shouldScroll) {
        return;
      }
      setScrollX(event.nativeEvent.contentOffset.x);
    },
    [shouldScroll],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setScrollViewWidth(event.nativeEvent.layout.width);
  }, []);

  const handleContentSizeChange = useCallback((width: number) => {
    setContentWidth(width);
  }, []);

  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const renderHeaderContent = () => (
    <XStack
      position="relative"
      width={lg ? '90%' : '100%'}
      px="$5"
      py="$4"
      h={54}
      jc="flex-start"
      ai="center"
      gap="$6"
      minWidth={SCROLL_BREAKPOINT}
      {...containerProps}
    >
      <TokenDetailHeaderLeft
        tokenDetail={tokenDetail}
        networkId={networkId}
        networkLogoUri={networkData?.logoURI}
        showMediaAndSecurity={showMediaAndSecurity}
        isNative={isNative}
      />

      {showStats === false && platformEnv.isNative && md ? null : (
        <TokenDetailHeaderRight
          tokenDetail={tokenDetail}
          networkId={networkId}
          isNative={isNative}
          showStats={showStats}
        />
      )}

      {/* Spacer to push buttons to the right */}
      {!platformEnv.isNative && !md && networkId ? (
        <>
          <Stack flex={1} />
          <XStack gap="$3" ai="center">
            <MarketStarV2
              chainId={networkId}
              contractAddress={tokenDetail?.address ?? ''}
              size="medium"
              from={EWatchlistFrom.Detail}
              tokenSymbol={tokenDetail?.symbol ?? ''}
              isNative={isNative}
            />
            {isNative ? (
              <ShareButton
                networkId={networkId}
                address={tokenDetail?.address ?? ''}
                isNative={isNative}
                useIconButton
              />
            ) : null}
          </XStack>
        </>
      ) : null}
    </XStack>
  );

  return (
    <XStack
      position="relative"
      onLayout={handleContainerLayout}
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      {shouldScroll && !platformEnv.isNative && !md ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
          >
            {renderHeaderContent()}
          </ScrollView>

          <GradientMask
            opacity={scrollX > SCROLL_THRESHOLD ? 1 : 0}
            position="left"
          />
          <GradientMask
            opacity={shouldShowRightGradient ? 1 : 0}
            position="right"
          />
        </>
      ) : (
        renderHeaderContent()
      )}
    </XStack>
  );
}
