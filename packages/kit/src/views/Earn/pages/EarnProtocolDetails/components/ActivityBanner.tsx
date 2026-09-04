import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  handleDeepLinkUrl,
  tryHandleOneKeyUniversalLink,
} from '@onekeyhq/kit/src/routes/config/deeplink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnDetailPageBanner } from '@onekeyhq/shared/types/staking';

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Promo strip above the vault detail page.
 *
 * The server assembles the copy, link and end time; the remaining time is
 * counted down here so the strip does not go stale on a page that can stay open
 * for a long time. Colors follow the app's theme rather than the banner's own
 * `theme` field — the detail page is not themed per banner.
 */
export function ActivityBanner({ banner }: { banner: IEarnDetailPageBanner }) {
  const intl = useIntl();
  const [now, setNow] = useState(() => Date.now());

  const remainingMs = banner.endTime ? banner.endTime - now : 0;

  useEffect(() => {
    if (!banner.endTime || remainingMs <= 0) {
      return;
    }
    // Minute resolution: the strip shows whole days, so a faster tick would
    // re-render for nothing.
    const timer = setInterval(() => setNow(Date.now()), ONE_MINUTE_MS);
    return () => clearInterval(timer);
  }, [banner.endTime, remainingMs]);

  const daysLeft = useMemo(() => {
    if (!banner.endTime || remainingMs <= 0) {
      return null;
    }
    // Round up: with 12 hours to go the campaign still has "1 day left", and
    // rounding down would read as though it had already ended.
    return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  }, [banner.endTime, remainingMs]);

  const onPress = useCallback(async () => {
    if (!banner.href) {
      return;
    }
    // Mirrors the Earn home banner: an official universal link navigates
    // natively even when ops typed the href as external.
    if (await tryHandleOneKeyUniversalLink(banner.href)) {
      return;
    }
    if (banner.hrefType === 'external') {
      void openUrlExternal(banner.href);
      return;
    }
    handleDeepLinkUrl({ url: banner.href });
  }, [banner.href, banner.hrefType]);

  return (
    <XStack
      ai="center"
      gap="$3"
      px="$4"
      py="$3"
      bg="$bgSuccessSubdued"
      borderRadius="$3"
      cursor="pointer"
      onPress={onPress}
    >
      {/* icon is an uploaded image URL, same as the Earn home banner */}
      {banner.icon ? (
        <Image src={banner.icon} w="$6" h="$6" resizeMode="contain" />
      ) : null}
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={2}>
          {banner.title}
        </SizableText>
        {banner.description || daysLeft !== null ? (
          <XStack ai="center" gap="$1.5" flexWrap="wrap">
            {banner.description ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {banner.description}
              </SizableText>
            ) : null}
            {banner.description && daysLeft !== null ? (
              <SizableText size="$bodySm" color="$textSubdued">
                •
              </SizableText>
            ) : null}
            {daysLeft !== null ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage(
                  { id: ETranslations.earn_number_days_left },
                  { number: daysLeft },
                )}
              </SizableText>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
      <Icon name="ArrowRightOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}
