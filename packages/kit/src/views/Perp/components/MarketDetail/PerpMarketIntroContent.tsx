import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Illustration,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { PerpTestIDs } from '@onekeyhq/kit/src/views/Perp/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  type IPerpResolvedMarketDetail,
  usePerpResolvedMarketDetail,
} from '../../hooks/usePerpMarketDetail';

import { formatExternalLinkLabel } from './linkLabelUtils';

const INTRO_INFO_COLUMN_GAP = '$5';
const INTRO_LINK_LABEL_WIDTH = 96;
const INTRO_LINK_CHIP_MAX_WIDTH = 180;

function formatUsdValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  const formatted = numberFormat(String(value), {
    formatter: 'marketCap',
  });
  return formatted ? `$${formatted}` : '--';
}

function formatUsdPriceValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  return (
    numberFormat(String(value), {
      formatter: 'price',
      formatterOptions: { currency: '$' },
    }) || '--'
  );
}

function formatPlainNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  return (
    numberFormat(String(value), {
      formatter: 'marketCap',
    }) || '--'
  );
}

function formatTokenAmount(
  value?: string | number | null,
  suffix?: string | null,
) {
  const formatted = formatPlainNumber(value);
  if (formatted === '--') {
    return '--';
  }
  return suffix ? `${formatted} ${suffix.toUpperCase()}` : formatted;
}

function formatMarketDate(value?: Date | string | number | null) {
  if (!value) {
    return '--';
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '--';
  }
  return formatDate(parsedDate, {
    hideSeconds: true,
  });
}

function sanitizeDescriptionText(value?: string | null) {
  if (!value) {
    return '';
  }

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type IIntroInfoItemData = {
  key: string;
  label: string;
  value: string;
  secondaryValue?: string;
};

function IntroInfoItem({
  label,
  value,
  secondaryValue,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
}) {
  if (!value || value === '--') {
    return null;
  }

  return (
    <YStack flex={1} flexBasis={0} minWidth={0} gap="$1">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$headingSm">{value}</SizableText>
      {secondaryValue ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {secondaryValue}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function IntroLinkRow({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; url: string }>;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <XStack alignItems="flex-start" gap="$4">
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        width={INTRO_LINK_LABEL_WIDTH}
        flexShrink={0}
        pt="$1"
      >
        {label}
      </SizableText>
      <XStack
        flex={1}
        minWidth={0}
        gap="$2"
        flexWrap="wrap"
        justifyContent="flex-end"
      >
        {items.map((item) => {
          const displayLabel = formatExternalLinkLabel({
            label: item.label,
            url: item.url,
          });
          const isSquareLabel = displayLabel.length <= 1;

          return (
            <Button
              key={`${label}-${item.label}-${item.url}`}
              testID={PerpTestIDs.MarketIntroLinkButton(
                `${label}-${item.label}`,
              )}
              size="small"
              variant="secondary"
              maxWidth={INTRO_LINK_CHIP_MAX_WIDTH}
              width={isSquareLabel ? 30 : undefined}
              minWidth={30}
              height={30}
              minHeight={30}
              px={isSquareLabel ? '$0' : '$1.5'}
              py="$0"
              borderRadius="$5"
              justifyContent="center"
              childrenAsText={false}
              onPress={() => openUrlExternal(item.url)}
            >
              <SizableText
                size="$bodyXsMedium"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {displayLabel}
              </SizableText>
            </Button>
          );
        })}
      </XStack>
    </XStack>
  );
}

export function PerpMarketIntroContent({
  coin,
  displayName,
  enabled = true,
  resolvedMarketDetail,
  paddingX = '$5',
  paddingTop = '$4',
  paddingBottom = '$6',
}: {
  coin?: string;
  displayName?: string;
  enabled?: boolean;
  resolvedMarketDetail?: {
    result: IPerpResolvedMarketDetail | undefined;
    isLoading: boolean | undefined;
  };
  paddingX?: number | string;
  paddingTop?: number | string;
  paddingBottom?: number | string;
}) {
  const intl = useIntl();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const internalResolvedMarketDetail = usePerpResolvedMarketDetail({
    coin: !resolvedMarketDetail && enabled ? coin : undefined,
    displayName: !resolvedMarketDetail && enabled ? displayName : undefined,
  });
  const effectiveResolvedMarketDetail =
    resolvedMarketDetail ?? internalResolvedMarketDetail;

  const marketDetail = effectiveResolvedMarketDetail.result?.detail;
  const marketDetailReferenceNote = intl.formatMessage({
    id: ETranslations.perp_market_info_reference_note__desc,
  });
  const aboutText = useMemo(
    () => sanitizeDescriptionText(marketDetail?.about) || '',
    [marketDetail?.about],
  );

  const infoItems = useMemo(
    () =>
      marketDetail
        ? ({
            marketCapRank: {
              key: 'marketCapRank',
              label: intl.formatMessage({
                id: ETranslations.dexmarket_details_holders_rank,
              }),
              value: marketDetail.stats.marketCapRank
                ? `#${marketDetail.stats.marketCapRank}`
                : '--',
            },
            marketCap: {
              key: 'marketCap',
              label: intl.formatMessage({
                id: ETranslations.global_market_cap,
              }),
              value: formatUsdValue(marketDetail.stats.marketCap),
            },
            fdv: {
              key: 'fdv',
              label: intl.formatMessage({
                id: ETranslations.perp_market_info_fully_diluted_valuation__title,
              }),
              value: formatUsdValue(marketDetail.stats.fdv),
            },
            volume24h: {
              key: 'volume24h',
              label: intl.formatMessage({
                id: ETranslations.market_twenty_four_hour_volume,
              }),
              value: formatUsdValue(marketDetail.stats.volume24h),
            },
            circulatingSupply: {
              key: 'circulatingSupply',
              label: intl.formatMessage({
                id: ETranslations.global_circulating_supply,
              }),
              value: formatTokenAmount(
                marketDetail.stats.circulatingSupply,
                marketDetail.symbol,
              ),
            },
            totalSupply: {
              key: 'totalSupply',
              label: intl.formatMessage({
                id: ETranslations.global_total_supply,
              }),
              value: formatTokenAmount(
                marketDetail.stats.totalSupply,
                marketDetail.symbol,
              ),
            },
            maxSupply: {
              key: 'maxSupply',
              label: intl.formatMessage({
                id: ETranslations.global_max_supply,
              }),
              value: formatTokenAmount(
                marketDetail.stats.maxSupply,
                marketDetail.symbol,
              ),
            },
            ath: {
              key: 'ath',
              label: intl.formatMessage({
                id: ETranslations.market_all_time_high,
              }),
              value: formatUsdPriceValue(marketDetail.stats.ath.value),
              secondaryValue: formatMarketDate(marketDetail.stats.ath.time),
            },
            atl: {
              key: 'atl',
              label: intl.formatMessage({
                id: ETranslations.market_all_time_low,
              }),
              value: formatUsdPriceValue(marketDetail.stats.atl.value),
              secondaryValue: formatMarketDate(marketDetail.stats.atl.time),
            },
          } satisfies Record<string, IIntroInfoItemData>)
        : undefined,
    [intl, marketDetail],
  );

  const linkRows = useMemo(
    () =>
      marketDetail
        ? [
            {
              label: intl.formatMessage({
                id: ETranslations.global_website,
              }),
              items: [
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_official_website,
                  }),
                  url: marketDetail.links.homePageUrl,
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_white_paper,
                  }),
                  url: marketDetail.links.whitepaper,
                },
              ].filter((item) => Boolean(item.url)) as Array<{
                label: string;
                url: string;
              }>,
            },
            {
              label: intl.formatMessage({
                id: ETranslations.global_block_explorer,
              }),
              items:
                marketDetail.explorers
                  ?.slice(0, 2)
                  .map((item) => ({
                    label: item.name,
                    url: item.url,
                  }))
                  .filter((item) => Boolean(item.url)) ?? [],
            },
            {
              label: intl.formatMessage({
                id: ETranslations.perp_market_info_social_media__title,
              }),
              items: [
                { label: 'X', url: marketDetail.links.twitterUrl },
                { label: 'Telegram', url: marketDetail.links.telegramUrl },
                { label: 'Discord', url: marketDetail.links.discordUrl },
              ].filter((item) => Boolean(item.url)) as Array<{
                label: string;
                url: string;
              }>,
            },
          ]
        : [],
    [intl, marketDetail],
  );

  const hasAnyLinks = linkRows.some((item) => item.items.length > 0);
  const infoRows = useMemo(
    (): Array<Array<IIntroInfoItemData | undefined>> =>
      infoItems
        ? [
            [infoItems.marketCapRank, infoItems.marketCap],
            [infoItems.fdv, infoItems.volume24h],
            [infoItems.circulatingSupply, infoItems.totalSupply],
            [infoItems.atl, infoItems.ath],
            [infoItems.maxSupply, undefined],
          ]
        : [],
    [infoItems],
  );
  const showDescriptionToggle = aboutText.length > 320;

  if (!enabled) {
    return null;
  }

  if (effectiveResolvedMarketDetail.isLoading) {
    return (
      <YStack
        px={paddingX}
        pt={paddingTop}
        pb={paddingBottom}
        minHeight={220}
        alignItems="center"
        justifyContent="center"
        gap="$3"
      >
        <Spinner size="small" />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_market_info_loading_introduction__desc,
          })}
        </SizableText>
      </YStack>
    );
  }

  if (!marketDetail) {
    return (
      <YStack
        px={paddingX}
        pt={paddingTop}
        pb={paddingBottom}
        minHeight={180}
        alignItems="center"
        justifyContent="center"
        gap="$4"
      >
        <Illustration name="SearchDocument" size={100} />
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          textAlign="center"
          maxWidth={320}
        >
          {intl.formatMessage({
            id: ETranslations.perp_market_info_data_unavailable__desc,
          })}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack px={paddingX} pt={paddingTop} pb={paddingBottom} gap="$6">
      <SizableText size="$bodySm" color="$textSubdued" lineHeight={20}>
        {`* ${marketDetailReferenceNote}`}
      </SizableText>

      <XStack alignItems="center" gap="$3">
        <Token
          size="sm"
          tokenImageUri={
            displayName || marketDetail.symbol || coin
              ? getHyperliquidTokenImageUrl(
                  displayName || marketDetail.symbol || coin || '',
                )
              : marketDetail.image
          }
        />
        <XStack flex={1} minWidth={0} alignItems="baseline" gap="$2.5">
          <SizableText size="$headingLg" numberOfLines={1}>
            {displayName || marketDetail.symbol?.toUpperCase() || coin || '--'}
          </SizableText>
          {marketDetail.name ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {marketDetail.name}
            </SizableText>
          ) : null}
        </XStack>
      </XStack>

      {infoRows.length ? (
        <YStack gap="$3.5">
          <SizableText size="$headingSm">
            {intl.formatMessage({
              id: ETranslations.perp_market_info_coin_info__title,
            })}
          </SizableText>
          <YStack gap="$4">
            {infoRows.map((row, rowIndex) => (
              <XStack
                key={`${rowIndex}-${row[0]?.key || 'row'}`}
                gap={INTRO_INFO_COLUMN_GAP}
                justifyContent="space-between"
                alignItems="flex-start"
              >
                {row[0] ? (
                  <IntroInfoItem
                    key={row[0].key}
                    label={row[0].label}
                    value={row[0].value}
                    secondaryValue={row[0].secondaryValue}
                  />
                ) : (
                  <YStack flex={1} flexBasis={0} />
                )}
                {row[1] ? (
                  <IntroInfoItem
                    key={row[1].key}
                    label={row[1].label}
                    value={row[1].value}
                    secondaryValue={row[1].secondaryValue}
                  />
                ) : (
                  <YStack flex={1} flexBasis={0} />
                )}
              </XStack>
            ))}
          </YStack>
        </YStack>
      ) : null}

      {hasAnyLinks ? (
        <YStack gap="$3.5">
          <SizableText size="$headingSm">
            {intl.formatMessage({ id: ETranslations.global_links })}
          </SizableText>
          <YStack gap="$3.5">
            {linkRows.map((row) => (
              <IntroLinkRow
                key={row.label}
                label={row.label}
                items={row.items}
              />
            ))}
          </YStack>
        </YStack>
      ) : null}

      {aboutText ? (
        <YStack gap="$3.5">
          <SizableText size="$headingSm">
            {intl.formatMessage({
              id: ETranslations.perp_market_info_introduction__title,
            })}
          </SizableText>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            lineHeight={18}
            numberOfLines={isDescriptionExpanded ? undefined : 6}
          >
            {aboutText}
          </SizableText>
          {showDescriptionToggle ? (
            <XStack
              alignItems="center"
              gap="$1"
              alignSelf="flex-start"
              onPress={() => setIsDescriptionExpanded((prev) => !prev)}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: isDescriptionExpanded
                    ? ETranslations.global_collapse
                    : ETranslations.global_expand,
                })}
              </SizableText>
              <Icon
                name={
                  isDescriptionExpanded
                    ? 'ChevronTopSmallOutline'
                    : 'ChevronDownSmallOutline'
                }
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
