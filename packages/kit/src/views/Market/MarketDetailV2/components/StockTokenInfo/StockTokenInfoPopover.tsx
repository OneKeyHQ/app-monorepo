import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  InteractiveIcon,
  Popover,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { useStockDetail } from '../../hooks/StockDetailContext';
import { getIssuerLabel } from '../TokenSelector/StockTokenVariantSelector';

// Matches the trade panel's own Output row (Figma 25672:55964). The design
// never specs an empty state for Shares Per Token, whose ratio some issuers
// omit, so that row reuses this convention pending design sign-off.
const VALUE_FALLBACK = '--';
// Figma 25881:22529: the block matches the trade panel content width (344),
// rows are 20 high with a 14 gap and the card keeps a 16 inset.
const POPOVER_WIDTH = 344;
const ADDRESS_FORMAT_OPTIONS = { leadingLength: 6, trailingLength: 4 };
const PRESSABLE_HOVER_STYLE = { opacity: 0.8 } as const;

// Backend sends the always-open range as "7 × 24"; both the design (Figma
// 25878:22064) and the sibling variant selector badge
// (StockTokenVariantSelector.tsx isAlwaysOpenVariant) surface it as "24/7".
// Any other range (e.g. "5 × 24") has no specified display form, so it passes
// through verbatim.
const ALWAYS_OPEN_DAYS_PATTERN = /^7\s*[x\u00d7]\s*24$/i;

function formatTradingHours(days?: string) {
  const normalizedDays = days?.trim();
  if (!normalizedDays) return VALUE_FALLBACK;
  return ALWAYS_OPEN_DAYS_PATTERN.test(normalizedDays)
    ? '24/7'
    : normalizedDays;
}

function InfoRow({
  label,
  children,
  testID,
}: {
  label: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <XStack minHeight={20} alignItems="center" gap="$2" testID={testID}>
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        justifyContent="flex-end"
        gap="$1.5"
      >
        {children}
      </XStack>
    </XStack>
  );
}

function InfoValueText({ children }: { children: ReactNode }) {
  return (
    <SizableText
      size="$bodyMdMedium"
      color="$text"
      textAlign="right"
      numberOfLines={1}
      flexShrink={1}
    >
      {children}
    </SizableText>
  );
}

function StockTokenInfoContent({
  variant,
  stockId,
}: {
  variant: IMarketStockTokenVariant;
  stockId?: string;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  const website = variant.website?.trim();
  const handleOpenIssuerWebsite = useCallback(() => {
    if (!website) return;
    openUrlExternal(website);
  }, [website]);

  const handleCopyContractAddress = useCallback(() => {
    if (!variant.contractAddress) return;
    copyText(variant.contractAddress);
  }, [copyText, variant.contractAddress]);

  const ticker = stockId || variant.symbol || '';
  const sharesPerToken = variant.tokenToAssetRatio?.trim();
  const tradingHours = formatTradingHours(variant.tradingHours?.days);

  return (
    <YStack
      testID="stock-token-info-content"
      width={POPOVER_WIDTH}
      p="$4"
      gap="$3.5"
    >
      <InfoRow
        label={intl.formatMessage({
          id: ETranslations.trade_stocks_token_issuer,
        })}
        testID="stock-token-info-issuer"
      >
        <XStack
          alignItems="center"
          gap="$1.5"
          minWidth={0}
          cursor={website ? 'pointer' : undefined}
          hoverStyle={website ? PRESSABLE_HOVER_STYLE : undefined}
          onPress={website ? handleOpenIssuerWebsite : undefined}
        >
          {variant.issuerLogoUrl ? (
            <Token size="xxs" tokenImageUri={variant.issuerLogoUrl} />
          ) : null}
          <InfoValueText>{getIssuerLabel(variant.issuer)}</InfoValueText>
          {website ? (
            <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
          ) : null}
        </XStack>
      </InfoRow>

      <InfoRow
        label={intl.formatMessage({
          id: ETranslations.trade_stocks_underlying_asset,
        })}
        testID="stock-token-info-underlying"
      >
        <InfoValueText>{ticker || VALUE_FALLBACK}</InfoValueText>
      </InfoRow>

      <InfoRow
        label={intl.formatMessage({
          id: ETranslations.market_shares_per_token,
        })}
        testID="stock-token-info-shares"
      >
        <InfoValueText>
          {sharesPerToken
            ? [sharesPerToken, ticker].filter(Boolean).join(' ')
            : VALUE_FALLBACK}
        </InfoValueText>
      </InfoRow>

      <InfoRow
        label={intl.formatMessage({ id: ETranslations.trading_hours_title })}
        testID="stock-token-info-trading-hours"
      >
        <InfoValueText>{tradingHours}</InfoValueText>
      </InfoRow>

      <InfoRow
        label={intl.formatMessage({ id: ETranslations.global_network })}
        testID="stock-token-info-network"
      >
        {variant.networkLogoUrl ? (
          <Token size="xxs" tokenImageUri={variant.networkLogoUrl} />
        ) : null}
        <InfoValueText>{variant.networkName || VALUE_FALLBACK}</InfoValueText>
      </InfoRow>

      <InfoRow
        label={intl.formatMessage({
          id: ETranslations.trade_stocks_contract_address,
        })}
        testID="stock-token-info-contract"
      >
        {variant.contractAddress ? (
          <>
            <InfoValueText>
              {accountUtils.shortenAddress({
                address: variant.contractAddress,
                ...ADDRESS_FORMAT_OPTIONS,
              })}
            </InfoValueText>
            <InteractiveIcon
              testID="stock-token-info-contract-copy"
              icon="Copy3Outline"
              size="$4"
              onPress={handleCopyContractAddress}
            />
          </>
        ) : (
          <InfoValueText>{VALUE_FALLBACK}</InfoValueText>
        )}
      </InfoRow>
    </YStack>
  );
}

export function StockTokenInfoPopover() {
  const intl = useIntl();
  const { selectedTokenVariant, stockId } = useStockDetail();

  // Without a resolved variant there is nothing to show, so the icon stays
  // decorative instead of opening an empty popover.
  if (!selectedTokenVariant) {
    return (
      <Icon
        testID="stock-token-info-trigger-disabled"
        name="InfoCircleOutline"
        size="$5"
        color="$iconSubdued"
      />
    );
  }

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.trade_stocks_token_details,
      })}
      placement="bottom-end"
      floatingPanelProps={{ width: POPOVER_WIDTH }}
      renderTrigger={
        // Figma 25672:54934 - icon-only action with a 20 glyph and a circular
        // hover background, which the tertiary IconButton provides by default.
        // eslint-disable-next-line props-checker/validator -- Popover injects the trigger press handler.
        <IconButton
          testID="stock-token-info-trigger"
          icon="InfoCircleOutline"
          size="small"
          variant="tertiary"
        />
      }
      renderContent={() => (
        <StockTokenInfoContent
          variant={selectedTokenVariant}
          stockId={stockId}
        />
      )}
    />
  );
}
