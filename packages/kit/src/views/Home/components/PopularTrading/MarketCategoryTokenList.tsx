import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  NumberSizeableText,
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
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { RichTable } from '../RichTable';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';

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

  const columns = useMemo<ITableProps<IFavoriteTokenDisplay>['columns']>(() => {
    if (tableLayout) {
      return [
        {
          dataIndex: 'symbol',
          title: intl.formatMessage({ id: ETranslations.global_name }),
          render: (
            _: unknown,
            record: IFavoriteTokenDisplay,
            _index: number,
          ) => {
            const checked = isTokenInWatchList(record);
            return (
              <XStack alignItems="center" gap="$2">
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
                  onPress={() => void onStarPress(record)}
                />
                <XStack alignItems="center" gap="$2">
                  <Token
                    size="md"
                    tokenImageUri={record.logoUrl}
                    networkId={record.chainId}
                    showNetworkIcon
                  />
                  <YStack>
                    <SizableText size="$bodyLgMedium">
                      {record.symbol}
                    </SizableText>
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      numberOfLines={1}
                      maxWidth={200}
                    >
                      {record.name}
                    </SizableText>
                  </YStack>
                </XStack>
              </XStack>
            );
          },
        },
        {
          dataIndex: 'price',
          title: intl.formatMessage({ id: ETranslations.global_price }),
          render: (_: unknown, record: IFavoriteTokenDisplay) => (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{
                currency: '$',
              }}
            >
              {record.price ?? '-'}
            </NumberSizeableText>
          ),
        },
        {
          dataIndex: 'priceChange24h',
          title: intl.formatMessage({ id: ETranslations.market_change_24h }),
          render: (_: unknown, record: IFavoriteTokenDisplay) => {
            const { changeColor, showPlusMinusSigns } =
              getTokenPriceChangeStyle({
                priceChange: record.priceChange24h ?? 0,
              });
            return (
              <NumberSizeableText
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns }}
                color={changeColor}
                size="$bodyLgMedium"
              >
                {record.priceChange24h ?? '-'}
              </NumberSizeableText>
            );
          },
        },
        {
          dataIndex: 'volume24h',
          title: intl.formatMessage({ id: ETranslations.market_24h_turnover }),
          render: (_: unknown, record: IFavoriteTokenDisplay) => (
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="marketCap"
              formatterOptions={{
                currency: '$',
              }}
            >
              {!record.volume24h ? '--' : record.volume24h}
            </NumberSizeableText>
          ),
        },
      ];
    }

    return [
      {
        dataIndex: 'symbol',
        title: intl.formatMessage({ id: ETranslations.global_name }),
        render: (_: unknown, record: IFavoriteTokenDisplay, _index: number) => {
          const checked = isTokenInWatchList(record);
          return (
            <XStack alignItems="center" gap="$2" justifyContent="flex-end">
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
                onPress={() => void onStarPress(record)}
                hoverStyle={{ bg: 'transparent' }}
                pressStyle={{ bg: 'transparent' }}
              />
              <XStack alignItems="center" gap="$2">
                <Token
                  size="lg"
                  tokenImageUri={record.logoUrl}
                  networkId={record.chainId}
                  showNetworkIcon
                />
                <YStack>
                  <SizableText size="$bodyLgMedium">
                    {record.symbol}
                  </SizableText>
                  <NumberSizeableText
                    size="$bodyMd"
                    formatter="marketCap"
                    formatterOptions={{
                      currency: '$',
                    }}
                  >
                    {!record.volume24h ? '--' : record.volume24h}
                  </NumberSizeableText>
                </YStack>
              </XStack>
            </XStack>
          );
        },
      },
      {
        dataIndex: 'price',
        title: intl.formatMessage({ id: ETranslations.global_price }),
        render: (_: unknown, record: IFavoriteTokenDisplay) => {
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: record.priceChange24h ?? 0,
          });
          return (
            <YStack alignItems="flex-end">
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="price"
                formatterOptions={{
                  currency: '$',
                }}
              >
                {record.price ?? '-'}
              </NumberSizeableText>
              <NumberSizeableText
                formatter="priceChange"
                formatterOptions={{ showPlusMinusSigns }}
                color={changeColor}
                size="$bodyMd"
              >
                {record.priceChange24h ?? '-'}
              </NumberSizeableText>
            </YStack>
          );
        },
      },
    ];
  }, [intl, isTokenInWatchList, onStarPress, tableLayout]);

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
        showHeader={!!tableLayout}
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
