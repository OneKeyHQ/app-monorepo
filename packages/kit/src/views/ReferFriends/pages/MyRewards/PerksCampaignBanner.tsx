import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Carousel,
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useCarouselPressSuppressor,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  type ILinkConfigItem,
  REFERRAL_PERKS_BANNER_LINK_SLOT,
} from '@onekeyhq/shared/types/linkConfig';

import { useInviteHomeCardStyle } from '../InviteReward/components/useInviteCardStyle';

import type { LayoutChangeEvent } from 'react-native';

const EMPTY_ITEMS: ILinkConfigItem[] = [];

// Compact cards keep one height, so paging never moves the content below.
const COMPACT_BANNER_HEIGHT = 136;
// Pointer layouts stretch the banner to the summary card beside it; this is
// only the floor.
const POINTER_BANNER_MIN_HEIGHT = 140;
const AUTO_PLAY_INTERVAL_MS = 5000;

// Last list this session saw, so returning to the tab paints the final
// layout at once instead of growing the banner in after the request.
let lastBannerItems: ILinkConfigItem[] | undefined;

export function usePerksBannerItems() {
  const locale = useLocaleVariant();
  const { result, isLoading } = usePromiseResult(
    async () => {
      try {
        const items =
          await backgroundApiProxy.serviceSetting.fetchGetStartedLinks({
            slots: [REFERRAL_PERKS_BANNER_LINK_SLOT],
          });
        // A slide without copy or art has nothing to show.
        const visible = items.filter(
          (item) => item.title?.trim() || item.image,
        );
        lastBannerItems = visible;
        return visible;
      } catch {
        // Fail closed: a slot error only hides the banner.
        return lastBannerItems ?? EMPTY_ITEMS;
      }
    },
    // Locale is applied by the shared request interceptor; this dep only
    // fetches the copy again when the active language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
    { initResult: lastBannerItems ?? EMPTY_ITEMS, watchLoading: true },
  );
  return {
    items: result ?? EMPTY_ITEMS,
    // Only the first load of the session: after that the cached list paints
    // at once and a refetch swaps it in place.
    isLoading: lastBannerItems === undefined && isLoading !== false,
  };
}

// Mirrors a slide (eyebrow, two title lines, Learn more, art) inside the
// same frame, so the slides replace it without moving anything.
function PerksBannerSkeleton({ compact }: { compact: boolean }) {
  const cardStyle = useInviteHomeCardStyle();
  const imageSize = compact ? 88 : 72;
  return (
    <XStack
      testID="perks-banner-skeleton"
      {...(compact
        ? { h: COMPACT_BANNER_HEIGHT }
        : { flex: 1, minHeight: POINTER_BANNER_MIN_HEIGHT })}
      {...cardStyle}
      px={compact ? '$4' : '$5'}
      py="$4"
      gap="$4"
      ai={compact ? 'center' : 'flex-start'}
    >
      <YStack flex={1} alignSelf="stretch" jc="space-between">
        <YStack gap="$1">
          <Skeleton.BodySm w={80} />
          <Skeleton.HeadingMd w="80%" />
          <Skeleton.HeadingMd w="50%" />
        </YStack>
        <Skeleton.BodyMd w={72} />
      </YStack>
      <Skeleton w={imageSize} h={imageSize} radius={12} />
    </XStack>
  );
}

function PerksBannerSlide({
  item,
  compact,
}: {
  item: ILinkConfigItem;
  compact: boolean;
}) {
  const intl = useIntl();
  const shouldSuppressPress = useCarouselPressSuppressor();
  const handlePress = useCallback(() => {
    // The lift at the end of a swipe still lands as a press.
    if (shouldSuppressPress()) {
      return;
    }
    parseNotificationPayload(item.mode, item.payload, () => {});
  }, [item.mode, item.payload, shouldSuppressPress]);
  const imageSize = compact ? 88 : 72;

  // Borderless: the frame around the pager draws the card, so a neighbor
  // slide peeking in at the pager's edge never shows a border of its own.
  return (
    <XStack
      testID={`perks-banner-${item.linkId}`}
      flex={1}
      // Same inset as the summary card beside it.
      px={compact ? '$4' : '$5'}
      py="$4"
      gap="$4"
      ai="center"
      role="button"
      cursor="default"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handlePress}
    >
      <YStack flex={1} minWidth={0} alignSelf="stretch" jc="space-between">
        <YStack gap="$1">
          {item.description ? (
            <SizableText
              size={compact ? '$bodySm' : '$bodyMd'}
              color="$textSubdued"
              numberOfLines={1}
            >
              {item.description}
            </SizableText>
          ) : null}
          {item.title ? (
            <SizableText size="$headingMd" numberOfLines={2}>
              {item.title}
            </SizableText>
          ) : null}
        </YStack>
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMdMedium" color="$textInteractive">
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </SizableText>
          <Icon name="ArrowRightOutline" size="$4" color="$textInteractive" />
        </XStack>
      </YStack>
      {item.image ? (
        <Image
          width={imageSize}
          height={imageSize}
          flexShrink={0}
          contentFit="contain"
          // Pointer slides hang the art from the top, clear of the dots
          // in the bottom-right corner.
          alignSelf={compact ? undefined : 'flex-start'}
          source={{ uri: item.image }}
        />
      ) : null}
    </XStack>
  );
}

// Swipeable campaign slides that lead the Perks tab. Renders nothing while
// the slot has no slides, so the content below moves up.
export function PerksCampaignBanner({
  items,
  compact,
  loading = false,
}: {
  items: ILinkConfigItem[];
  compact: boolean;
  loading?: boolean;
}) {
  const cardStyle = useInviteHomeCardStyle();
  const isMulti = items.length > 1;
  const [pointerHeight, setPointerHeight] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setPointerHeight(Math.round(event.nativeEvent.layout.height));
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: ILinkConfigItem }) => (
      <PerksBannerSlide item={item} compact={compact} />
    ),
    [compact],
  );
  if (!items.length) {
    return loading ? <PerksBannerSkeleton compact={compact} /> : null;
  }
  const renderCarousel = (height: number) => (
    <Carousel
      data={items}
      renderItem={renderItem}
      autoPlayInterval={AUTO_PLAY_INTERVAL_MS}
      loop={isMulti}
      infinite
      showPagination={isMulti}
      containerStyle={{ height }}
      // Dots sit inside the card, bottom right, across from Learn more.
      paginationContainerStyle={{
        position: 'absolute',
        // Centered on the Learn more line: the card inset plus half of
        // its 20px line height minus the 6px dot.
        bottom: 16 + 7,
        right: compact ? 16 : 20,
      }}
      renderPaginationItem={({ activeDotStyle, onPress }, index) => (
        <YStack
          key={items[index]?.linkId ?? index}
          w={activeDotStyle ? '$3' : '$1.5'}
          h="$1.5"
          ml={index === 0 ? '$0' : '$1.5'}
          borderRadius="$full"
          bg={activeDotStyle ? '$bgPrimary' : '$neutral5'}
          onPress={onPress}
        />
      )}
    />
  );
  if (compact) {
    return (
      <YStack testID="perks-banner" {...cardStyle} overflow="hidden">
        {renderCarousel(COMPACT_BANNER_HEIGHT)}
      </YStack>
    );
  }
  // The pager needs a fixed height, so it is measured from an overlay that
  // fills the stretched column; the overlay never feeds back into the
  // column's own height.
  return (
    <YStack
      testID="perks-banner"
      flex={1}
      minHeight={POINTER_BANNER_MIN_HEIGHT}
      {...cardStyle}
      overflow="hidden"
    >
      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        onLayout={handleLayout}
      >
        {pointerHeight > 0 ? renderCarousel(pointerHeight) : null}
      </YStack>
    </YStack>
  );
}
