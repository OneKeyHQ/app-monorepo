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
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RichTable } from '../RichTable';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import {
  POPULAR_TRADING_NAME_COLUMN_MIN_WIDTH,
  getPopularTradingMetricColumns,
  renderPopularTradingCommunityBadge,
  renderPopularTradingRightMetrics,
  renderPopularTradingStockBadges,
  renderPopularTradingTokenSubtitle,
} from './metricColumns';
import { shouldUseStockMetadataColumnsForTokens } from './utils';

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
  const useStockMetadataColumns = useMemo(
    () => shouldUseStockMetadataColumnsForTokens(tokens),
    [tokens],
  );

  const columns = useMemo<ITableProps<IFavoriteTokenDisplay>['columns']>(() => {
    if (shouldUseTableLayout) {
      return [
        {
          dataIndex: 'symbol',
          title: intl.formatMessage({ id: ETranslations.global_name }),
          columnProps: { minWidth: POPULAR_TRADING_NAME_COLUMN_MIN_WIDTH },
          render: (
            _: unknown,
            record: IFavoriteTokenDisplay,
            _index: number,
          ) => {
            const checked = isTokenInWatchList(record);
            return (
              <XStack alignItems="center" gap="$2" minWidth={0} width="100%">
                <IconButton
                  testID={HomeTestIDs.popularTokenStarBtnMobile(record.symbol)}
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
                />
                <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                  <Token
                    size="md"
                    tokenImageUri={record.logoUrl}
                    tokenImageUris={record.logoUrls}
                    networkId={record.chainId}
                    showNetworkIcon
                  />
                  <YStack flex={1} minWidth={0}>
                    <XStack
                      alignItems="center"
                      gap="$1"
                      minWidth={0}
                      overflow="hidden"
                    >
                      <SizableText
                        size="$bodyLgMedium"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        flexShrink={1}
                      >
                        {record.symbol}
                      </SizableText>
                      {renderPopularTradingStockBadges(record)}
                      {renderPopularTradingCommunityBadge(record)}
                    </XStack>
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      flexShrink={1}
                      maxWidth="100%"
                    >
                      {record.name}
                    </SizableText>
                  </YStack>
                </XStack>
              </XStack>
            );
          },
        },
        ...getPopularTradingMetricColumns({
          intl,
          useStockMetadataColumns,
        }),
      ];
    }

    return [
      {
        dataIndex: 'symbol',
        title: intl.formatMessage({ id: ETranslations.global_name }),
        columnProps: { flex: 1.35, flexBasis: 0, minWidth: 0 },
        render: (_: unknown, record: IFavoriteTokenDisplay, _index: number) => {
          const checked = isTokenInWatchList(record);
          return (
            <XStack alignItems="center" gap="$2" minWidth={0} width="100%">
              <IconButton
                testID={HomeTestIDs.popularTokenStarBtnDesktop(record.symbol)}
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
                hoverStyle={{ bg: 'transparent' }}
                pressStyle={{ bg: 'transparent' }}
              />
              <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                <Token
                  size="lg"
                  tokenImageUri={record.logoUrl}
                  tokenImageUris={record.logoUrls}
                  networkId={record.chainId}
                  showNetworkIcon
                />
                <YStack flex={1} minWidth={0}>
                  <XStack
                    alignItems="center"
                    gap="$1"
                    minWidth={0}
                    overflow="hidden"
                  >
                    <SizableText
                      size="$bodyLgMedium"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      flexShrink={1}
                    >
                      {record.symbol}
                    </SizableText>
                    {renderPopularTradingStockBadges(record)}
                    {renderPopularTradingCommunityBadge(record)}
                  </XStack>
                  {renderPopularTradingTokenSubtitle(record)}
                </YStack>
              </XStack>
            </XStack>
          );
        },
      },
      {
        dataIndex: 'price',
        title: intl.formatMessage({ id: ETranslations.global_price }),
        columnProps: { flex: 0.85, flexBasis: 0, minWidth: 0 },
        render: (_: unknown, record: IFavoriteTokenDisplay) =>
          renderPopularTradingRightMetrics(record, useStockMetadataColumns),
      },
    ];
  }, [
    intl,
    isTokenInWatchList,
    onStarPress,
    shouldUseTableLayout,
    useStockMetadataColumns,
  ]);

  if (isLoading !== false && tokens.length === 0) {
    return (
      <ListLoading
        listCount={HOME_MARKET_CATEGORY_REQUEST_LIMIT}
        listContainerProps={{ py: '$0' }}
        listHeaderProps={{ px: '$3' }}
      />
    );
  }

  if (tokens.length === 0) {
    return (
      <Stack alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_no_data,
          })}
        </SizableText>
      </Stack>
    );
  }

  return (
    <YStack>
      <RichTable<IFavoriteTokenDisplay>
        showHeader={shouldUseTableLayout}
        dataSource={tokens}
        columns={columns}
        keyExtractor={(item) => `${item.chainId}-${item.contractAddress}`}
        estimatedItemSize={56}
        rowProps={{
          mx: '$2',
          px: '$3',
        }}
        headerRowProps={{
          px: '$3',
          mx: '$2',
        }}
        onRow={(record) => ({
          onPress: () => onTokenPress(record),
        })}
      />
      <XStack pt="$3" px="$pagePadding" jc="center" ai="center">
        <Button
          testID={HomeTestIDs.popularViewMoreBtn}
          variant="secondary"
          iconAfter="ChevronRightSmallOutline"
          onPress={onViewMore}
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
    </YStack>
  );
}

export { MarketCategoryTokenList };
