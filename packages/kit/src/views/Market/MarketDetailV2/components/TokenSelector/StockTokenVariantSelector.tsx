import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  Popover,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IMarketAccountPortfolioItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';

import {
  isStockTokenVariantTradable,
  useStockDetail,
} from '../../hooks/StockDetailContext';

const TOKEN_COLUMN_WIDTH = 148;
const ISSUER_COLUMN_WIDTH = 96;
const VALUE_FALLBACK = '--';

const ISSUER_LABELS: Record<string, string> = {
  // cspell:disable-next-line
  bstocks: 'bStocks',
  ondo: 'Ondo',
  // cspell:disable-next-line
  xstock: 'xStocks',
  // cspell:disable-next-line
  xstocks: 'xStocks',
};

function getIssuerLabel(issuer: string) {
  const normalizedIssuer = issuer.trim();
  if (!normalizedIssuer) return VALUE_FALLBACK;
  return ISSUER_LABELS[normalizedIssuer.toLowerCase()] ?? normalizedIssuer;
}

function isAlwaysOpenVariant(variant: IMarketStockTokenVariant) {
  return /^7\s*[x×]\s*24$/i.test(variant.tradingHours?.days?.trim() ?? '');
}

function findVariantBalance({
  portfolioData,
  variant,
}: {
  portfolioData?: IMarketAccountPortfolioItem[];
  variant: IMarketStockTokenVariant;
}) {
  const position = portfolioData?.find((item) =>
    equalsIgnoreCase(item.tokenAddress, variant.contractAddress),
  );
  const balance = new BigNumber(position?.amount ?? '');
  return balance.isFinite() ? balance.toFixed() : undefined;
}

function StockTokenVariantRow({
  index,
  variant,
  selected,
  portfolioData,
  onSelect,
}: {
  index: number;
  variant: IMarketStockTokenVariant;
  selected: boolean;
  portfolioData?: IMarketAccountPortfolioItem[];
  onSelect: (variant: IMarketStockTokenVariant) => void;
}) {
  const balance = selected
    ? findVariantBalance({ portfolioData, variant })
    : undefined;
  const isTradable = isStockTokenVariantTradable(variant);
  const handlePress = useCallback(() => {
    if (isTradable) {
      onSelect(variant);
    }
  }, [isTradable, onSelect, variant]);

  return (
    <XStack
      testID={`stock-token-variant-row-${index}`}
      minHeight={62}
      px="$3"
      py="$2"
      borderRadius="$2"
      alignItems="center"
      bg={selected ? '$bgActive' : 'transparent'}
      opacity={isTradable ? 1 : 0.5}
      hoverStyle={isTradable ? { bg: '$bgHover' } : undefined}
      pressStyle={isTradable ? { bg: '$bgActive' } : undefined}
      cursor={isTradable ? 'pointer' : 'not-allowed'}
      onPress={handlePress}
    >
      <XStack width={TOKEN_COLUMN_WIDTH} alignItems="center" gap="$2">
        <Token
          size="sm"
          tokenImageUri={variant.logoUrl}
          networkImageUri={variant.networkLogoUrl}
          showNetworkIcon
        />
        <YStack flex={1} minWidth={0}>
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
              {variant.symbol || variant.name || VALUE_FALLBACK}
            </SizableText>
            {isAlwaysOpenVariant(variant) ? (
              <Stack px="$1" py="$0.5" borderRadius="$1" bg="$bgStrong">
                <SizableText size="$bodySm" color="$textSubdued">
                  24/7
                </SizableText>
              </Stack>
            ) : null}
          </XStack>
          {balance ? (
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter="balance"
              numberOfLines={1}
            >
              {balance}
            </NumberSizeableText>
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              {VALUE_FALLBACK}
            </SizableText>
          )}
        </YStack>
      </XStack>

      <XStack width={ISSUER_COLUMN_WIDTH} alignItems="center" gap="$1.5">
        <Token size="xxs" tokenImageUri={variant.issuerLogoUrl} />
        <SizableText size="$bodyMd" numberOfLines={1} flexShrink={1}>
          {getIssuerLabel(variant.issuer)}
        </SizableText>
      </XStack>

      <XStack flex={1} justifyContent="flex-end">
        {variant.price ? (
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="price"
            formatterOptions={{ currency: '$' }}
            numberOfLines={1}
          >
            {variant.price}
          </NumberSizeableText>
        ) : (
          <SizableText size="$bodyMdMedium">{VALUE_FALLBACK}</SizableText>
        )}
      </XStack>
    </XStack>
  );
}

export function StockTokenVariantSelector({
  portfolioData,
}: {
  portfolioData?: IMarketAccountPortfolioItem[];
}) {
  const intl = useIntl();
  const {
    tokenVariants,
    isTokenVariantsLoading,
    selectedTokenId,
    selectedTokenVariant,
    setSelectedTokenId,
    isTokenVariantsError,
    retryTokenVariants,
  } = useStockDetail();

  const selectedIndex = useMemo(
    () => tokenVariants.findIndex((item) => item.tokenId === selectedTokenId),
    [selectedTokenId, tokenVariants],
  );

  if (!selectedTokenVariant) {
    if (isTokenVariantsLoading) {
      return <Skeleton width={104} height={32} borderRadius="$full" />;
    }
    if (isTokenVariantsError) {
      return (
        <Button
          testID="stock-token-variants-retry"
          size="small"
          variant="tertiary"
          onPress={() => void retryTokenVariants()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      );
    }
    return null;
  }

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.trade_stocks_token_details,
      })}
      placement="bottom-start"
      floatingPanelProps={{ width: 384 }}
      renderTrigger={
        // eslint-disable-next-line props-checker/validator -- Popover injects the trigger press handler.
        <XStack
          testID={`stock-token-variant-selector-trigger-${selectedIndex}`}
          minWidth={104}
          height={32}
          px="$1"
          alignItems="center"
          gap="$2"
          borderRadius="$2"
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
        >
          <Token
            size="sm"
            tokenImageUri={selectedTokenVariant.logoUrl}
            networkImageUri={selectedTokenVariant.networkLogoUrl}
            showNetworkIcon
          />
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {selectedTokenVariant.symbol ||
              selectedTokenVariant.name ||
              VALUE_FALLBACK}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      }
      renderContent={({ closePopover }) => (
        <YStack
          testID="stock-token-variant-selector-content"
          width={384}
          p="$2"
        >
          <XStack height={30} px="$3" alignItems="center">
            <SizableText
              width={TOKEN_COLUMN_WIDTH}
              size="$bodySm"
              color="$textSubdued"
            >
              {`${intl.formatMessage({
                id: ETranslations.dexmarket_token_name,
              })}/${intl.formatMessage({
                id: ETranslations.global_balance,
              })}`}
            </SizableText>
            <SizableText
              width={ISSUER_COLUMN_WIDTH}
              size="$bodySm"
              color="$textSubdued"
            >
              {intl.formatMessage({
                id: ETranslations.trade_stocks_token_issuer,
              })}
            </SizableText>
            <SizableText
              flex={1}
              size="$bodySm"
              color="$textSubdued"
              textAlign="right"
              textDecorationLine="underline"
            >
              {intl.formatMessage({ id: ETranslations.global_price })}
            </SizableText>
          </XStack>
          <ScrollView maxHeight={360} showsVerticalScrollIndicator={false}>
            {tokenVariants.map((variant, index) => (
              <StockTokenVariantRow
                key={variant.tokenId}
                index={index}
                variant={variant}
                selected={variant.tokenId === selectedTokenId}
                portfolioData={portfolioData}
                onSelect={(item) => {
                  setSelectedTokenId(item.tokenId);
                  closePopover();
                }}
              />
            ))}
          </ScrollView>
        </YStack>
      )}
    />
  );
}
