import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { truncatePerpsSubtitle } from './utils/perpsSubtitle';

const LeverageBadge = memo(({ leverage }: { leverage: number }) => (
  <XStack
    borderRadius="$1"
    bg="$bgInfo"
    justifyContent="center"
    alignItems="center"
    px="$1.5"
  >
    <SizableText fontSize={10} color="$textInfo" lineHeight={16}>
      {leverage}x
    </SizableText>
  </XStack>
));
LeverageBadge.displayName = 'LeverageBadge';

const SubtitleBadge = memo(
  ({ subtitle, noTruncate }: { subtitle: string; noTruncate?: boolean }) => {
    const normalizedSubtitle = truncatePerpsSubtitle(subtitle);
    const isTruncated = normalizedSubtitle !== subtitle;
    const displayText = noTruncate ? subtitle : normalizedSubtitle;

    const badgeElement = useMemo(
      () => (
        <XStack
          borderRadius="$1"
          bg="$bgStrong"
          justifyContent="center"
          alignItems="center"
          px="$1.5"
          minWidth={0}
          {...(!noTruncate && {
            maxWidth: '$24',
            overflow: 'hidden',
          })}
          flexShrink={1}
        >
          <SizableText
            fontSize={10}
            color="$textSubdued"
            lineHeight={16}
            {...(!noTruncate && {
              numberOfLines: 1,
              ellipsizeMode: 'tail',
            })}
          >
            {displayText}
          </SizableText>
        </XStack>
      ),
      [displayText, noTruncate],
    );

    if (platformEnv.isNative || !isTruncated || noTruncate) {
      return badgeElement;
    }

    return (
      <Tooltip
        renderTrigger={
          <Stack minWidth={0} flexShrink={1}>
            {badgeElement}
          </Stack>
        }
        renderContent={subtitle}
        placement="top"
      />
    );
  },
);
SubtitleBadge.displayName = 'SubtitleBadge';

// Localized name rendered as plain subdued text (no badge background).
// Used in Market/Perps list rows: placed under the symbol on desktop and
// before the volume on mobile.
const SubtitleText = memo(
  ({ subtitle, maxWidth }: { subtitle: string; maxWidth?: number }) => {
    const { gtMd } = useMedia();
    // Unified subtitle size across every Market/Perps list and selector row:
    // 11px on desktop, 12px on mobile. Keep this the single source of truth so
    // the localized name never diverges between lists.
    const size = gtMd ? '$bodyXs' : '$bodySm';
    const textRef = useRef<HTMLElement | null>(null);
    const [isTruncated, setIsTruncated] = useState(false);

    // On web the name is clipped via CSS ellipsis, so detect truncation by
    // comparing the full content width against the clamped layout width.
    const measureTruncation = useCallback(() => {
      if (platformEnv.isNative) {
        return;
      }
      const el = textRef.current;
      if (el && typeof el.scrollWidth === 'number') {
        setIsTruncated(el.scrollWidth > el.clientWidth + 1);
      }
    }, []);

    // The View wrapper carries onLayout (not exposed on SizableText) so we can
    // re-measure truncation whenever the row is laid out or resized.
    const textElement = (
      <Stack minWidth={0} flexShrink={1} onLayout={measureTruncation}>
        <SizableText
          // SizableText forwards its ref to the underlying DOM node on web, but
          // the public prop types don't expose `ref`; attach it via spread so
          // we can read scrollWidth/clientWidth for truncation detection.
          {...({ ref: textRef } as object)}
          size={size}
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
          minWidth={0}
          maxWidth={maxWidth}
          userSelect="none"
        >
          {subtitle}
        </SizableText>
      </Stack>
    );

    // Only show a hover tooltip on desktop when the name is actually cut off.
    if (platformEnv.isNative || !isTruncated) {
      return textElement;
    }

    return (
      <Tooltip
        placement="top"
        renderContent={subtitle}
        renderTrigger={textElement}
      />
    );
  },
);
SubtitleText.displayName = 'SubtitleText';

const StockIsOpenBadge = memo(({ stock }: { stock: IMarketStockInfo }) => {
  const intl = useIntl();
  const { isOpen, description } = stock;

  if (isOpen === undefined) {
    return null;
  }

  const statusText = intl.formatMessage({
    id: isOpen
      ? ETranslations.dexmarket_stock_status_open
      : ETranslations.dexmarket_stock_status_closed,
  });

  const badge = (
    <XStack
      borderRadius="$1"
      bg={isOpen ? '$bgSuccess' : '$bgCaution'}
      justifyContent="center"
      alignItems="center"
      px="$1.5"
    >
      <SizableText
        fontSize={10}
        color={isOpen ? '$textSuccess' : '$textCaution'}
        lineHeight={16}
      >
        {statusText}
      </SizableText>
    </XStack>
  );

  if (!description || platformEnv.isNative) {
    return badge;
  }

  return (
    <Tooltip
      hovering
      placement="bottom"
      renderContent={description}
      renderTrigger={<Stack cursor="pointer">{badge}</Stack>}
    />
  );
});
StockIsOpenBadge.displayName = 'StockIsOpenBadge';

const StockSourceLogo = memo(
  ({ stock }: { stock: IMarketStockInfo | undefined }) => {
    if (!stock?.sourceLogoUri) {
      return null;
    }

    const image = (
      <Image
        width={14}
        height={14}
        borderRadius="$full"
        source={{ uri: stock.sourceLogoUri }}
      />
    );

    if (stock.title && !platformEnv.isNative) {
      return (
        <Tooltip
          hovering
          placement="top"
          renderContent={stock.title}
          renderTrigger={<Stack cursor="pointer">{image}</Stack>}
        />
      );
    }

    return image;
  },
);
StockSourceLogo.displayName = 'StockSourceLogo';

export {
  LeverageBadge,
  StockIsOpenBadge,
  StockSourceLogo,
  SubtitleBadge,
  SubtitleText,
};
