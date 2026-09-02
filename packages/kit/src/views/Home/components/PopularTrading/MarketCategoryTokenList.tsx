import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITableProps } from '@onekeyhq/components';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RichTable } from '../RichTable';

import { HOME_MARKET_CATEGORY_REQUEST_LIMIT } from './constants';
import { getPopularTradingColumns } from './metricColumns';

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
      if (record.marketAsset) {
        return <Icon name="StarOutline" size="$5" color="$iconSubdued" />;
      }

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
        keyExtractor={getMarketCategoryTokenKey}
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
