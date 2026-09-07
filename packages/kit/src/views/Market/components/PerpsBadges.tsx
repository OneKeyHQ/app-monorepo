import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import { LazyPopover } from '@onekeyhq/components/src/actions/LazyPopover';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';
import type { ITooltipRef } from '@onekeyhq/components/src/actions/Tooltip';
import { TradingHoursTrigger } from '@onekeyhq/kit/src/components/TradingHoursPanel';
import { useUSMarketStatus } from '@onekeyhq/kit/src/hooks/useUSMarketStatus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EUSMarketStatusVariant,
  isOndoUSMarketStock,
  resolveUSMarketStatusVariant,
} from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { truncatePerpsSubtitle } from './utils/perpsSubtitle';

const LeverageBadge = memo(
  ({ leverage, compact }: { leverage: number; compact?: boolean }) => (
    <XStack
      borderRadius="$1"
      bg="$bgInfo"
      justifyContent="center"
      alignItems="center"
      px={compact ? '$1' : '$1.5'}
    >
      <SizableText fontSize={10} color="$textInfo" lineHeight={16}>
        {leverage}x
      </SizableText>
    </XStack>
  ),
);
LeverageBadge.displayName = 'LeverageBadge';

function getPerpDexDescriptionId(dexLabel?: string) {
  switch (dexLabel?.toLowerCase()) {
    case 'xyz':
      return ETranslations.perp_xyz_market__desc;
    case 'para':
      return ETranslations.perp_para_market__desc;
    case 'io':
      return ETranslations.perp_io_market__desc;
    default:
      return undefined;
  }
}

const PerpDexBadge = memo(
  ({
    compact,
    dexLabel,
    height,
    testID,
  }: {
    compact?: boolean;
    dexLabel?: string;
    height?: number;
    testID?: string;
  }) => {
    const intl = useIntl();
    const descriptionId = getPerpDexDescriptionId(dexLabel);

    if (!descriptionId || !dexLabel) {
      return null;
    }

    const label = dexLabel.toLowerCase();
    const description = intl.formatMessage({ id: descriptionId });
    const badgeText = (
      <SizableText color="$textInfo" fontSize={10} lineHeight={16}>
        {label}
      </SizableText>
    );
    const badge = (
      <XStack
        borderRadius="$1"
        bg="$bgInfo"
        justifyContent="center"
        alignItems="center"
        px={compact ? '$1' : '$1.5'}
        height={height}
        testID={testID}
      >
        {badgeText}
      </XStack>
    );

    if (platformEnv.isNative) {
      return (
        <LazyPopover
          title={label}
          placement="top"
          renderTrigger={badge}
          renderContent={
            <YStack px="$5" pb="$4" maxWidth={360}>
              <SizableText size="$bodyLg">{description}</SizableText>
            </YStack>
          }
        />
      );
    }

    return (
      <LazyTooltip
        placement="top"
        renderTrigger={badge}
        renderContent={
          <SizableText size="$bodySm" maxWidth={320}>
            {description}
          </SizableText>
        }
      />
    );
  },
);
PerpDexBadge.displayName = 'PerpDexBadge';

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
      <LazyTooltip
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
    const tooltipRef = useRef<ITooltipRef>({
      closeTooltip: () => Promise.resolve(),
      openTooltip: () => Promise.resolve(),
    });
    const wasTruncatedRef = useRef(false);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
      if (wasTruncatedRef.current && !isTruncated) {
        void tooltipRef.current.closeTooltip();
      }
      wasTruncatedRef.current = isTruncated;
    }, [isTruncated]);

    // On web the name is clipped via CSS ellipsis, so detect truncation by
    // comparing the full content width against the clamped layout width.
    const measureTruncation = useCallback(() => {
      if (platformEnv.isNative) {
        return;
      }
      const el = textRef.current;
      if (el && typeof el.scrollWidth === 'number') {
        const nextIsTruncated = el.scrollWidth > el.clientWidth + 1;
        setIsTruncated((prev) =>
          prev === nextIsTruncated ? prev : nextIsTruncated,
        );
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

    if (platformEnv.isNative) {
      return textElement;
    }

    return (
      <LazyTooltip
        ref={tooltipRef}
        disabled={!isTruncated}
        placement="top"
        renderContent={subtitle}
        renderTrigger={textElement}
        triggerAsChild
      />
    );
  },
);
SubtitleText.displayName = 'SubtitleText';

const STOCK_MARKET_STATUS_CHIPS: Record<
  EUSMarketStatusVariant,
  {
    icon: IKeyOfIcons;
    bg: IColorTokens;
    color: IColorTokens;
  } & (
    | { titleId: ETranslations; title?: undefined }
    // Language-neutral numeral labels (e.g. "24/7") need no translation key.
    | { title: string; titleId?: undefined }
  )
> = {
  [EUSMarketStatusVariant.PreMarket]: {
    icon: 'SunriseOutline',
    titleId: ETranslations.market_status_pre_market,
    bg: '$bgCaution',
    color: '$textCaution',
  },
  [EUSMarketStatusVariant.Open]: {
    icon: 'SunOutline',
    // Named after the trading session rather than a bare "Open", matching the
    // wording the trading-hours panel uses for the same row.
    titleId: ETranslations.trading_hours_regular_market,
    bg: '$bgSuccess',
    color: '$textSuccess',
  },
  [EUSMarketStatusVariant.PostMarket]: {
    icon: 'SunDownOutline',
    titleId: ETranslations.market_status_post_market,
    bg: '$bgCaution',
    color: '$textCaution',
  },
  [EUSMarketStatusVariant.Overnight]: {
    icon: 'MoonOutline',
    titleId: ETranslations.market_status_overnight,
    bg: '$bgInfo',
    color: '$textInfo',
  },
  [EUSMarketStatusVariant.Closed]: {
    icon: 'ClockSnoozeOutline',
    titleId: ETranslations.market_status_closed,
    bg: '$bgStrong',
    color: '$textSubdued',
  },
  [EUSMarketStatusVariant.Open247]: {
    icon: 'ClockTimeHistoryOutline',
    title: '24/7',
    bg: '$bgStrong',
    color: '$textSubdued',
  },
  [EUSMarketStatusVariant.AwaitingOpen]: {
    icon: 'StopwatchOutline',
    titleId: ETranslations.label_market_awaiting_open,
    bg: '$bgCaution',
    color: '$textCaution',
  },
  [EUSMarketStatusVariant.Halted]: {
    icon: 'PauseOutline',
    titleId: ETranslations.market_status_halted,
    bg: '$bgCritical',
    color: '$textCritical',
  },
};

/**
 * Market status chip for tokenized stocks (see OK-58043). Only Ondo tokens
 * follow the US-session model, so only they get a chip (sessions, closed,
 * halted); other issuers (e.g. xStocks run 7×24 with no open/closed
 * distinction) show no badge at all. The chip describes the underlying
 * market only — it no longer implies whether trading is disabled (OK-58986).
 * Pass `disableTooltip` when the chip is used as a popover trigger (e.g. the
 * trading-hours panel) — the wrapping trigger owns the press, so the hover
 * tooltip must not compete with it.
 */
const StockIsOpenBadge = memo(
  ({
    stock,
    disableTooltip,
    variant: displayVariant = 'badge',
  }: {
    stock: IMarketStockInfo;
    disableTooltip?: boolean;
    variant?: 'badge' | 'inline';
  }) => {
    const intl = useIntl();
    const { source, isOpen, isPaused, description } = stock;
    // Every isOpen === true resolution (paused or not) may need the backend
    // status — the 60s poll is also what re-runs the memo below, unfreezing
    // gap-transient variants once the gap ends. Other isOpen values resolve
    // clock-free (Closed / Halted / no chip), so skip the fetch for them.
    const marketStatus = useUSMarketStatus({
      enabled: isOndoUSMarketStock(source) && isOpen === true,
    });
    // The offline fallback path runs Intl-heavy clock math — don't redo it on
    // unrelated parent re-renders.
    const variant = useMemo(
      () =>
        resolveUSMarketStatusVariant({
          source,
          isOpen,
          isPaused,
          status: marketStatus,
        }),
      [source, isOpen, isPaused, marketStatus],
    );

    if (!variant) {
      return null;
    }
    const chip = STOCK_MARKET_STATUS_CHIPS[variant];

    const badge =
      displayVariant === 'inline' ? (
        <XStack alignItems="center" gap="$1">
          <Icon name={chip.icon} size="$4" color={chip.color} />
          <SizableText size="$bodyMd" color={chip.color}>
            {chip.titleId !== undefined
              ? intl.formatMessage({ id: chip.titleId })
              : chip.title}
          </SizableText>
        </XStack>
      ) : (
        <XStack
          borderRadius="$1"
          bg={chip.bg}
          justifyContent="center"
          alignItems="center"
          gap={3}
          px="$1"
        >
          <Icon name={chip.icon} size="$3" color={chip.color} />
          <SizableText fontSize={10} color={chip.color} lineHeight={16}>
            {chip.titleId !== undefined
              ? intl.formatMessage({ id: chip.titleId })
              : chip.title}
          </SizableText>
        </XStack>
      );

    if (disableTooltip || !description || platformEnv.isNative) {
      return badge;
    }

    return (
      <LazyTooltip
        hovering
        placement="bottom"
        renderContent={description}
        renderTrigger={<Stack cursor="pointer">{badge}</Stack>}
      />
    );
  },
);
StockIsOpenBadge.displayName = 'StockIsOpenBadge';

/**
 * Standard entry composition used by every trading-hours surface: the status
 * chip wired to open the panel (hover popover on desktop, bottom-sheet dialog
 * on native/small screens). Renders nothing for tokens without a stock;
 * non-Ondo issuers render no chip (see StockIsOpenBadge).
 */
const StockMarketStatusBadge = memo(
  ({
    stock,
    variant,
  }: {
    stock?: IMarketStockInfo;
    variant?: 'badge' | 'inline';
  }) => {
    if (!stock) {
      return null;
    }
    return (
      <TradingHoursTrigger
        stock={stock}
        renderTrigger={
          <StockIsOpenBadge stock={stock} disableTooltip variant={variant} />
        }
      />
    );
  },
);
StockMarketStatusBadge.displayName = 'StockMarketStatusBadge';

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
        <LazyTooltip
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
  PerpDexBadge,
  StockIsOpenBadge,
  StockMarketStatusBadge,
  StockSourceLogo,
  SubtitleBadge,
  SubtitleText,
};
