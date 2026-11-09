import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IBadgeType } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

import { PortfolioPendingTxsProvider } from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';
import { EarnHoldingSections } from '../../EarnPositions/mobile/EarnHoldingSections';

import { TransactionLink } from './TransactionLink';

import type { IEarnHoldingRedeem } from '../../EarnPositions/mobile/EarnHoldingSections';
import type { IEarnPositionView } from '../../EarnPositions/mobile/earnPositionModel';

type IMobilePortfolio = NonNullable<IStakeEarnDetail['mobilePortfolio']>;
type IPortfolioGroup = IMobilePortfolio['groups'][number];
type IPortfolioRow = IPortfolioGroup['items'][number];

// The server speaks the full EBadgeColor set; 'danger' is the one value the
// Badge component does not have a variant for.
function toBadgeType(badgeType: string): IBadgeType {
  return badgeType === 'danger' ? 'critical' : (badgeType as IBadgeType);
}

function PortfolioRow({
  item,
  networkId,
  protocolInfo,
  tokenInfo,
  onPress,
  onRedeem,
  onActionSuccess,
}: {
  item: IPortfolioRow;
  networkId: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  onPress?: () => void;
  onRedeem?: () => void;
  onActionSuccess?: () => void;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  return (
    <XStack
      minHeight={40}
      ai="center"
      jc="space-between"
      gap="$3"
      {...(onPress ? { onPress, cursor: 'pointer' } : {})}
    >
      <XStack ai="center" gap="$2.5" flex={1} minWidth={0}>
        <Token size="sm" tokenImageUri={item.token.info.logoURI} />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <EarnText text={item.title} size="$bodyLgMedium" numberOfLines={1} />
          {item.txHash ? (
            <TransactionLink networkId={networkId} txHash={item.txHash} />
          ) : (
            <XStack ai="center" gap="$1.5" flexWrap="wrap">
              <EarnText
                text={item.description}
                size="$bodySm"
                color={item.description?.color || '$textSubdued'}
                numberOfLines={1}
              />
              {/* The row shows the token amount; the design puts its fiat
                  value beside the status (OK-62408). Both server paths emit
                  fiatValue, so an empty string is the only case to skip. */}
              {item.fiatValue ? (
                <NumberSizeableText
                  size="$bodySm"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{ currency: currencyInfo.symbol }}
                  numberOfLines={1}
                >
                  {item.fiatValue}
                </NumberSizeableText>
              ) : null}
              {/* A withdrawal-requested row carries the countdown per order,
                  the same tooltip the positions page opens from its info
                  icon; the row used to drop it (OK-63230). */}
              {item.tooltip ? <EarnTooltip tooltip={item.tooltip} /> : null}
            </XStack>
          )}
        </YStack>
      </XStack>
      <XStack ai="center" gap="$2" flexShrink={0}>
        {item.buttons?.map((button, index) => (
          <EarnActionIcon
            key={index}
            title={item.title.text}
            actionIcon={button}
            protocolInfo={protocolInfo}
            tokenInfo={tokenInfo}
            token={item.token.info}
            onActionSuccess={onActionSuccess}
          />
        ))}
        {/* Rewards the user cannot act on state their stage here instead of
            under a section heading of their own (figma 29180-111458). */}
        {item.badge ? (
          <Badge badgeType={toBadgeType(item.badge.badgeType)}>
            <Badge.Text>{item.badge.text.text}</Badge.Text>
          </Badge>
        ) : null}
        {/* Rewards carry a Claim button, so the principal gets the matching
            action rather than leaving the footer as the only way to redeem. */}
        {onRedeem ? (
          <Button
            testID={EarnTestIDs.portfolioRedeemButton}
            size="small"
            variant="secondary"
            onPress={onRedeem}
          >
            {intl.formatMessage({ id: ETranslations.earn_redeem })}
          </Button>
        ) : null}
      </XStack>
    </XStack>
  );
}

/**
 * My investment over the holding's card (product 10-14): the balance and
 * the 24h earnings first, then Spark's Effective APY, which the positions
 * carry on the effective deposit. The APY cell that repeated the headline
 * is gone.
 */
function HoldingInvestment({ holding }: { holding: IEarnPositionView }) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const apy = holding.effectiveDeposit?.apy;
  const earnings24h = new BigNumber(
    holding.source.earn.investment.earnings24hFiatValue || '0',
  );
  return (
    <YStack gap="$2">
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({
          id: ETranslations.wallet_defi_position_module_investment,
        })}
      </SizableText>
      <XStack flexWrap="wrap" m="$-3">
        <GridItem
          title={{
            text: intl.formatMessage({ id: ETranslations.global_balance }),
          }}
          descriptionComponent={
            // As the card prints it: a holding no price is known for reads
            // "price unavailable", never a zero that says it is empty.
            <ProtocolValueCell
              value={holding.value.value}
              currencySymbol={currencyInfo.symbol}
              priceUnavailableLabel={intl.formatMessage({
                id: ETranslations.wallet_price_unavailable,
              })}
              partialPriceUnavailableLabel={intl.formatMessage({
                id: ETranslations.wallet_partial_price_unavailable,
              })}
              isUnavailable={!holding.value.hasAvailableValue}
              showPriceUnavailableTooltip={
                holding.value.hasAvailableValue &&
                holding.value.hasUnavailableValue
              }
              size="$bodyLgMedium"
              justifyContent="flex-start"
              numberOfLines={1}
            />
          }
        />
        <GridItem
          title={{
            text: intl.formatMessage({ id: ETranslations.earn_24h_earnings }),
          }}
          descriptionComponent={
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyLgMedium"
              color={earnings24h.gt(0) ? '$textSuccess' : '$text'}
              formatter="value"
              formatterOptions={{
                currency: currencyInfo.symbol,
                showPlusMinusSigns: earnings24h.gt(0),
              }}
              numberOfLines={1}
            >
              {earnings24h.toFixed()}
            </NumberSizeableTextWrapper>
          }
        />
        {apy ? (
          <GridItem
            title={apy.title}
            description={apy.description}
            tooltip={apy.tooltip}
            tooltipTrigger="title"
          />
        ) : null}
      </XStack>
    </YStack>
  );
}

export function PortfolioTab({
  portfolio,
  networkId,
  symbol,
  provider,
  vault,
  protocolInfo,
  tokenInfo,
  onActionSuccess,
  onRedeem,
  canRedeem,
  holding,
  holdingRedeem,
}: {
  portfolio: IMobilePortfolio;
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  // Claiming and redeeming both change the balances this tab renders, and both
  // hand off to a modal; this is how they report back.
  onActionSuccess?: () => void;
  // The page owns the Redeem destination (ManagePosition, or the position
  // picker for per-position providers) so the row and the footer cannot drift.
  onRedeem?: () => void;
  // Whether the active row offers Redeem; the page decides, since a provider
  // that hides its wide-layout actions (Native) sends no redeem capability.
  canRedeem?: boolean;
  // The holding as the My portfolio card shows it (product 10-14). When
  // known, Balance and Rewards are that card's panels instead of the
  // server's groups, so the two pages cannot disagree.
  holding?: IEarnPositionView;
  // The deposit row's Redeem: the page footer's, with its label and state
  // (product 10-15), so a provider that redeems per position gets its picker.
  holdingRedeem?: IEarnHoldingRedeem;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const accountId = protocolInfo?.earnAccount?.accountId;

  // Only the distributed rows carry a history entry worth opening; the other
  // rows describe live state that this page already shows in full.
  //
  // pushModal, not push: this page lives on the Earn tab stack while the target
  // is registered in StakingModal, so a plain push resolves to nothing and the
  // tap dies silently. (ProtocolDetails gets away with push because it already
  // sits inside that modal stack.)
  //
  // HistoryList, not PortfolioDetails: the latter renders IBabylonPortfolioItem
  // and is entered under an isBTCNetwork guard, so every other provider would
  // land on an empty Babylon list. HistoryList is scoped by vault and works for
  // any protocol; the row's own TransactionLink still opens the exact payout.
  const openPayoutHistory = useCallback(() => {
    if (!accountId) {
      return;
    }
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.HistoryList,
      params: {
        accountId,
        networkId,
        symbol,
        provider,
        protocolVault: vault,
      },
    });
  }, [navigation, accountId, networkId, symbol, provider, vault]);

  const pendingTxsValue = useMemo(
    () => ({
      onRefresh: async () => {
        onActionSuccess?.();
      },
    }),
    [onActionSuccess],
  );

  return (
    <YStack gap="$6">
      {holding ? <HoldingInvestment holding={holding} /> : null}
      {!holding && portfolio.summary?.items?.length ? (
        <YStack gap="$2">
          <SizableText size="$headingMd" color="$text">
            {intl.formatMessage({
              id: ETranslations.wallet_defi_position_module_investment,
            })}
          </SizableText>
          {/* GridItem is already two-per-row on phone; the server sends the
              cells the design shows (24h earnings then APY, or Spark's
              effective deposits, effective APY and 24h earnings). The server
              strips the tooltips of the wide-layout cells it reuses, so a
              tooltip here is one made for the phone and opens from the title,
              marked with the dotted rule. The popup trigger a cell carries is
              still not forwarded: the APY breakdown opens from the headline
              above (OK-62393, OK-62391). */}
          <XStack flexWrap="wrap" m="$-3">
            {portfolio.summary.items.map((cell, index) => (
              <GridItem
                key={cell.title?.text || `summary-${index}`}
                title={cell.title}
                description={cell.description}
                tooltip={cell.tooltip}
                tooltipTrigger="title"
                type={cell.type}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}

      {holding ? (
        <PortfolioPendingTxsProvider value={pendingTxsValue}>
          <EarnHoldingSections position={holding} redeem={holdingRedeem} />
        </PortfolioPendingTxsProvider>
      ) : (
        portfolio.groups.map((group) => (
          <YStack
            key={group.key}
            gap="$3"
            bg="$bgSubdued"
            borderRadius="$3"
            p="$4"
          >
            <EarnText text={group.title} size="$bodyMd" color="$textSubdued" />
            {group.items.map((item, index) => (
              <PortfolioRow
                key={`${group.key}-${index}`}
                item={item}
                networkId={networkId}
                protocolInfo={protocolInfo}
                tokenInfo={tokenInfo}
                onPress={
                  item.status === 'distributed' && accountId
                    ? openPayoutHistory
                    : undefined
                }
                onRedeem={
                  item.redeemable &&
                  (canRedeem ?? portfolio.capabilities.redeem)
                    ? onRedeem
                    : undefined
                }
                onActionSuccess={onActionSuccess}
              />
            ))}
          </YStack>
        ))
      )}
    </YStack>
  );
}
