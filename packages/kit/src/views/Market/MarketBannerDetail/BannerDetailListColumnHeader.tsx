import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../testIDs';

export type IBannerDetailSortType = 'asc' | 'desc';
export type IBannerDetailColumnMode = 'compact' | 'two' | 'three';

export function resolveBannerDetailColumnMode(
  width: number,
): IBannerDetailColumnMode {
  const availableWidth = width - 40 - 32 - 14 - 8;
  if (width >= 1024 && availableWidth >= 256 + 3 * 104) return 'three';
  if (width >= 768 && availableWidth >= 256 + 2 * 104) return 'two';
  return 'compact';
}

const BANNER_SORT_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

function getBannerSortIconName(sortType?: IBannerDetailSortType) {
  if (sortType === 'desc') {
    return 'ChevronDownSmallOutline';
  }
  if (sortType === 'asc') {
    return 'ChevronTopSmallOutline';
  }
  return 'ChevronGrabberVerOutline';
}

export function BannerDetailListColumnHeader({
  primaryColumnTitle,
  changeSortType,
  change24hColumnTitle,
  onChangeSortPress,
  columnMode = 'compact',
}: {
  primaryColumnTitle: string;
  changeSortType?: IBannerDetailSortType;
  change24hColumnTitle: string;
  onChangeSortPress: () => void;
  columnMode?: IBannerDetailColumnMode;
}) {
  const intl = useIntl();
  const changeSortIconName = getBannerSortIconName(changeSortType);

  if (columnMode !== 'compact') {
    return (
      <XStack key="table" px="$5" py="$2" gap="$2" ai="center">
        <XStack flex={2} minWidth={0}>
          <SizableText
            pl={46}
            color="$textSubdued"
            size="$bodySmMedium"
            numberOfLines={1}
          >
            {columnMode === 'three'
              ? intl.formatMessage({ id: ETranslations.global_name })
              : primaryColumnTitle}
          </SizableText>
        </XStack>
        <SizableText
          flex={1}
          textAlign="right"
          color="$textSubdued"
          size="$bodySmMedium"
        >
          {intl.formatMessage({ id: ETranslations.global_price })}
        </SizableText>
        <XStack
          flex={1}
          jc="flex-end"
          ai="center"
          gap="$1"
          onPress={onChangeSortPress}
          pressStyle={{ opacity: 0.8 }}
          cursor="pointer"
          testID={MarketTestIDs.sortByChange}
          hitSlop={BANNER_SORT_HIT_SLOP}
          accessibilityRole="button"
        >
          <SizableText
            color="$textSubdued"
            size="$bodySmMedium"
            textAlign="right"
            numberOfLines={1}
          >
            {change24hColumnTitle}
          </SizableText>
          <Icon name={changeSortIconName} color="$iconSubdued" size="$4" />
        </XStack>
        {columnMode === 'three' ? (
          <SizableText
            flex={1}
            textAlign="right"
            color="$textSubdued"
            size="$bodySmMedium"
          >
            {intl.formatMessage({
              id: ETranslations.market_stock_volume__title,
            })}
          </SizableText>
        ) : null}
      </XStack>
    );
  }

  return (
    <XStack key="compact" px="$5">
      <XStack jc="flex-start" ai="center" width="50%">
        <SizableText color="$textSubdued" size="$bodySmMedium" py="$2">
          {primaryColumnTitle}
        </SizableText>
      </XStack>
      <XStack jc="flex-end" ai="center" width="50%">
        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$1"
          py="$2"
          width="100%"
        >
          <XStack
            alignItems="center"
            justifyContent="flex-end"
            gap="$1"
            flex={1}
            minWidth={0}
          >
            <SizableText
              color="$textSubdued"
              size="$bodySmMedium"
              flexShrink={1}
              numberOfLines={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: ETranslations.global_price })}
            </SizableText>
          </XStack>
          <XStack
            alignItems="center"
            justifyContent="flex-end"
            width="$22"
            onPress={onChangeSortPress}
            pressStyle={{ opacity: 0.8 }}
            cursor="pointer"
            testID={MarketTestIDs.sortByChange}
            hitSlop={BANNER_SORT_HIT_SLOP}
            accessibilityRole="button"
          >
            <SizableText
              color="$textSubdued"
              size="$bodySmMedium"
              textAlign="right"
              numberOfLines={1}
              flexShrink={1}
            >
              {change24hColumnTitle}
            </SizableText>
            <Icon name={changeSortIconName} color="$iconSubdued" size="$4" />
          </XStack>
        </XStack>
      </XStack>
    </XStack>
  );
}
