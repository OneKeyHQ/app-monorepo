import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  Icon,
  NumberSizeableText,
  Popover,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketAccountPortfolioDisplayItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  isStockTokenVariantTradable,
  useStockDetail,
} from '../../hooks/StockDetailContext';
import { getStockPortfolioVariantKey } from '../../utils/stockTokenVariant';

import { StockSelectorPopover } from './StockSelectorPopover';

// Figma 25497:17813 (Select): the panel is 384 wide and its header/rows share a
// four-slot layout - a 32 avatar slot followed by three equal-width columns
// separated by a 12 gap. The header repeats the avatar slot as a plain spacer
// (25884:24154) so the Issuer and Token Price labels line up with their values.
const AVATAR_SLOT_WIDTH = 32;
const HEADER_SPACER_HEIGHT = 16;
// Unlike Figma's equal thirds, the name column takes the largest share: it
// carries the symbol, the 24/7 tag and the balance, while the price column only
// ever holds one figure. Header and rows share these weights to stay aligned.
const NAME_COLUMN_FLEX = 1.3;
const ISSUER_COLUMN_FLEX = 1;
const PRICE_COLUMN_FLEX = 0.9;
// 8 narrower than Figma's 384: opened from the trigger's left edge, a 384 panel
// ends 4px short of the window on a gutter-limited layout, inside the popper's
// 10px frame padding, so it got pushed left. 376 keeps a 12px margin while the
// name column still fits a symbol plus the 24/7 tag.
const POPOVER_WIDTH = 376;
const ROW_MIN_HEIGHT = 62;
// Figma 26230:23591 — the trigger avatar is 32 with a 16 chain badge, which
// is exactly what `Token` renders at size "md". The compact (Trade) trigger
// shares it so the two surfaces read the same.
const TRIGGER_TOKEN_SIZE = 32;
const VALUE_FALLBACK = '--';

const StockTokenVariantPortfolioContext = createContext<
  IMarketAccountPortfolioDisplayItem[] | undefined
>(undefined);

// Variants whose balance this payload actually established. Anything outside
// it is unknown — no account, the first fetch still in flight, a request that
// failed with nothing cached, or a variant the standing result never covered
// because the page has since switched stocks.
const StockTokenVariantResolvedContext = createContext<Set<string>>(
  new Set<string>(),
);

const ISSUER_LABELS: Record<string, string> = {
  // cspell:disable-next-line
  bstocks: 'bStocks',
  coingecko: 'Ondo',
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
  isBalanceResolved,
  portfolioData,
  variant,
  isPortfolioScope,
}: {
  isBalanceResolved: boolean;
  portfolioData?: IMarketAccountPortfolioDisplayItem[];
  variant: IMarketStockTokenVariant;
  isPortfolioScope: boolean;
}) {
  const position = portfolioData?.find((item) => {
    if (item.tokenId) {
      return item.tokenId === variant.tokenId;
    }
    if (item.networkId) {
      return (
        item.networkId === variant.networkId &&
        equalTokenNoCaseSensitive({
          token1: variant,
          token2: {
            networkId: item.networkId,
            contractAddress: item.tokenAddress,
          },
        })
      );
    }
    return (
      isPortfolioScope &&
      equalTokenNoCaseSensitive({
        token1: variant,
        token2: {
          networkId: variant.networkId,
          contractAddress: item.tokenAddress,
        },
      })
    );
  });
  // Once the lookup is known to have run, no position means the account holds
  // none of it, which is a zero balance rather than missing information. An
  // amount that fails to parse still falls back — that is corrupt data, and
  // reading it as zero would state something the payload never said.
  if (!position) {
    return isBalanceResolved ? '0' : undefined;
  }
  const balance = new BigNumber(position.amount ?? '');
  return balance.isFinite() ? balance.toFixed() : undefined;
}

function StockTokenVariantRow({
  index,
  variant,
  selected,
  isPortfolioScope,
  portfolioData,
  onSelect,
  compact = false,
}: {
  index: number;
  variant: IMarketStockTokenVariant;
  selected: boolean;
  isPortfolioScope: boolean;
  portfolioData?: IMarketAccountPortfolioDisplayItem[];
  onSelect: (variant: IMarketStockTokenVariant) => void;
  compact?: boolean;
}) {
  const resolvedVariantKeys = useContext(StockTokenVariantResolvedContext);
  const balance = findVariantBalance({
    isBalanceResolved: resolvedVariantKeys.has(
      getStockPortfolioVariantKey(variant),
    ),
    portfolioData,
    variant,
    isPortfolioScope,
  });
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
        placeholder={<Stack width="100%" height="100%" />}
      />

      <YStack
        flex={compact ? 1 : NAME_COLUMN_FLEX}
        flexBasis={0}
        minWidth={0}
        gap="$0.5"
      >
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

      <XStack
        flex={ISSUER_COLUMN_FLEX}
        flexBasis={0}
        minWidth={0}
        alignItems="center"
        gap="$1"
      >
        <Token size="xxs" tokenImageUri={variant.issuerLogoUrl} />
        <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
          {getIssuerLabel(variant.issuer)}
        </SizableText>
      </XStack>

      <XStack
        flex={compact ? 1 : PRICE_COLUMN_FLEX}
        flexBasis={0}
        minWidth={0}
        alignItems="center"
      >
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

function StockTokenVariantSelectorContent({
  closePopover,
  onSelect,
  sortByBalance,
  compact = false,
}: {
  closePopover: () => void;
  onSelect?: (variant: IMarketStockTokenVariant) => Promise<boolean>;
  sortByBalance?: boolean;
  compact?: boolean;
}) {
  const intl = useIntl();
  const portfolioData = useContext(StockTokenVariantPortfolioContext);
  const { md } = useMedia();
  const compactColumns = compact && md;
  const {
    tokenVariants,
    selectedTokenId,
    selectedTokenVariant,
    setSelectedTokenId,
    portfolioNetworkId,
  } = useStockDetail();
  const portfolioScopeTokenId = useMemo(() => {
    if (!portfolioNetworkId || !selectedTokenVariant?.networkId) {
      return undefined;
    }
    return selectedTokenVariant.networkId === portfolioNetworkId
      ? selectedTokenVariant.tokenId
      : undefined;
  }, [portfolioNetworkId, selectedTokenVariant]);
  const orderedVariants = useMemo(() => {
    if (!sortByBalance) return tokenVariants;
    const balanceOf = (variant: IMarketStockTokenVariant) =>
      new BigNumber(
        findVariantBalance({
          isBalanceResolved: false,
          portfolioData,
          variant,
          isPortfolioScope: variant.tokenId === portfolioScopeTokenId,
        }) ?? 0,
      );
    return [...tokenVariants].toSorted(
      (a, b) => balanceOf(b).comparedTo(balanceOf(a)) ?? 0,
    );
  }, [portfolioData, portfolioScopeTokenId, sortByBalance, tokenVariants]);

  return (
    <YStack
      testID="stock-token-variant-selector-content"
      width={md ? '100%' : POPOVER_WIDTH}
      py="$1"
      px={compact ? '$2' : '$1'}
    >
      <XStack px="$2.5" py="$2" gap="$3" alignItems="center">
        <SizableText
          flex={compactColumns ? 1 : NAME_COLUMN_FLEX}
          flexBasis={0}
          minWidth={0}
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {`${intl.formatMessage({
            id: compact
              ? ETranslations.perp_relay_token__title
              : ETranslations.dexmarket_token_name,
          })}/${intl.formatMessage({ id: ETranslations.global_balance })}`}
        </SizableText>
        <Stack
          width={AVATAR_SLOT_WIDTH}
          height={HEADER_SPACER_HEIGHT}
          pointerEvents="none"
        />
        <SizableText
          flex={ISSUER_COLUMN_FLEX}
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
        {compact ? (
          <Stack
            flex={compactColumns ? 1 : PRICE_COLUMN_FLEX}
            flexBasis={0}
            minWidth={0}
            alignItems="flex-start"
          >
            <DashText
              size="$bodySmMedium"
              color="$textSubdued"
              numberOfLines={1}
              dashOverlay
              tooltip={intl.formatMessage({
                id: ETranslations.market_token_price_onchain_tooltip,
              })}
            >
              {intl.formatMessage({ id: ETranslations.market_token_price })}
            </DashText>
          </Stack>
        ) : (
          <SizableText
            flex={PRICE_COLUMN_FLEX}
            flexBasis={0}
            minWidth={0}
            size="$bodySmMedium"
            color="$textSubdued"
            numberOfLines={1}
          >
            {intl.formatMessage({ id: ETranslations.global_price })}
          </SizableText>
        )}
      </XStack>
      <ScrollView maxHeight={360} showsVerticalScrollIndicator={false}>
        {orderedVariants.map((variant, index) => (
          <StockTokenVariantRow
            key={variant.tokenId}
            index={index}
            compact={compactColumns}
            variant={variant}
            selected={variant.tokenId === selectedTokenId}
            isPortfolioScope={variant.tokenId === portfolioScopeTokenId}
            portfolioData={portfolioData}
            onSelect={(item) => {
              if (onSelect) {
                void onSelect(item);
              } else {
                setSelectedTokenId(item.tokenId);
              }
              closePopover();
            }}
          />
        ))}
      </ScrollView>
    </YStack>
  );
}

export function StockTokenVariantSelector({
  portfolioData,
  resolvedVariantKeys,
  fallbackToken,
  forceLoading = false,
  onSelect,
  compact = false,
  onOpenChange,
}: {
  portfolioData?: IMarketAccountPortfolioDisplayItem[];
  resolvedVariantKeys?: string[];
  fallbackToken?: Pick<ISwapToken, 'logoURI' | 'symbol' | 'stock'>;
  forceLoading?: boolean;
  onSelect?: (variant: IMarketStockTokenVariant) => Promise<boolean>;
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const intl = useIntl();
  const {
    tokenVariants,
    isTokenVariantsLoading,
    isTokenVariantPending,
    selectedTokenId,
    selectedTokenVariant,
    isTokenVariantsError,
    retryTokenVariants,
  } = useStockDetail();

  const selectedIndex = useMemo(
    () => tokenVariants.findIndex((item) => item.tokenId === selectedTokenId),
    [selectedTokenId, tokenVariants],
  );
  // Empty when the caller supplies nothing: that is no evidence the balances
  // were read, so the rows fall back rather than claim a zero.
  const resolvedKeySet = useMemo(
    () => new Set(resolvedVariantKeys ?? []),
    [resolvedVariantKeys],
  );
  const [nativeSheetClosing, setNativeSheetClosing] = useState(false);
  const lastSelectedVariantRef = useRef(selectedTokenVariant);
  if (selectedTokenVariant)
    lastSelectedVariantRef.current = selectedTokenVariant;
  // Keep the native sheet mounted until its exit animation finishes. Replacing
  // the trigger with a skeleton while it closes would unmount the sheet.
  const preserveClosingSheet = Boolean(
    compact &&
    platformEnv.isNative &&
    nativeSheetClosing &&
    lastSelectedVariantRef.current,
  );
  const renderedSelectedVariant =
    selectedTokenVariant ??
    (preserveClosingSheet ? lastSelectedVariantRef.current : undefined);
  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) => (
      <StockTokenVariantSelectorContent
        closePopover={closePopover}
        onSelect={onSelect}
        sortByBalance={compact}
        compact={compact}
      />
    ),
    [compact, onSelect],
  );

  if ((forceLoading && !preserveClosingSheet) || !renderedSelectedVariant) {
    if (forceLoading || isTokenVariantPending || isTokenVariantsLoading) {
      if (compact) {
        return (
          <XStack
            testID="stock-token-variant-selector-loading"
            alignItems="center"
            gap="$2.5"
          >
            <Skeleton
              width={TRIGGER_TOKEN_SIZE}
              height={TRIGGER_TOKEN_SIZE}
              radius="round"
            />
            <XStack alignItems="center" gap="$2">
              <Skeleton width={56} height={24} />
              <Stack width={18} height={18} />
            </XStack>
          </XStack>
        );
      }
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
    if (compact && fallbackToken) {
      const fallbackIssuer = fallbackToken.stock?.source?.trim();
      return (
        <XStack
          testID="stock-token-variant-selector-fallback"
          alignItems="center"
          gap="$2.5"
        >
          <Token
            size="md"
            tokenImageUri={fallbackToken.logoURI}
            placeholder={<Stack width="100%" height="100%" />}
          />
          <YStack justifyContent="center" minWidth={0}>
            <SizableText size="$headingMd" numberOfLines={1}>
              {fallbackToken.symbol || VALUE_FALLBACK}
            </SizableText>
            {/* The resolved trigger always carries the issuer line, so this
                branch has to reserve it too: with only the symbol the row is
                one line shorter and grows when the variant lands. The token's
                embedded stock metadata already knows the issuer. */}
            {fallbackIssuer ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {intl.formatMessage(
                  { id: ETranslations.market_issued_by },
                  { issuer: getIssuerLabel(fallbackIssuer) },
                )}
              </SizableText>
            ) : (
              <Stack height="$4" />
            )}
          </YStack>
        </XStack>
      );
    }
    return null;
  }

  const SelectorPopover = compact ? StockSelectorPopover : Popover;
  const popover = (
    <SelectorPopover
      onOpenChange={(open) => {
        if (compact && platformEnv.isNative) setNativeSheetClosing(!open);
        onOpenChange?.(open);
      }}
      sheetProps={
        compact && platformEnv.isNative
          ? {
              onAnimationComplete: ({ open }) => {
                if (!open) setNativeSheetClosing(false);
              },
            }
          : undefined
      }
      title={
        compact
          ? intl.formatMessage({
              id: ETranslations.title_select_stock_tokens,
            })
          : intl.formatMessage({
              id: ETranslations.trade_stocks_token_details,
            })
      }
      placement="bottom-start"
      // Flip above/below when needed, but never swap to end alignment: the
      // panel always opens rightward from the trigger.
      allowFlip={{ flipAlignment: false }}
      floatingPanelProps={{ width: POPOVER_WIDTH }}
      renderTrigger={
        // Figma 26230:23589. The pressable area is tight to its content (32
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
          <Token
            size="md"
            tokenImageUri={renderedSelectedVariant.logoUrl}
            networkImageUri={renderedSelectedVariant.networkLogoUrl}
            showNetworkIcon
            placeholder={<Stack width="100%" height="100%" />}
          />
          <XStack alignItems="center" gap="$2">
            <YStack justifyContent="center" minWidth={0}>
              <SizableText size="$headingMd" numberOfLines={1}>
                {renderedSelectedVariant.symbol ||
                  renderedSelectedVariant.name ||
                  VALUE_FALLBACK}
              </SizableText>
              {/* Figma 26230:23833 — the issuer sits under the symbol so the
                  trigger names who backs the token, not just which one it is.
                  The compact (Trade) trigger shows it too so both surfaces
                  name the issuer the same way. */}
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {intl.formatMessage(
                  { id: ETranslations.market_issued_by },
                  { issuer: getIssuerLabel(renderedSelectedVariant.issuer) },
                )}
              </SizableText>
            </YStack>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4.5"
              color="$iconSubdued"
            />
          </XStack>
        </XStack>
      }
      renderContent={renderContent}
    />
  );

  return (
    <StockTokenVariantPortfolioContext.Provider value={portfolioData}>
      <StockTokenVariantResolvedContext.Provider value={resolvedKeySet}>
        {popover}
      </StockTokenVariantResolvedContext.Provider>
    </StockTokenVariantPortfolioContext.Provider>
  );
}
