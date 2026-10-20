import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { EarnNavigation } from '../../earnUtils';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';
import { parseAprPercentValue } from '../../utils/availableAssetsUtils';
import { AprText } from '../AprText';
import { EarnListEmptyState } from '../EarnListEmptyState';
import { NetworkFilterControl } from '../NetworkFilterControl';

import { findPositionDeposit } from './earnDesktopHome.utils';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopLendingOffer,
  IEarnDesktopPortfolioDeposits,
  IEarnDesktopWalletHolding,
} from './earnDesktopHome.utils';

type ITokenCategory = 'all' | 'stable' | 'nonStable';

const TOKEN_CATEGORIES: { value: ITokenCategory; labelId: ETranslations }[] = [
  { value: 'all', labelId: ETranslations.global_all },
  { value: 'stable', labelId: ETranslations.earn_stable_tokens__action },
  { value: 'nonStable', labelId: ETranslations.earn_non_stable_tokens__action },
];

// The header, the token rows and the offers under an open row share one
// column layout, so an offer's TVL and APR sit under the token's numbers
const ROW_GAP = '$3';
// Every row is as tall as one with a "Deposited" line, so the list keeps one
// rhythm whichever tokens hold deposits
const ROW_HEIGHT = 56;
const column = (
  flex: number,
  align: 'flex-start' | 'flex-end' = 'flex-start',
  minWidth = 0,
) => ({
  flexGrow: flex,
  flexShrink: 1,
  flexBasis: 0,
  minWidth,
  ai: align,
});
const COLUMNS = {
  asset: column(3),
  network: column(1.4),
  balance: column(1.4, 'flex-end'),
  // Wide enough for a range like "14.78% - 15.87%" on one line
  apr: column(1.4, 'flex-end', 136),
};
const SEARCH_BAR_CONTAINER_PROPS = {
  w: 220,
  borderRadius: '$full' as const,
  bg: '$bgStrong' as const,
  borderColor: '$transparent' as const,
  overflow: 'hidden' as const,
};

type IEarnTableRow = {
  key: string;
  asset: IEarnAvailableAsset;
  isFixedRate: boolean;
  networkIds: string[];
  depositedFiatValue: number;
  /** What the wallet holds of the token over every network; undefined if none */
  balance?: string;
  /** That balance's value in USD, shown in the display currency */
  balanceFiatValueUsd?: string;
  tvl: number;
};

export type IEarnDesktopFocusRequest = { symbol: string; nonce: number };

// The protocols page's rule: the server category, else Pendle means fixed rate
const isFixedRateProtocol = (item: IStakeProtocolListItem) => {
  const category = item.provider.category?.trim();
  if (category === 'fixedRate' || category === 'simpleEarn') {
    return category === 'fixedRate';
  }
  return earnUtils.isPendleProvider({ providerName: item.provider.name });
};

const shouldSendVault = (providerName: string) =>
  earnUtils.shouldSendEarnProtocolVault({ providerName });

function CategoryPills({
  value,
  onChange,
}: {
  value: ITokenCategory;
  onChange: (value: ITokenCategory) => void;
}) {
  const intl = useIntl();
  return (
    <XStack gap="$2">
      {TOKEN_CATEGORIES.map((category) => {
        const isFocused = category.value === value;
        return (
          <XStack
            key={category.value}
            role="button"
            aria-pressed={isFocused}
            px="$3"
            py="$1.5"
            bg={isFocused ? '$bgActive' : '$bgSubdued'}
            borderRadius="$full"
            cursor="pointer"
            userSelect="none"
            hoverStyle={isFocused ? undefined : { bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={() => onChange(category.value)}
            {...buildKeyboardPressProps(() => onChange(category.value), 2)}
          >
            <SizableText
              size="$bodyMdMedium"
              color={isFocused ? '$text' : '$textSubdued'}
            >
              {intl.formatMessage({ id: category.labelId })}
            </SizableText>
          </XStack>
        );
      })}
    </XStack>
  );
}

function HeaderLabel({
  children,
  align,
}: {
  children: string;
  align?: 'right';
}) {
  return (
    <SizableText
      size="$bodySmMedium"
      color="$textSubdued"
      textAlign={align}
      numberOfLines={1}
    >
      {children}
    </SizableText>
  );
}

type IOfferRow =
  | { kind: 'protocol'; key: string; apr: number; item: IStakeProtocolListItem }
  | {
      kind: 'lending';
      key: string;
      apr: number;
      offer: IEarnDesktopLendingOffer;
    };

function OfferRowFrame({
  children,
  onPress,
  testID,
}: {
  children: ReactNode;
  onPress: () => void;
  testID?: string;
}) {
  // Opaque card steps rather than a translucent wash, so the network badges'
  // rings take the row's color as it changes
  const { surface, isActive, handlers } = usePressableSurface(true);
  return (
    <EarnDesktopSurfaceProvider value={surface}>
      <XStack
        testID={testID}
        role="button"
        ai="center"
        gap={ROW_GAP}
        minHeight={ROW_HEIGHT}
        px="$3"
        mx="$-3"
        borderRadius="$3"
        borderCurve="continuous"
        bg={isActive ? surface : undefined}
        cursor="pointer"
        userSelect="none"
        onPress={onPress}
        {...handlers}
        {...buildKeyboardPressProps(onPress)}
      >
        {children}
      </XStack>
    </EarnDesktopSurfaceProvider>
  );
}

// The token row's deposit line, for an offer holding part of it
function DepositedLine({ value }: { value: number }) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  return (
    <XStack ai="center" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.earn_deposited })}
      </SizableText>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodySmMedium"
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
      >
        {value}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

function TokenOffers({
  row,
  lendingOffers,
  deposits,
}: {
  row: IEarnTableRow;
  lendingOffers?: IEarnDesktopLendingOffer[];
  deposits: IEarnDesktopPortfolioDeposits;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const indexedAccountId = activeAccount.indexedAccount?.id;
  const accountNetworkId = activeAccount.network?.id;
  const { asset, isFixedRate } = row;

  const { result: protocols, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolList({
        symbol: asset.symbol,
        accountId,
        networkId: accountNetworkId,
        includeWithdrawOnly: true,
      }),
    [accountId, accountNetworkId, asset.symbol],
    { watchLoading: true, undefinedResultIfError: true },
  );

  const offers = useMemo<IOfferRow[]>(() => {
    const protocolRows: IOfferRow[] = (protocols ?? [])
      .filter((item) => isFixedRateProtocol(item) === isFixedRate)
      .map((item) => ({
        kind: 'protocol',
        key: `${item.network.networkId}-${item.provider.name}-${item.provider.vault ?? ''}`,
        apr: parseAprPercentValue(item.provider.aprWithoutFee),
        item,
      }));
    // A market the protocol list already carries (Kamino USDC has a staking
    // config) must not be listed twice
    const listed = new Set(
      (protocols ?? []).map(
        (item) =>
          `${(normalizeToEarnProvider(item.provider.name) ?? item.provider.name).toLowerCase()}:${item.network.networkId}`,
      ),
    );
    const lendingRows: IOfferRow[] = isFixedRate
      ? []
      : (lendingOffers ?? [])
          .filter(
            (offer) =>
              !listed.has(
                `${offer.market.provider.toLowerCase()}:${offer.market.networkId}`,
              ),
          )
          .map((offer) => ({
            kind: 'lending',
            key: offer.key,
            apr: parseAprPercentValue(offer.apy),
            offer,
          }));
    return [...protocolRows, ...lendingRows].toSorted((a, b) => b.apr - a.apr);
  }, [isFixedRate, lendingOffers, protocols]);

  const handleProtocolPress = useCallback(
    (item: IStakeProtocolListItem) => {
      const vault = shouldSendVault(item.provider.name)
        ? item.provider.vault
        : undefined;
      if (
        item.aprInfo?.button?.type === 'redeem' &&
        !item.aprInfo?.button?.disabled
      ) {
        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ManagePosition,
          params: {
            networkId: item.network.networkId,
            symbol: asset.symbol,
            provider: item.provider.name,
            vault,
            tab: 'withdraw',
          },
        });
        return;
      }
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId: item.network.networkId,
        symbol: asset.symbol,
        provider: item.provider.name,
        vault,
        logoURI: asset.logoURI,
      });
    },
    [asset.logoURI, asset.symbol, navigation],
  );

  const handleLendingPress = useCallback(
    (offer: IEarnDesktopLendingOffer) => {
      BorrowNavigation.pushToBorrowReserveDetails(navigation, {
        networkId: offer.market.networkId,
        provider: offer.market.provider,
        marketAddress: offer.market.marketAddress,
        reserveAddress: offer.reserveAddress,
        symbol: offer.symbol,
        logoURI: offer.logoURI,
        accountId,
        indexedAccountId,
      });
    },
    [accountId, indexedAccountId, navigation],
  );

  if (isLoading && !protocols) {
    return (
      <YStack>
        {Array.from({ length: 2 }).map((_, index) => (
          <XStack key={index} ai="center" gap="$3" h={ROW_HEIGHT}>
            <Skeleton w="$8" h="$8" radius="round" />
            <Skeleton w={160} h={16} borderRadius="$2" />
          </XStack>
        ))}
      </YStack>
    );
  }

  // A list that failed or came back empty says so instead of a bare header
  if (!offers.length) {
    return (
      <XStack h={ROW_HEIGHT} ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </XStack>
    );
  }

  return (
    <YStack>
      <XStack h="$8" ai="center" gap={ROW_GAP}>
        <Stack {...COLUMNS.asset}>
          <HeaderLabel>
            {intl.formatMessage({ id: ETranslations.global_protocol })}
          </HeaderLabel>
        </Stack>
        <Stack {...COLUMNS.network} />
        <Stack {...COLUMNS.balance}>
          <HeaderLabel align="right">
            {intl.formatMessage({ id: ETranslations.earn_tvl })}
          </HeaderLabel>
        </Stack>
        <Stack {...COLUMNS.apr}>
          <HeaderLabel align="right">
            {intl.formatMessage({ id: ETranslations.defi_apr_apy })}
          </HeaderLabel>
        </Stack>
        <Stack w="$5" />
      </XStack>
      {offers.map((offer) => {
        if (offer.kind === 'lending') {
          const { offer: lending } = offer;
          return (
            <OfferRowFrame
              key={offer.key}
              testID={`earn-desktop-offer-${lending.key}`}
              onPress={() => handleLendingPress(lending)}
            >
              <XStack {...COLUMNS.asset} ai="center" gap="$3">
                <SurfaceToken
                  size="md"
                  borderRadius="$2"
                  tokenImageUri={lending.market.logoURI}
                  networkId={lending.market.networkId}
                />
                <YStack flex={1} minWidth={0}>
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {lending.marketLabel}
                  </SizableText>
                  {lending.depositedFiatValue ? (
                    <DepositedLine value={lending.depositedFiatValue} />
                  ) : null}
                </YStack>
              </XStack>
              <Stack {...COLUMNS.network} />
              <Stack {...COLUMNS.balance}>
                <SizableText size="$bodyLg" numberOfLines={1}>
                  {lending.tvlText ?? '-'}
                </SizableText>
              </Stack>
              <Stack {...COLUMNS.apr}>
                <SizableText size="$bodyLgMedium">
                  {`${new BigNumber(lending.apy).toFixed(2)}%`}
                </SizableText>
              </Stack>
              <Stack w="$5" />
            </OfferRowFrame>
          );
        }
        const { item } = offer;
        const providerName =
          normalizeToEarnProvider(item.provider.name) ?? item.provider.name;
        const isRedeem = item.aprInfo?.button?.type === 'redeem';
        // Which offer holds the token's deposit
        const deposited = findPositionDeposit(deposits, {
          provider: item.provider.name,
          networkId: item.network.networkId,
          symbol: asset.symbol,
          vault: item.provider.vault,
        });
        return (
          <OfferRowFrame
            key={offer.key}
            testID={`earn-desktop-offer-${offer.key}`}
            onPress={() => handleProtocolPress(item)}
          >
            <XStack {...COLUMNS.asset} ai="center" gap="$3">
              <SurfaceToken
                size="md"
                borderRadius="$2"
                tokenImageUri={item.provider.logoURI}
                networkId={item.network.networkId}
              />
              <YStack flex={1} minWidth={0}>
                <XStack ai="center" gap="$2" minWidth={0}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    flexShrink={1}
                  >
                    {isFixedRate
                      ? item.provider.maturity ||
                        item.provider.vaultName ||
                        providerName
                      : providerName}
                  </SizableText>
                  {item.provider.badges?.map((badge) => (
                    <Badge
                      key={badge.tag}
                      badgeType={badge.badgeType}
                      badgeSize="sm"
                    >
                      <Badge.Text>{badge.tag}</Badge.Text>
                    </Badge>
                  ))}
                </XStack>
                {deposited ? <DepositedLine value={deposited} /> : null}
                {!deposited && item.provider.vaultName && !isFixedRate ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {item.provider.vaultName}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
            <Stack {...COLUMNS.network} />
            <Stack {...COLUMNS.balance}>
              <EarnText size="$bodyLg" numberOfLines={1} text={item.tvl} />
            </Stack>
            <Stack {...COLUMNS.apr}>
              {isRedeem ? (
                <SizableText size="$bodyLgMedium" color="$textInfo">
                  {item.aprInfo?.button?.text?.text ||
                    intl.formatMessage({ id: ETranslations.defi_redeemable })}
                </SizableText>
              ) : (
                <AprText
                  hideSuffix
                  asset={{
                    aprWithoutFee: item.provider.aprWithoutFee ?? '',
                    aprInfo: item.aprInfo,
                    rewardUnit: item.provider.rewardUnit,
                  }}
                />
              )}
            </Stack>
            <Stack w="$5" />
          </OfferRowFrame>
        );
      })}
    </YStack>
  );
}

function TokenRow({
  row,
  isOpen,
  onToggle,
  lendingOffers,
  deposits,
}: {
  row: IEarnTableRow;
  isOpen: boolean;
  onToggle: (key: string) => void;
  lendingOffers?: IEarnDesktopLendingOffer[];
  deposits: IEarnDesktopPortfolioDeposits;
}) {
  const intl = useIntl();
  const surfaces = useEarnDesktopSurfaces();
  const { asset } = row;
  const handleToggle = () => onToggle(row.key);
  return (
    // An open token and its offers read as one card
    <YStack
      mx="$2"
      borderRadius="$4"
      borderCurve="continuous"
      bg={isOpen ? surfaces.rest : undefined}
    >
      <ListItem
        testID={`earn-desktop-row-${row.key}`}
        role="button"
        aria-expanded={isOpen}
        mx="$0"
        minHeight={ROW_HEIGHT}
        gap={ROW_GAP}
        userSelect="none"
        onPress={handleToggle}
        {...buildKeyboardPressProps(handleToggle)}
      >
        <XStack {...COLUMNS.asset} ai="center" gap="$3">
          <Token size="md" tokenImageUri={asset.logoURI} borderRadius="$full" />
          <YStack flex={1} minWidth={0}>
            <XStack ai="center" gap="$2" minWidth={0}>
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {earnUtils.getDisplaySymbol(asset)}
              </SizableText>
              {asset.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))}
            </XStack>
            {/* Fixed rate reads as the token's second line rather than a
                pill after its name, so the names keep one straight edge.
                Fixed-rate rows never show a deposit, so the line is free */}
            {row.isFixedRate ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
              </SizableText>
            ) : null}
            {row.depositedFiatValue > 0 && !row.isFixedRate ? (
              <DepositedLine value={row.depositedFiatValue} />
            ) : null}
          </YStack>
        </XStack>
        <Stack {...COLUMNS.network}>
          <NetworkAvatarGroup
            networkIds={row.networkIds}
            size="$5"
            variant="spread"
            maxVisible={3}
          />
        </Stack>
        <Stack {...COLUMNS.balance}>
          {/* Empty when there's nothing to deposit, whether the balance is 0
              or unknown: a dash on most rows would say nothing */}
          {new BigNumber(row.balance ?? 0).gt(0) ? (
            // The amount over its value, as the Borrow page's Assets to
            // Supply shows a wallet balance
            <YStack ai="flex-end">
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyLgMedium"
                formatter="balance"
              >
                {row.balance}
              </NumberSizeableTextWrapper>
              <Currency
                hideValue
                size="$bodySm"
                color="$textSubdued"
                formatter="value"
                sourceCurrency={USD_CURRENCY_ID}
              >
                {row.balanceFiatValueUsd}
              </Currency>
            </YStack>
          ) : null}
        </Stack>
        <Stack {...COLUMNS.apr}>
          <AprText asset={asset} hideSuffix />
        </Stack>
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$5"
          color="$iconSubdued"
          flexShrink={0}
        />
      </ListItem>
      {isOpen ? (
        <YStack px="$3" pb="$2">
          <TokenOffers
            row={row}
            lendingOffers={lendingOffers}
            deposits={deposits}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

export function EarnDesktopEarnTab({
  trendingAssets,
  fixedRateAssets,
  isAssetsLoading,
  deposits,
  lendingOffers,
  walletHoldings,
  focusRequest,
  onFocusRequestHandled,
}: {
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  isAssetsLoading: boolean;
  deposits: IEarnDesktopPortfolioDeposits;
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  walletHoldings: Map<string, IEarnDesktopWalletHolding>;
  focusRequest?: IEarnDesktopFocusRequest;
  onFocusRequestHandled?: () => void;
}) {
  const intl = useIntl();
  const [category, setCategory] = useState<ITokenCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string>();

  const { result: stableAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.StableCoins,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const stableSymbols = useMemo(
    () => new Set((stableAssets ?? []).map((asset) => asset.symbol)),
    [stableAssets],
  );
  const { providers: aggregatedProviders } = useEarnAllProtocols();
  const symbolTvl = useMemo(() => {
    const map = new Map<string, number>();
    aggregatedProviders.forEach((aggregated) => {
      aggregated.tokens.forEach((token) => {
        const key = token.symbol.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + token.tvlValue);
      });
    });
    return map;
  }, [aggregatedProviders]);

  // Each token's portfolio principal, read per asset (a provider's positions
  // arrive merged under its first token), plus its lending supply
  const depositedBySymbol = useMemo(() => {
    const map = new Map(deposits.byToken);
    lendingOffers.forEach((offers) =>
      offers.forEach((offer) => {
        if (offer.depositedFiatValue) {
          const key = offer.symbol.toLowerCase();
          map.set(key, (map.get(key) ?? 0) + offer.depositedFiatValue);
        }
      }),
    );
    return map;
  }, [deposits, lendingOffers]);

  const allRows = useMemo<IEarnTableRow[]>(() => {
    const build = (asset: IEarnAvailableAsset, isFixedRate: boolean) => {
      const symbolKey = asset.symbol.toLowerCase();
      const lendingNetworks = isFixedRate
        ? []
        : (lendingOffers.get(symbolKey) ?? []).map(
            (offer) => offer.market.networkId,
          );
      return {
        key: `${isFixedRate ? 'fixed' : 'earn'}:${asset.symbol}`,
        asset,
        isFixedRate,
        networkIds: Array.from(
          new Set([
            ...asset.protocols.map((protocol) => protocol.networkId),
            ...lendingNetworks,
          ]),
        ),
        depositedFiatValue: depositedBySymbol.get(symbolKey) ?? 0,
        balance: walletHoldings.get(symbolKey)?.amount,
        balanceFiatValueUsd: walletHoldings.get(symbolKey)?.fiatValueUsd,
        tvl: symbolTvl.get(symbolKey) ?? 0,
      };
    };
    const rows = [
      ...trendingAssets.map((asset) => build(asset, false)),
      ...fixedRateAssets.map((asset) => build(asset, true)),
    ];
    const isOwned = (row: IEarnTableRow) =>
      row.depositedFiatValue > 0 || new BigNumber(row.balance ?? 0).gt(0);
    // Tokens you hold or have deposited first, then by TVL, as the phone sorts
    return rows.toSorted((a, b) => {
      const ownedA = isOwned(a);
      const ownedB = isOwned(b);
      if (ownedA !== ownedB) {
        return ownedA ? -1 : 1;
      }
      if (ownedA && a.depositedFiatValue !== b.depositedFiatValue) {
        return b.depositedFiatValue - a.depositedFiatValue;
      }
      return b.tvl - a.tvl;
    });
  }, [
    depositedBySymbol,
    fixedRateAssets,
    lendingOffers,
    symbolTvl,
    trendingAssets,
    walletHoldings,
  ]);

  const categoryRows = useMemo(() => {
    if (category === 'stable') {
      return allRows.filter((row) => stableSymbols.has(row.asset.symbol));
    }
    if (category === 'nonStable') {
      return allRows.filter((row) => !stableSymbols.has(row.asset.symbol));
    }
    return allRows;
  }, [allRows, category, stableSymbols]);

  const { availableNetworkIds, networkAssetCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryRows.forEach((row) => {
      row.networkIds.forEach((networkId) => {
        counts[networkId] = (counts[networkId] ?? 0) + 1;
      });
    });
    return {
      availableNetworkIds: Object.keys(counts),
      networkAssetCounts: counts,
    };
  }, [categoryRows]);

  const rows = useMemo(() => {
    const selected = new Set(selectedNetworkIds);
    const keyword = searchText.trim().toLowerCase();
    return categoryRows.filter((row) => {
      if (
        selected.size > 0 &&
        !row.networkIds.some((networkId) => selected.has(networkId))
      ) {
        return false;
      }
      if (
        keyword &&
        !earnUtils.matchesSymbolKeyword(row.asset, keyword) &&
        !row.asset.name?.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      return true;
    });
  }, [categoryRows, searchText, selectedNetworkIds]);

  // A row in the wallet tile opens its token here
  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    setCategory('all');
    setSearchText('');
    setSelectedNetworkIds([]);
    setOpenKey(`earn:${focusRequest.symbol}`);
    onFocusRequestHandled?.();
  }, [focusRequest, onFocusRequestHandled]);

  const handleToggle = useCallback((key: string) => {
    setOpenKey((current) => (current === key ? undefined : key));
  }, []);

  const isFiltered = Boolean(
    searchText.trim() || selectedNetworkIds.length || category !== 'all',
  );
  const isEmpty = !isAssetsLoading && !rows.length;

  return (
    <YStack gap="$4">
      <XStack ai="center" jc="space-between" gap="$4" flexWrap="wrap">
        <CategoryPills value={category} onChange={setCategory} />
        <XStack ai="center" gap="$3">
          <NetworkFilterControl
            availableNetworkIds={availableNetworkIds}
            selectedNetworkIds={selectedNetworkIds}
            networkAssetCounts={networkAssetCounts}
            onSelectionChange={setSelectedNetworkIds}
          />
          <SearchBar
            testID={EarnTestIDs.assetSearchInput}
            size="small"
            value={searchText}
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            onChangeText={setSearchText}
            containerProps={SEARCH_BAR_CONTAINER_PROPS}
          />
        </XStack>
      </XStack>
      {isEmpty ? (
        <EarnListEmptyState isFiltered={isFiltered} />
      ) : (
        <YStack mx="$-5">
          <ListItem gap={ROW_GAP} minHeight="$8">
            <Stack {...COLUMNS.asset}>
              <HeaderLabel>
                {intl.formatMessage({ id: ETranslations.global_asset })}
              </HeaderLabel>
            </Stack>
            <Stack {...COLUMNS.network}>
              <HeaderLabel>
                {intl.formatMessage({ id: ETranslations.global_network })}
              </HeaderLabel>
            </Stack>
            <Stack {...COLUMNS.balance}>
              <HeaderLabel align="right">
                {intl.formatMessage({
                  id: ETranslations.global_wallet_balance,
                })}
              </HeaderLabel>
            </Stack>
            <Stack {...COLUMNS.apr}>
              <HeaderLabel align="right">
                {intl.formatMessage({ id: ETranslations.defi_apr_apy })}
              </HeaderLabel>
            </Stack>
            <Stack w="$5" />
          </ListItem>
          {isAssetsLoading && !rows.length
            ? Array.from({ length: 6 }).map((_, index) => (
                <ListItem key={index} minHeight={ROW_HEIGHT} gap={ROW_GAP}>
                  <XStack {...COLUMNS.asset} ai="center" gap="$3">
                    <Skeleton w="$8" h="$8" radius="round" />
                    <Skeleton w={96} h={18} borderRadius="$2" />
                  </XStack>
                  <Stack {...COLUMNS.network}>
                    <Skeleton w={64} h={18} borderRadius="$2" />
                  </Stack>
                  <Stack {...column(2.8, 'flex-end')}>
                    <Skeleton w={96} h={18} borderRadius="$2" />
                  </Stack>
                  <Stack w="$5" />
                </ListItem>
              ))
            : rows.map((row) => (
                <TokenRow
                  key={row.key}
                  row={row}
                  isOpen={row.key === openKey}
                  onToggle={handleToggle}
                  lendingOffers={lendingOffers.get(
                    row.asset.symbol.toLowerCase(),
                  )}
                  deposits={deposits}
                />
              ))}
        </YStack>
      )}
    </YStack>
  );
}
