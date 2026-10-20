import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Carousel,
  Icon,
  Image,
  SizableText,
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
// only the floor when that card is shorter.
const POINTER_BANNER_MIN_HEIGHT = 176;
const AUTO_PLAY_INTERVAL_MS = 5000;

// Last list this session saw, so returning to the tab paints the final
// layout at once instead of growing the banner in after the request.
let lastBannerItems: ILinkConfigItem[] | undefined;

export function usePerksBannerItems() {
  const locale = useLocaleVariant();
  const { result } = usePromiseResult(
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
    { initResult: lastBannerItems ?? EMPTY_ITEMS },
  );
  return result ?? EMPTY_ITEMS;
}

function PerksBannerSlide({
  item,
  compact,
}: {
  item: ILinkConfigItem;
  compact: boolean;
}) {
  const intl = useIntl();
  const cardStyle = useInviteHomeCardStyle();
  const shouldSuppressPress = useCarouselPressSuppressor();
  const handlePress = useCallback(() => {
    // The lift at the end of a swipe still lands as a press.
    if (shouldSuppressPress()) {
      return;
    }
    parseNotificationPayload(item.mode, item.payload, () => {});
  }, [item.mode, item.payload, shouldSuppressPress]);
  const imageSize = compact ? 88 : 120;

  return (
    <XStack
      testID={`perks-banner-${item.linkId}`}
      flex={1}
      {...cardStyle}
      // The pager clips at its bounds, so the soft lift would be cut off.
      boxShadow={undefined}
      overflow="hidden"
      p={compact ? '$4' : '$5'}
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
            <SizableText
              size={compact ? '$headingMd' : '$headingXl'}
              numberOfLines={2}
            >
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
          source={{ uri: item.image }}
        />
      ) : null}
    </XStack>
  );
}

function PerksBannerCarousel({
  items,
  height,
  compact,
}: {
  items: ILinkConfigItem[];
  height: number;
  compact: boolean;
}) {
  const isMulti = items.length > 1;
  const renderItem = useCallback(
    ({ item }: { item: ILinkConfigItem }) => (
      <PerksBannerSlide item={item} compact={compact} />
    ),
    [compact],
  );
  return (
    <Carousel
      data={items}
      renderItem={renderItem}
      autoPlayInterval={AUTO_PLAY_INTERVAL_MS}
      loop={isMulti}
      infinite
      showPagination={isMulti}
      containerStyle={{ height }}
      // Compact dots sit under the card like the Earn banner; pointer dots
      // stay inside it, so the card's bottom lines up with its neighbor.
      paginationContainerStyle={
        compact
          ? { pt: '$2' }
          : { position: 'absolute', bottom: '$5', right: '$5' }
      }
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
}

// Swipeable campaign slides for the Perks tab. Renders nothing while the
// slot has no slides, so the layout around it decides what fills the space.
export function PerksCampaignBanner({
  items,
  compact,
}: {
  items: ILinkConfigItem[];
  compact: boolean;
}) {
  const [pointerHeight, setPointerHeight] = useState(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setPointerHeight(Math.round(event.nativeEvent.layout.height));
  }, []);

  if (!items.length) {
    return null;
  }
  if (compact) {
    return (
      <YStack testID="perks-banner">
        <PerksBannerCarousel
          items={items}
          height={COMPACT_BANNER_HEIGHT}
          compact
        />
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
    >
      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        onLayout={handleLayout}
      >
        {pointerHeight > 0 ? (
          <PerksBannerCarousel
            items={items}
            height={pointerHeight}
            compact={false}
          />
        ) : null}
      </YStack>
    </YStack>
  );
}
