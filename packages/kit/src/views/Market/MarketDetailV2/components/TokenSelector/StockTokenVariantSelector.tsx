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
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
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

// Figma 25497:17813 (Select): the panel is 384 wide and its header/rows share a
// four-slot layout - a 32 avatar slot followed by three equal-width columns
// separated by a 12 gap. The header repeats the avatar slot as a plain spacer
// (25884:24154) so the Issuer and Token Price labels line up with their values.
const AVATAR_SLOT_WIDTH = 32;
const HEADER_SPACER_HEIGHT = 16;
const POPOVER_WIDTH = 384;
const ROW_MIN_HEIGHT = 62;
// Figma 25672:54928: the trigger avatar is 28 with a 12 chain badge. The shared
// Token size scale steps 24 -> 32, so the badge is composed here instead.
const TRIGGER_TOKEN_SIZE = 28;
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

export function getIssuerLabel(issuer: string) {
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
  const balance = findVariantBalance({ portfolioData, variant });
  const isTradable = isStockTokenVariantTradable(variant);
  const handlePress = useCallback(() => {
    if (isTradable) {
      onSelect(variant);
    }
  }, [isTradable, onSelect, variant]);

  return (
    <XStack
      testID={`stock-token-variant-row-${index}`}
      minHeight={ROW_MIN_HEIGHT}
      px="$2.5"
      py="$3"
      gap="$3"
      borderRadius="$2"
      alignItems="center"
      bg={selected ? '$bgActive' : 'transparent'}
      opacity={isTradable ? 1 : 0.5}
      hoverStyle={isTradable ? { bg: '$bgHover' } : undefined}
      pressStyle={isTradable ? { bg: '$bgActive' } : undefined}
      cursor={isTradable ? 'pointer' : 'not-allowed'}
      onPress={handlePress}
    >
      <Token
        size="md"
        tokenImageUri={variant.logoUrl}
        networkImageUri={variant.networkLogoUrl}
        showNetworkIcon
      />

      <YStack flex={1} flexBasis={0} minWidth={0} gap="$0.5">
        <XStack alignItems="center" gap="$1">
          <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
            {variant.symbol || variant.name || VALUE_FALLBACK}
          </SizableText>
          {isAlwaysOpenVariant(variant) ? (
            <Stack
              minWidth={36}
              px="$1.5"
              py="$0.5"
              borderRadius="$1"
              bg="$bgStrong"
              alignItems="center"
            >
              <SizableText size="$bodyXsMedium" color="$textSubdued">
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

      <XStack flex={1} flexBasis={0} minWidth={0} alignItems="center" gap="$1">
        <Token size="xxs" tokenImageUri={variant.issuerLogoUrl} />
        <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
          {getIssuerLabel(variant.issuer)}
        </SizableText>
      </XStack>

      <XStack flex={1} flexBasis={0} minWidth={0} alignItems="center">
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

// Figma 25672:54928. `Token` only exposes 24 (sm) and 32 (md) avatars, so the
// 28 trigger avatar keeps Token for the image (fallback/skeleton behavior) and
// re-creates the chain badge that Token would otherwise place around a 24 box.
function StockTokenVariantTriggerToken({
  variant,
}: {
  variant: IMarketStockTokenVariant;
}) {
  return (
    <Stack
      position="relative"
      width={TRIGGER_TOKEN_SIZE}
      height={TRIGGER_TOKEN_SIZE}
    >
      <Token
        size="sm"
        w={TRIGGER_TOKEN_SIZE}
        h={TRIGGER_TOKEN_SIZE}
        tokenImageUri={variant.logoUrl}
      />
      {variant.networkLogoUrl ? (
        <Stack
          position="absolute"
          right="$-1"
          bottom="$-1"
          p="$0.5"
          bg="$bgApp"
          borderRadius="$full"
        >
          <NetworkAvatarBase size="$3" logoURI={variant.networkLogoUrl} />
        </Stack>
      ) : null}
    </Stack>
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
      return (
        <Skeleton
          width={104}
          height={TRIGGER_TOKEN_SIZE}
          borderRadius="$full"
        />
      );
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
      floatingPanelProps={{ width: POPOVER_WIDTH }}
      renderTrigger={
        // Figma 25672:54926. The pressable area is tight to its content (28
        // avatar + 10 gap + label + 8 gap + 18 chevron) while the hover pill
        // bleeds 8 horizontally / 4 vertically past it, which the negative
        // margin reproduces without changing the row's layout width.
        // eslint-disable-next-line props-checker/validator -- Popover injects the trigger press handler.
        <XStack
          testID={`stock-token-variant-selector-trigger-${selectedIndex}`}
          mx={-8}
          my={-4}
          px="$2"
          py="$1"
          alignItems="center"
          gap="$2.5"
          borderRadius="$full"
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
        >
          <StockTokenVariantTriggerToken variant={selectedTokenVariant} />
          <XStack alignItems="center" gap="$2">
            <SizableText size="$headingMd" numberOfLines={1}>
              {selectedTokenVariant.symbol ||
                selectedTokenVariant.name ||
                VALUE_FALLBACK}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4.5"
              color="$iconSubdued"
            />
          </XStack>
        </XStack>
      }
      renderContent={({ closePopover }) => (
        <YStack
          testID="stock-token-variant-selector-content"
          width={POPOVER_WIDTH}
          p="$1"
        >
          <XStack px="$2.5" py="$2" gap="$3" alignItems="center">
            <SizableText
              flex={1}
              flexBasis={0}
              minWidth={0}
              size="$bodySmMedium"
              color="$textSubdued"
              numberOfLines={1}
            >
              {`${intl.formatMessage({
                id: ETranslations.dexmarket_token_name,
              })}/${intl.formatMessage({
                id: ETranslations.global_balance,
              })}`}
            </SizableText>
            <Stack
              width={AVATAR_SLOT_WIDTH}
              height={HEADER_SPACER_HEIGHT}
              pointerEvents="none"
            />
            <SizableText
              flex={1}
              flexBasis={0}
              minWidth={0}
              size="$bodySmMedium"
              color="$textSubdued"
              numberOfLines={1}
            >
              {intl.formatMessage({
                id: ETranslations.trade_stocks_token_issuer,
              })}
            </SizableText>
            <SizableText
              flex={1}
              flexBasis={0}
              minWidth={0}
              size="$bodySmMedium"
              color="$textSubdued"
              textDecorationLine="underline"
              numberOfLines={1}
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
