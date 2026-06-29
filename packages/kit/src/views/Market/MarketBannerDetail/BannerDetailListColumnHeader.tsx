import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketTestIDs } from '../testIDs';

export type IBannerDetailSortType = 'asc' | 'desc';

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
  changeSortType,
  change24hColumnTitle,
  onChangeSortPress,
}: {
  changeSortType?: IBannerDetailSortType;
  change24hColumnTitle: string;
  onChangeSortPress: () => void;
}) {
  const intl = useIntl();
  const changeSortIconName = getBannerSortIconName(changeSortType);

  return (
    <XStack px="$5">
      <XStack jc="flex-start" ai="center" width="50%">
        <SizableText color="$textSubdued" size="$bodySmMedium" py="$2">
          {`${intl.formatMessage({
            id: ETranslations.global_name,
          })} / ${intl.formatMessage({
            id: ETranslations.dexmarket_turnover,
          })}`}
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
