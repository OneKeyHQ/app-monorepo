import { useCallback } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  type ILinkConfigItem,
  REFERRAL_PERKS_BANNER_LINK_SLOT,
} from '@onekeyhq/shared/types/linkConfig';

import { useInviteHomeCardStyle } from '../InviteReward/components/useInviteCardStyle';

const EMPTY_ITEMS: ILinkConfigItem[] = [];

// TODO: remove before merge. Dev builds show these slides while the
// referral_perks_banner slot has nothing configured, for design review.
const SHOW_PREVIEW_ITEMS = platformEnv.isDev;
const PREVIEW_ITEMS: ILinkConfigItem[] = [
  {
    linkId: 'preview-1',
    description: 'Exclusive trading perk',
    title: 'Hit the trading goal, get BTC + KeyTag',
    mode: 3,
    payload: 'https://onekey.so',
    image:
      'https://uni.onekey-asset.com/server-service-indexer/btc--0/tokens/address-.png',
  },
  {
    linkId: 'preview-2',
    description: 'Limited time',
    title: '$70,000 in USDT rewards, only on OneKey',
    mode: 3,
    payload: 'https://onekey.so',
    image: 'https://uni.onekey-asset.com/icons/eth.png',
  },
  {
    linkId: 'preview-3',
    description: 'Perps',
    title: 'Zero fees on your first Perps trade',
    mode: 3,
    payload: 'https://onekey.so',
    image: null,
  },
];

// Compact cards keep one height, so paging never moves the content below.
const COMPACT_BANNER_HEIGHT = 136;
const POINTER_BANNER_HEIGHT = 184;
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
  const items = result ?? EMPTY_ITEMS;
  return SHOW_PREVIEW_ITEMS && !items.length ? PREVIEW_ITEMS : items;
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
  const imageSize = compact ? 88 : 128;

  // Borderless: the frame around the pager draws the card, so a neighbor
  // slide peeking in at the pager's edge never shows a border of its own.
  return (
    <XStack
      testID={`perks-banner-${item.linkId}`}
      flex={1}
      p={compact ? '$4' : '$6'}
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
              size={compact ? '$headingMd' : '$heading2xl'}
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

// Swipeable campaign slides that lead the Perks tab. Renders nothing while
// the slot has no slides, so the content below moves up.
export function PerksCampaignBanner({
  items,
  compact,
}: {
  items: ILinkConfigItem[];
  compact: boolean;
}) {
  const cardStyle = useInviteHomeCardStyle();
  const isMulti = items.length > 1;
  const renderItem = useCallback(
    ({ item }: { item: ILinkConfigItem }) => (
      <PerksBannerSlide item={item} compact={compact} />
    ),
    [compact],
  );
  if (!items.length) {
    return null;
  }
  const height = compact ? COMPACT_BANNER_HEIGHT : POINTER_BANNER_HEIGHT;
  return (
    <YStack testID="perks-banner" {...cardStyle} overflow="hidden">
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
          bottom: compact ? '$3' : '$4',
          right: compact ? '$4' : '$6',
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
    </YStack>
  );
}
