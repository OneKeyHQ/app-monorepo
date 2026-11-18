import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import {
  HOME_MARKET_TABLE_HEADER_MIN_HEIGHT,
  HOME_MARKET_TABLE_ROW_MIN_HEIGHT,
  getPopularTradingColumns,
  renderPopularTradingPriceWithChange,
  renderPopularTradingTokenIdentity,
} from './metricColumns';
import { PopularTradingRowContainer } from './PopularTradingRowContainer';

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

type IPopularTradingColumns = NonNullable<
  ITableProps<IFavoriteTokenDisplay>['columns']
>;

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

function PopularTradingMobileSkeletonRow() {
  return (
    <XStack
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
  );
}

function PopularTradingMobileRows({
  testID,
  tokens,
  showSkeleton = false,
  skeletonCount = HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  keyExtractor,
  renderStarButton,
  onTokenPress,
}: Omit<IPopularTradingTokenListRowsProps, 'shouldUseTableLayout'>) {
  return (
    <YStack testID={testID}>
      {showSkeleton
        ? Array.from({ length: skeletonCount }).map((_, index) => (
            <PopularTradingMobileSkeletonRow key={index} />
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

function PopularTradingDesktopHeader({
  columns,
}: {
  columns: IPopularTradingColumns;
}) {
  return (
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
  );
}

function PopularTradingDesktopSkeletonRow({
  columns,
}: {
  columns: IPopularTradingColumns;
}) {
  return (
    <XStack
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
  );
}

function PopularTradingDesktopRow({
  record,
  rowIndex,
  columns,
  onTokenPress,
}: {
  record: IFavoriteTokenDisplay;
  rowIndex: number;
  columns: IPopularTradingColumns;
  onTokenPress: (record: IFavoriteTokenDisplay) => void;
}) {
  return (
    <PopularTradingRowContainer
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
  );
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
  const columns = useMemo<IPopularTradingColumns>(
    () =>
      shouldUseTableLayout
        ? getPopularTradingColumns({ intl, renderStarButton })
        : [],
    [intl, renderStarButton, shouldUseTableLayout],
  );

  if (!shouldUseTableLayout) {
    return (
      <PopularTradingMobileRows
        testID={testID}
        tokens={tokens}
        showSkeleton={showSkeleton}
        skeletonCount={skeletonCount}
        keyExtractor={keyExtractor}
        renderStarButton={renderStarButton}
        onTokenPress={onTokenPress}
      />
    );
  }

  return (
    <YStack testID={testID}>
      <PopularTradingDesktopHeader columns={columns} />
      {showSkeleton
        ? Array.from({ length: skeletonCount }).map((_, rowIndex) => (
            <PopularTradingDesktopSkeletonRow
              key={rowIndex}
              columns={columns}
            />
          ))
        : tokens.map((record, rowIndex) => (
            <PopularTradingDesktopRow
              key={keyExtractor(record)}
              record={record}
              rowIndex={rowIndex}
              columns={columns}
              onTokenPress={onTokenPress}
            />
          ))}
    </YStack>
  );
}

function CategoryViewMoreFooter({
  empty,
  loading,
  md,
  label,
  onViewMore,
}: {
  empty: boolean;
  loading: boolean;
  md: boolean;
  label: string;
  onViewMore: () => void;
}) {
  if (empty) {
    return <Stack height={50} />;
  }

  return (
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
        {label}
      </Button>
    </XStack>
  );
}

function useCategoryStarButtonRenderer({
  shouldUseTableLayout,
  isTokenInWatchList,
  onStarPress,
}: {
  shouldUseTableLayout: boolean;
  isTokenInWatchList: (record: IFavoriteTokenDisplay) => boolean;
  onStarPress: (record: IFavoriteTokenDisplay) => void | Promise<void>;
}) {
  const intl = useIntl();
  return useCallback(
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
          iconProps={{ color: checked ? '$iconActive' : '$iconSubdued' }}
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
  const renderStarButton = useCategoryStarButtonRenderer({
    shouldUseTableLayout,
    isTokenInWatchList,
    onStarPress,
  });

  const loading = isLoading !== false && tokens.length === 0;
  const empty = !loading && tokens.length === 0;
  const minHeight =
    HOME_MARKET_CATEGORY_REQUEST_LIMIT * HOME_MARKET_TABLE_ROW_MIN_HEIGHT +
    (shouldUseTableLayout ? 32 : 0);

  return (
    <YStack>
      <YStack minHeight={minHeight}>
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
      <CategoryViewMoreFooter
        empty={empty}
        loading={loading}
        md={Boolean(md)}
        label={intl.formatMessage({ id: ETranslations.global_view_more })}
        onViewMore={onViewMore}
      />
    </YStack>
  );
}

export { MarketCategoryTokenList, PopularTradingTokenListRows };
