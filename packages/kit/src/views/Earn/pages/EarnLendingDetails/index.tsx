import { Fragment, memo, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  IconButton,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EJotaiContextStoreNames,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IBorrowReserveDetail,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { useBorrowMarkets } from '../../../Borrow/hooks/useBorrowMarkets';
import { PlatformBonusSection } from '../../../Borrow/pages/ReserveDetails/components/PlatformBonusSection';
import { RiskSection } from '../../../Borrow/pages/ReserveDetails/components/RiskSection';
import {
  useBorrowApyHistory,
  useBorrowBadges,
} from '../../../Borrow/pages/ReserveDetails/hooks/useBorrowChartData';
import { useBorrowReserveDetailData } from '../../../Borrow/pages/ReserveDetails/hooks/useBorrowReserveDetailData';
import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../../Staking/components/PageFrame';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '../../../Staking/components/ProtocolDetails/GridItemV2';
import { OverviewSkeleton } from '../../../Staking/components/StakingSkeleton';
import { useEarnAccount } from '../../../Staking/hooks/useEarnAccount';
import {
  type IManagePositionPayWith,
  ManagePositionContent,
} from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { EManagePositionType } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { FAQSection } from '../../../Staking/pages/ProtocolDetailsV2/FAQSection';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import { ApyChart } from '../EarnProtocolDetails/components/ApyChart';
import { StickyFormColumn } from '../EarnProtocolDetails/components/StickyFormColumn';

// A lending market's supply side (Aave, Kamino) as an Earn details page,
// built like a vault's: the same frame, header, chart, grid and form column,
// its figures from the market's reserve. Borrowing has its own place (Loans),
// so the reserve's borrow side isn't here

type IRouteParams = ITabEarnParamList[ETabEarnRoutes.EarnLendingDetails];

// The supply rate's history, as far back as a vault page's chart reaches
const CHART_PERIOD = 'year';

function ManagersRow({
  managers,
}: {
  managers: IBorrowReserveDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack gap="$1" alignItems="center">
      {managers.items.map((item, index) => (
        <Fragment key={index}>
          <XStack gap="$1" alignItems="center">
            <Image size="$4" borderRadius="$1" src={item.logoURI} />
            <EarnText text={item.title} size="$bodySm" />
            <EarnText text={item.description} size="$bodySm" />
          </XStack>
          {index !== managers.items.length - 1 ? (
            <XStack w="$4" h="$4" ai="center" jc="center">
              <XStack w="$1" h="$1" borderRadius="$full" bg="$iconSubdued" />
            </XStack>
          ) : null}
        </Fragment>
      ))}
    </XStack>
  ) : null;
}

// A vault page's header: the token, the rate as its headline, share and the
// way to the positions
function LendingHeader({
  symbol,
  logoURI,
  apy,
  onShare,
}: {
  symbol: string;
  logoURI?: string;
  apy: string;
  onShare?: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleMyPortfolio = useCallback(() => {
    if (platformEnv.isNative) {
      EarnNavigation.pushToEarnPositions(navigation);
      return;
    }
    void EarnNavigation.popToEarnHome(navigation, { tab: 'portfolio' });
  }, [navigation]);

  return (
    <YStack gap="$2.5">
      <XStack gap="$2" ai="center" minWidth={0}>
        <Token size="xs" tokenImageUri={logoURI} />
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
      <XStack gap="$2" ai="center">
        <SizableText size="$heading3xl" color="$textSuccess">
          {`${new BigNumber(apy || 0).toFixed(2)}% ${intl.formatMessage({
            id: ETranslations.global_apy,
          })}`}
        </SizableText>
        {onShare ? (
          <IconButton
            testID="earn-lending-share"
            icon="ShareOutline"
            size="small"
            variant="tertiary"
            iconColor="$iconSubdued"
            onPress={onShare}
          />
        ) : null}
        <XStack
          ml="auto"
          cursor="pointer"
          ai="center"
          onPress={handleMyPortfolio}
        >
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.earn_positions })}
          </SizableText>
          <Icon
            size="$bodySmMedium"
            name="ChevronRightSmallOutline"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
    </YStack>
  );
}

// The supply rate drawn as a vault page draws its rate, with the same High
// and Low over it
function LendingChart({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { history, isLoading } = useBorrowApyHistory({
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    action: 'supply',
    timePeriod: CHART_PERIOD,
  });
  const { high, low } = useMemo(() => {
    const values = history
      .map((item) => Number(item.apy))
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return { high: null, low: null };
    }
    return { high: Math.max(...values), low: Math.min(...values) };
  }, [history]);

  // Nothing to draw once the answer is in and empty: no axis, no frame
  if (!isLoading && !history.length) {
    return null;
  }

  return (
    <YStack gap="$3">
      {gtMd && high !== null && low !== null ? (
        <XStack gap="$4" pt="$6">
          <YStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.market_high })}
            </SizableText>
            <SizableText size="$bodyMd" color="$text">
              {high.toFixed(2)}%
            </SizableText>
          </YStack>
          <YStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.market_low })}
            </SizableText>
            <SizableText size="$bodyMd" color="$text">
              {low.toFixed(2)}%
            </SizableText>
          </YStack>
        </XStack>
      ) : null}
      <ApyChart
        apyHistory={isLoading ? undefined : history}
        primaryApyLabel={intl.formatMessage({
          id: ETranslations.defi_supply_apy,
        })}
      />
    </YStack>
  );
}

type ILendingGridItem = {
  key: string;
  title: IEarnText;
  description?: IEarnText;
  tooltip?: IEarnTooltip;
  // A logo before the value (the network, the market)
  logoURI?: string;
};

// A vault page's grid section: its title, the figures three to a row, then
// a rule
function LendingGridSection({
  title,
  titleAfter,
  items,
}: {
  title: string;
  titleAfter?: React.ReactNode;
  items: ILendingGridItem[];
}) {
  return (
    <>
      <YStack gap="$6">
        <XStack alignItems="center" gap="$3">
          <SizableText size="$headingLg">{title}</SizableText>
          {titleAfter}
        </XStack>
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {items.map((item) => (
            <GridItem
              key={item.key}
              title={item.title}
              description={item.logoURI ? undefined : item.description}
              descriptionComponent={
                item.logoURI ? (
                  <XStack ai="center" gap="$1.5" flexShrink={1} minWidth={0}>
                    <Token
                      size="xs"
                      borderRadius="$2"
                      mr="$0.5"
                      tokenImageUri={item.logoURI}
                    />
                    {item.description ? (
                      <EarnText
                        text={item.description}
                        size="$bodyLgMedium"
                        flexShrink={1}
                      />
                    ) : null}
                  </XStack>
                ) : null
              }
              tooltip={item.tooltip}
            />
          ))}
        </XStack>
      </YStack>
      <Divider />
    </>
  );
}

const DASH = '-';

function LendingDetailsPartComponent({
  details,
  isLoading,
  onRefresh,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
  marketLabel,
  marketLogoURI,
  onShare,
}: {
  details: IBorrowReserveDetail | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  marketLabel?: string;
  marketLogoURI?: string;
  onShare?: () => void;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { supplyBadge } = useBorrowBadges(details);
  const { result: network } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );
  // The market's own collateral figures, as Aave's reserve page shows them:
  // read with the account, they are its E-Mode's where it has one
  const { result: marketDetails } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking
        .getBorrowReserveDetails({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
        })
        .catch(() => undefined),
    [marketAddress, networkId, provider, reserveAddress],
  );

  // The vault page's Intro: where the money goes, how much is there, how much
  // of it can leave now, and how much more the market takes
  const introItems = useMemo<ILendingGridItem[]>(() => {
    if (!details) {
      return [];
    }
    const fiat = (value?: string) =>
      value ? `${currencyInfo.symbol}${value}` : DASH;
    // Sent with its sign ("80.14%"), as the reserve page's ring reads it
    const usagePercent = parseFloat(details.supply.usage?.percentage ?? '');
    return [
      {
        key: 'network',
        title: {
          text: intl.formatMessage({ id: ETranslations.global_network }),
        },
        description: { text: network?.name ?? DASH },
        logoURI: network?.logoURI,
      },
      {
        key: 'market',
        title: {
          text: intl.formatMessage({ id: ETranslations.global_market }),
        },
        description: { text: marketLabel ?? DASH },
        logoURI: marketLogoURI,
      },
      {
        key: 'tvl',
        title: { text: intl.formatMessage({ id: ETranslations.earn_tvl }) },
        description: { text: fiat(details.reserveSize) },
      },
      {
        key: 'liquidity',
        title: {
          text: intl.formatMessage({ id: ETranslations.global_liquidity }),
        },
        description: { text: fiat(details.liquidity) },
      },
      {
        key: 'utilization',
        title: {
          text: intl.formatMessage({
            id: ETranslations.defi_utilization_ratio,
          }),
        },
        description: { text: details.utilizationRatio || DASH },
      },
      {
        key: 'supply-cap',
        title: {
          text: intl.formatMessage({
            id: ETranslations.defi_supply_cap_usage,
          }),
        },
        description: {
          text: Number.isFinite(usagePercent)
            ? `${usagePercent.toFixed(2)}%`
            : DASH,
        },
        tooltip: details.supply.usage?.tooltip,
      },
    ];
  }, [
    currencyInfo.symbol,
    details,
    intl,
    marketLabel,
    marketLogoURI,
    network?.logoURI,
    network?.name,
  ]);

  // What the supply could back later, only where it can back a loan
  const collateralItems = useMemo<ILendingGridItem[]>(() => {
    if (!details?.supply.canBeCollateral) {
      return [];
    }
    const { maxLtv, liquidationLtv, softLiquidation } =
      marketDetails?.supply ?? details.supply;
    const items: ILendingGridItem[] = [
      {
        key: 'max-ltv',
        title: { text: intl.formatMessage({ id: ETranslations.defi_max_ltv }) },
        description: maxLtv?.text,
        tooltip: maxLtv?.tooltip,
      },
      {
        key: 'liquidation-ltv',
        title: {
          text: intl.formatMessage({ id: ETranslations.defi_liquidation_ltv }),
        },
        description: liquidationLtv?.text,
        tooltip: liquidationLtv?.tooltip,
      },
      {
        key: 'soft-liquidation',
        title: {
          text: intl.formatMessage({
            id: ETranslations.defi_soft_liquidations,
          }),
        },
        description: softLiquidation?.text,
        tooltip: softLiquidation?.tooltip,
      },
    ];
    return items.filter((item) => Boolean(item.description?.text));
  }, [details, intl, marketDetails?.supply]);

  return (
    <YStack flex={6} gap="$5" px="$pagePadding">
      <PageFrame
        LoadingSkeleton={OverviewSkeleton}
        loading={isLoadingState({ result: details, isLoading })}
        error={isErrorState({ result: details, isLoading })}
        onRefresh={onRefresh}
      >
        {details ? (
          <YStack gap="$8">
            <YStack>
              <LendingHeader
                symbol={symbol}
                logoURI={logoURI}
                apy={details.supply.apyDetail.apy}
                onShare={onShare}
              />
              <LendingChart
                networkId={networkId}
                provider={provider}
                marketAddress={marketAddress}
                reserveAddress={reserveAddress}
              />
            </YStack>
            <PlatformBonusSection platformBonus={details.platformBonus} />
            <LendingGridSection
              title={EARN_DESKTOP_DEMO_COPY.intro}
              items={introItems}
            />
            {collateralItems.length ? (
              <LendingGridSection
                title={intl.formatMessage({
                  id: ETranslations.defi_collateral,
                })}
                titleAfter={supplyBadge}
                items={collateralItems}
              />
            ) : null}
            <RiskSection risk={details.risk} />
            <LendingFAQSection
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
            />
          </YStack>
        ) : null}
      </PageFrame>
    </YStack>
  );
}

const LendingDetailsPart = memo(LendingDetailsPartComponent);

// The market's questions in the vault page's FAQ look
function LendingFAQSection({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}) {
  const intl = useIntl();
  const { result: faqData } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking
        .getBorrowFaqList({
          networkId,
          provider,
          marketAddress,
          reserveAddress,
        })
        .catch(() => undefined),
    [marketAddress, networkId, provider, reserveAddress],
  );
  const faqs = useMemo(
    () =>
      faqData?.list?.length
        ? {
            title: {
              text: intl.formatMessage({ id: ETranslations.global_faqs }),
            },
            items: faqData.list.map((item) => ({
              title: { text: item.question },
              description: { text: item.answer },
            })),
          }
        : undefined,
    [faqData?.list, intl],
  );
  return <FAQSection faqs={faqs} />;
}

// A supplied balance the reserve shows as text ("2.903633 USDC")
const hasSuppliedBalance = (details?: IBorrowReserveDetail) => {
  const text = details?.userInfo?.suppliedBalance?.title?.text ?? '';
  const value = new BigNumber(text.replace(/[^\d.]/g, '') || 0);
  return value.isFinite() && value.gt(0);
};

const EarnLendingDetailsPage = () => {
  const route = useAppRoute<
    ITabEarnParamList,
    ETabEarnRoutes.EarnLendingDetails
  >();
  const {
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol: routeSymbol,
    logoURI: routeLogoURI,
    accountId: routeAccountId,
    indexedAccountId: routeIndexedAccountId,
  } = route.params as IRouteParams;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd, gtSm } = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const indexedAccountId =
    routeIndexedAccountId ||
    selectedAccount.indexedAccountId ||
    activeAccount.indexedAccount?.id;

  // The wallet's account on the market's network. The reserve is read with
  // it only once it is known to be one: an EVM account asked for on Solana
  // (Kamino) fails the whole read, where without one the page still shows
  const { earnAccount } = useEarnAccount({
    networkId,
    accountId: routeAccountId || activeAccount.account?.id,
    indexedAccountId,
  });
  const { details, reserveToken, isLoading, refreshData } =
    useBorrowReserveDetailData({
      accountId: earnAccount?.account?.id,
      networkId,
      indexedAccountId,
      provider,
      marketAddress,
      reserveAddress,
      resolveTokenMetadata: !routeLogoURI,
    });
  // Supply goes through the market's own account on this network, as the
  // deposit modal and the Borrow pages pass it; without one the form says
  // the account doesn't support the network
  const accountId =
    earnAccount?.account?.id || routeAccountId || activeAccount.account?.id;
  const formIndexedAccountId =
    earnAccount?.account?.indexedAccountId ?? indexedAccountId;
  const symbol = reserveToken?.symbol || routeSymbol;
  const logoURI = reserveToken?.logoURI || routeLogoURI;

  // The market's name and logo, as the Earn table and the deposit modal show
  // them: Aave Core
  const { markets } = useBorrowMarkets();
  const market = useMemo(() => {
    const key = buildBorrowMarketKey({ provider, networkId, marketAddress });
    return markets?.find((item) => buildBorrowMarketKey(item) === key);
  }, [marketAddress, markets, networkId, provider]);
  const marketLabel = market ? getBorrowMarketLabel(market) : undefined;

  // DeFi › USDC › Aave Core, as a vault's page reads DeFi › USDC › Morpho
  const breadcrumbProps = useMemo(
    () => ({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_earn }),
          onClick: () => {
            void EarnNavigation.popToEarnHome(navigation);
          },
        },
        {
          label: symbol,
          onClick: () => {
            // On web the desktop home lists every offer for the token, the
            // lending markets with them, under its row
            if (!platformEnv.isNative) {
              void EarnNavigation.popToEarnHome(navigation, {
                openSymbol: symbol,
              });
              return;
            }
            EarnNavigation.pushToEarnProtocols(navigation, {
              symbol,
              logoURI: logoURI ? encodeURIComponent(logoURI) : undefined,
            });
          },
        },
        { label: marketLabel || provider },
      ],
    }),
    [intl, logoURI, marketLabel, navigation, provider, symbol],
  );

  const shareUrl = useMemo(
    () =>
      BorrowNavigation.generateBorrowShareLink({
        networkId,
        symbol,
        provider,
        marketAddress,
        reserveAddress,
        logoURI,
        isDevMode: devSettings.enabled,
      }),
    [
      devSettings.enabled,
      logoURI,
      marketAddress,
      networkId,
      provider,
      reserveAddress,
      symbol,
    ],
  );
  const handleShare = useCallback(() => {
    void shareText(shareUrl);
  }, [shareText, shareUrl]);

  // The supply side can be paid with another token the wallet holds; the
  // pick is kept here, so it survives a look at the Withdraw tab
  const [payKey, setPayKey] = useState<string>();
  const payWith = useMemo<IManagePositionPayWith>(
    () => ({ selectedKey: payKey, onSelectedKeyChange: setPayKey }),
    [payKey],
  );

  const pageTitle = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <Token size="md" tokenImageUri={logoURI} />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [logoURI, symbol],
  );

  // Narrow, the page's own footer, as on a vault's page: Supply opens the
  // deposit modal on this market alone (Pay with, the done view), and
  // Withdraw the market's withdraw alone once there is something supplied
  const hasSupplied = hasSuppliedBalance(details);
  const handleOpenSupply = useCallback(() => {
    EarnNavigation.pushToEarnOffersDeposit(navigation, {
      symbol,
      networkId,
      logoURI,
      offerKey: `${buildBorrowMarketKey({
        provider,
        networkId,
        marketAddress,
      })}:${reserveAddress}`,
      offerOnly: true,
    });
  }, [
    logoURI,
    marketAddress,
    navigation,
    networkId,
    provider,
    reserveAddress,
    symbol,
  ]);
  const handleOpenWithdraw = useCallback(() => {
    BorrowNavigation.pushToBorrowManagePosition(navigation, {
      accountId: accountId ?? '',
      indexedAccountId: formIndexedAccountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      providerDisplayName: marketLabel,
      providerLogoURI: market?.logoURI,
      type: EManagePositionType.Withdraw,
      withdrawOnly: true,
    });
  }, [
    accountId,
    formIndexedAccountId,
    logoURI,
    market?.logoURI,
    marketAddress,
    marketLabel,
    navigation,
    networkId,
    provider,
    reserveAddress,
    symbol,
  ]);
  const pageFooter = useMemo(() => {
    // Until the reserve is in there is nothing to act on: no button over the
    // loading skeleton
    if (gtMd || !details) {
      return null;
    }
    return (
      <Page.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.defi_supply })}
        confirmButtonProps={{
          variant: 'primary',
          onPress: handleOpenSupply,
          mb: tabBarHeight,
        }}
        {...(hasSupplied
          ? {
              onCancelText: intl.formatMessage({
                id: ETranslations.global_withdraw,
              }),
              cancelButtonProps: {
                variant: 'secondary',
                onPress: handleOpenWithdraw,
                mb: tabBarHeight,
              },
            }
          : {})}
      />
    );
  }, [
    details,
    gtMd,
    handleOpenSupply,
    handleOpenWithdraw,
    hasSupplied,
    intl,
    tabBarHeight,
  ]);

  const headerRight = useMemo(() => {
    if (gtMd) return null;
    return (
      <IconButton
        testID="earn-lending-header-share"
        icon="ShareOutline"
        variant="tertiary"
        onPress={handleShare}
      />
    );
  }, [gtMd, handleShare]);

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      header={
        // Above the token on narrow screens, as on a vault's page
        <XStack ml={gtSm ? 'auto' : '0'} pr="$2" pt={gtSm ? undefined : '$4'}>
          <ManagersRow managers={details?.managers} />
        </XStack>
      }
      customHeaderRightItems={headerRight}
      footer={pageFooter}
    >
      <XStack flexDirection={gtMd ? 'row' : 'column'}>
        <Stack
          w="100%"
          {...(gtMd ? { width: undefined, flex: 1, minWidth: 0 } : null)}
        >
          <LendingDetailsPart
            details={details}
            isLoading={isLoading ?? false}
            onRefresh={refreshData}
            networkId={networkId}
            provider={provider}
            marketAddress={marketAddress}
            reserveAddress={reserveAddress}
            symbol={symbol}
            logoURI={logoURI}
            marketLabel={marketLabel}
            marketLogoURI={market?.logoURI}
            onShare={gtMd ? handleShare : undefined}
          />
        </Stack>
        {gtMd ? (
          <StickyFormColumn>
            <YStack flex={4}>
              <YStack gap="$1.5" flex={1}>
                <ManagePositionContent
                  showApyDetail={false}
                  networkId={networkId}
                  symbol={symbol}
                  provider={provider}
                  type={EManagePositionType.Supply}
                  marketAddress={marketAddress}
                  reserveAddress={reserveAddress}
                  accountId={accountId ?? ''}
                  indexedAccountId={formIndexedAccountId}
                  fallbackTokenImageUri={logoURI}
                  providerDisplayName={marketLabel}
                  providerLogoUri={market?.logoURI}
                  payWith={payWith}
                  isEarnLending
                  onStakeWithdrawSuccess={refreshData}
                />
              </YStack>
            </YStack>
          </StickyFormColumn>
        ) : null}
      </XStack>
    </EarnPageContainer>
  );
};

function EarnLendingDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <EarnLendingDetailsPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default EarnLendingDetailsPageWithProvider;
