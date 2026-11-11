import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITableProps } from '@onekeyhq/components';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { MARKET_TOKEN_ROW_GROUP_NAME } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RichTable } from '../RichTable';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import {
  HOME_MARKET_TABLE_HEADER_MIN_HEIGHT,
  HOME_MARKET_TABLE_ROW_MIN_HEIGHT,
  getPopularTradingColumns,
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

  const columns = useMemo<ITableProps<IFavoriteTokenDisplay>['columns']>(() => {
    const renderStarButton = (record: IFavoriteTokenDisplay) => {
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
    };

    return getPopularTradingColumns({
      intl,
      shouldUseTableLayout,
      renderStarButton,
    });
  }, [intl, isTokenInWatchList, onStarPress, shouldUseTableLayout]);

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
          <RichTable<IFavoriteTokenDisplay>
            showSkeleton={loading}
            skeletonCount={HOME_MARKET_CATEGORY_REQUEST_LIMIT}
            showHeader={shouldUseTableLayout}
            dataSource={tokens}
            columns={columns}
            keyExtractor={getMarketCategoryTokenKey}
            estimatedItemSize={HOME_MARKET_TABLE_ROW_MIN_HEIGHT}
            rowProps={{
              mx: '$2',
              px: '$3',
              minHeight: HOME_MARKET_TABLE_ROW_MIN_HEIGHT,
              ...(shouldUseTableLayout
                ? { group: MARKET_TOKEN_ROW_GROUP_NAME }
                : undefined),
            }}
            headerRowProps={{
              px: '$3',
              mx: '$2',
              ...(shouldUseTableLayout
                ? { minHeight: HOME_MARKET_TABLE_HEADER_MIN_HEIGHT }
                : undefined),
            }}
            onRow={(record) => ({
              onPress: () => onTokenPress(record),
              onPressIn: () => {
                defaultLogger.market.navigation.homeTokenNavigation({
                  stage: 'pressIn',
                  symbol: record.symbol,
                });
              },
              onPressOut: () => {
                defaultLogger.market.navigation.homeTokenNavigation({
                  stage: 'pressOut',
                  symbol: record.symbol,
                });
              },
              onLongPress: platformEnv.isNative
                ? () => {
                    defaultLogger.market.navigation.homeTokenNavigation({
                      stage: 'longPress',
                      symbol: record.symbol,
                    });
                  }
                : undefined,
            })}
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

export { MarketCategoryTokenList };
