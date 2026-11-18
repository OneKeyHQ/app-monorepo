import type { PropsWithChildren, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import {
  Button,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITableProps, IXStackProps } from '@onekeyhq/components';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { MARKET_TOKEN_ROW_GROUP_NAME } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import {
  HOME_MARKET_TABLE_HEADER_MIN_HEIGHT,
  HOME_MARKET_TABLE_ROW_MIN_HEIGHT,
  getPopularTradingColumns,
  renderPopularTradingPriceWithChange,
  renderPopularTradingTokenIdentity,
} from './metricColumns';

import type { IFavoriteTokenDisplay } from './types';

type IMarketCategoryTokenListProps = {
  tokens: IFavoriteTokenDisplay[];
  isLoading?: boolean;
  tableLayout?: boolean;
  isTokenInWatchList: (record: IFavoriteTokenDisplay) => boolean;
  onStarPress: (record: IFavoriteTokenDisplay) => void | Promise<void>;
  onTokenPress: (record: IFavoriteTokenDisplay) => void;
  onViewMore: () => void;
};

type IPopularTradingTokenListRowsProps = {
  testID?: string;
  tokens: IFavoriteTokenDisplay[];
  shouldUseTableLayout: boolean;
  showSkeleton?: boolean;
  skeletonCount?: number;
  keyExtractor: (item: IFavoriteTokenDisplay) => string;
  renderStarButton: (record: IFavoriteTokenDisplay) => ReactNode;
  onTokenPress: (record: IFavoriteTokenDisplay) => void;
};

function getMarketCategoryTokenKey(item: IFavoriteTokenDisplay) {
  if (item.marketAsset) {
    return `market-${item.marketAsset.assetId}`;
  }
  if (item.perpsCoin) {
    return `perps-${item.perpsCoin}`;
  }
  if (item.stockId && !item.chainId) {
    return `stock-${item.stockId}`;
  }
  return `${item.chainId}-${item.contractAddress}`;
}

function PopularTradingRowContainer({
  symbol,
  onPress,
  shouldUseTableLayout,
  children,
}: PropsWithChildren<{
  symbol: string;
  onPress: () => void;
  shouldUseTableLayout: boolean;
}>) {
  const useNativePressable = platformEnv.isNative;
  const [nativePressed, setNativePressed] = useState(false);
  const nativePressedRef = useRef(false);
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const clearReleaseTimeout = useCallback(() => {
    if (releaseTimeoutRef.current !== undefined) {
      clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => () => clearReleaseTimeout(), [clearReleaseTimeout]);

  const handleNativePressIn = useCallback(() => {
    clearReleaseTimeout();
    nativePressedRef.current = true;
    setNativePressed(true);
    defaultLogger.market.navigation.homeTokenNavigation({
      stage: 'pressIn',
      symbol,
    });
  }, [clearReleaseTimeout, symbol]);

  const handleNativePressOut = useCallback(() => {
    clearReleaseTimeout();
    if (!nativePressedRef.current) {
      return;
    }
    nativePressedRef.current = false;
    setNativePressed(false);
    defaultLogger.market.navigation.homeTokenNavigation({
      stage: 'pressOut',
      symbol,
    });
  }, [clearReleaseTimeout, symbol]);

  // Pressable cancels its delayed onPressOut timer when a new touch starts.
  // If that follow-up gesture is a scroll that terminates before
  // unstable_pressDelay elapses, Pressable never calls onPressOut.
  const handleNativeTouchStart = useCallback(() => {
    clearReleaseTimeout();
    if (nativePressedRef.current) {
      handleNativePressOut();
    }
  }, [clearReleaseTimeout, handleNativePressOut]);

  const handleNativeTouchEnd = useCallback(() => {
    clearReleaseTimeout();
    if (!nativePressedRef.current) {
      return;
    }
    releaseTimeoutRef.current = setTimeout(() => {
      releaseTimeoutRef.current = undefined;
      if (nativePressedRef.current) {
        handleNativePressOut();
      }
    }, 180);
  }, [clearReleaseTimeout, handleNativePressOut]);

  const handlePress = useCallback(() => {
    if (useNativePressable && nativePressedRef.current) {
      handleNativePressOut();
    }
    onPress();
  }, [handleNativePressOut, onPress, useNativePressable]);

  const content = (
    <XStack
      minHeight={HOME_MARKET_TABLE_ROW_MIN_HEIGHT}
      mx="$2"
      px="$3"
      py="$2"
      borderRadius="$3"
      borderCurve="continuous"
      alignItems="center"
      gap={shouldUseTableLayout ? undefined : '$2'}
      bg={nativePressed ? '$bgActive' : '$bgApp'}
      onPress={!useNativePressable ? handlePress : undefined}
      {...(!useNativePressable ? listItemPressStyle : undefined)}
      {...(shouldUseTableLayout
        ? { group: MARKET_TOKEN_ROW_GROUP_NAME }
        : undefined)}
    >
      {children}
    </XStack>
  );

  if (useNativePressable) {
    return (
      <Pressable
        onPress={handlePress}
        onPressIn={handleNativePressIn}
        onPressOut={handleNativePressOut}
        onTouchStart={handleNativeTouchStart}
        onTouchEnd={handleNativeTouchEnd}
        onTouchCancel={handleNativeTouchEnd}
        unstable_pressDelay={50}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

function PopularTradingTokenListRows({
  testID,
  tokens,
  shouldUseTableLayout,
  showSkeleton = false,
  skeletonCount = HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  keyExtractor,
  renderStarButton,
  onTokenPress,
}: IPopularTradingTokenListRowsProps) {
  const intl = useIntl();
  const columns = useMemo<ITableProps<IFavoriteTokenDisplay>['columns']>(
    () =>
      shouldUseTableLayout
        ? getPopularTradingColumns({
            intl,
            shouldUseTableLayout: true,
            renderStarButton,
          })
        : [],
    [intl, renderStarButton, shouldUseTableLayout],
  );

  if (!shouldUseTableLayout) {
    return (
      <YStack testID={testID}>
        {showSkeleton
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <XStack
                key={index}
                minHeight={HOME_MARKET_TABLE_ROW_MIN_HEIGHT}
                mx="$2"
                px="$3"
                py="$2"
                borderRadius="$3"
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
              >
                <XStack alignItems="center" gap="$2">
                  <Stack width="$7" />
                  <XStack alignItems="center" gap="$3">
                    <Skeleton w="$8" h="$8" radius="round" />
                    <Skeleton w="$20" h="$4" />
                  </XStack>
                </XStack>
                <Skeleton h="$4" w="$20" />
              </XStack>
            ))
          : tokens.map((record) => (
              <PopularTradingRowContainer
                key={keyExtractor(record)}
                symbol={record.symbol}
                shouldUseTableLayout={false}
                onPress={() => onTokenPress(record)}
              >
                {renderStarButton(record)}
                <Stack flex={1} minWidth={0}>
                  {renderPopularTradingTokenIdentity(record, {
                    showVolume: true,
                  })}
                </Stack>
                {renderPopularTradingPriceWithChange(record)}
              </PopularTradingRowContainer>
            ))}
      </YStack>
    );
  }

  return (
    <YStack testID={testID}>
      <XStack
        mx="$2"
        px="$3"
        py="$2"
        minHeight={HOME_MARKET_TABLE_HEADER_MIN_HEIGHT}
        alignItems="center"
      >
        {columns.map((column, index) =>
          column ? (
            <XStack
              key={column.dataIndex}
              flex={1}
              flexBasis={0}
              alignItems="center"
              justifyContent={index === 0 ? 'flex-start' : 'flex-end'}
              userSelect="none"
              {...(column.columnProps as IXStackProps)}
            >
              <SizableText
                size="$headingXs"
                color="$textSubdued"
                textTransform="uppercase"
                textAlign={index === 0 ? undefined : 'right'}
              >
                {column.title}
              </SizableText>
            </XStack>
          ) : null,
        )}
      </XStack>
      {showSkeleton
        ? Array.from({ length: skeletonCount }).map((_, rowIndex) => (
            <XStack
              key={rowIndex}
              minHeight={HOME_MARKET_TABLE_ROW_MIN_HEIGHT}
              mx="$2"
              px="$3"
              py="$2"
              borderRadius="$3"
              alignItems="center"
            >
              {columns.map((column, colIndex) =>
                column ? (
                  <XStack
                    key={column.dataIndex}
                    flex={1}
                    flexBasis={0}
                    alignItems="center"
                    justifyContent={colIndex === 0 ? 'flex-start' : 'flex-end'}
                    {...(column.columnProps as IXStackProps)}
                  >
                    {column.renderSkeleton?.()}
                  </XStack>
                ) : null,
              )}
            </XStack>
          ))
        : tokens.map((record, rowIndex) => (
            <PopularTradingRowContainer
              key={keyExtractor(record)}
              symbol={record.symbol}
              shouldUseTableLayout
              onPress={() => onTokenPress(record)}
            >
              {columns.map((column, colIndex) =>
                column ? (
                  <XStack
                    key={column.dataIndex}
                    flex={1}
                    flexBasis={0}
                    alignItems="center"
                    justifyContent={colIndex === 0 ? 'flex-start' : 'flex-end'}
                    {...(column.columnProps as IXStackProps)}
                  >
                    {column.render?.(
                      record[column.dataIndex as keyof IFavoriteTokenDisplay],
                      record,
                      rowIndex,
                    )}
                  </XStack>
                ) : null,
              )}
            </PopularTradingRowContainer>
          ))}
    </YStack>
  );
}

function MarketCategoryTokenList({
  tokens,
  isLoading,
  tableLayout,
  isTokenInWatchList,
  onStarPress,
  onTokenPress,
  onViewMore,
}: IMarketCategoryTokenListProps) {
  const intl = useIntl();
  const { md } = useMedia();
  const shouldUseTableLayout = Boolean(tableLayout && !md);

  const renderStarButton = useCallback(
    (record: IFavoriteTokenDisplay) => {
      const checked = isTokenInWatchList(record);
      return (
        <IconButton
          testID={
            shouldUseTableLayout
              ? HomeTestIDs.popularTokenStarBtnDesktop(record.symbol)
              : HomeTestIDs.popularTokenStarBtnMobile(record.symbol)
          }
          title={intl.formatMessage({
            id: checked
              ? ETranslations.market_remove_from_favorites
              : ETranslations.market_add_to_favorites,
          })}
          icon={checked ? 'StarSolid' : 'StarOutline'}
          variant="tertiary"
          size="small"
          iconProps={{
            color: checked ? '$iconActive' : '$iconSubdued',
          }}
          m="$0"
          onPress={() => void onStarPress(record)}
          {...(shouldUseTableLayout
            ? undefined
            : {
                hoverStyle: { bg: 'transparent' },
                pressStyle: { bg: 'transparent' },
              })}
        />
      );
    },
    [intl, isTokenInWatchList, onStarPress, shouldUseTableLayout],
  );

  const loading = isLoading !== false && tokens.length === 0;
  const empty = !loading && tokens.length === 0;

  return (
    <YStack>
      <YStack
        minHeight={
          HOME_MARKET_CATEGORY_REQUEST_LIMIT *
            HOME_MARKET_TABLE_ROW_MIN_HEIGHT +
          (shouldUseTableLayout ? 32 : 0)
        }
      >
        {empty ? (
          <Stack alignItems="center" justifyContent="center" p="$8">
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_no_data })}
            </SizableText>
          </Stack>
        ) : (
          <PopularTradingTokenListRows
            testID="category-table"
            tokens={tokens}
            shouldUseTableLayout={shouldUseTableLayout}
            showSkeleton={loading}
            skeletonCount={HOME_MARKET_CATEGORY_REQUEST_LIMIT}
            keyExtractor={getMarketCategoryTokenKey}
            renderStarButton={renderStarButton}
            onTokenPress={onTokenPress}
          />
        )}
      </YStack>
      {empty ? (
        <Stack height={50} />
      ) : (
        <XStack pt="$3" px="$pagePadding" jc="center" ai="center">
          <Button
            testID={HomeTestIDs.popularViewMoreBtn}
            variant="secondary"
            iconAfter="ChevronRightSmallOutline"
            onPress={onViewMore}
            disabled={loading}
            flexGrow={1}
            flexBasis={0}
            {...(md
              ? {
                  borderRadius: '$full',
                  hoverStyle: { bg: 'transparent' },
                  pressStyle: { bg: 'transparent' },
                }
              : undefined)}
          >
            {intl.formatMessage({ id: ETranslations.global_view_more })}
          </Button>
        </XStack>
      )}
    </YStack>
  );
}

export { MarketCategoryTokenList, PopularTradingTokenListRows };
