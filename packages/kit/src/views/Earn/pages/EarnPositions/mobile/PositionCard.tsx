import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IEarnPortfolioAirdropAsset,
  IEarnPortfolioAsset,
  IEarnPortfolioInvestment,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import {
  MobilePnlSection,
  WrappedActionButton,
} from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';

import {
  categoryLabelId,
  depositedFiatValue,
  isLedgerAirdropProvider,
  sizedRewardRows,
  splitPositionRows,
} from './myPortfolio.utils';

import type {
  IPositionManageHandler,
  IPositionRewardRow,
  IPositionStatusRow,
} from './myPortfolio.utils';

/** "Deposited | Balance" style two-column section header, plain text. */
function SectionHeader({ title }: { title: string }) {
  const intl = useIntl();
  return (
    <XStack ai="center" jc="space-between" px="$1" pt="$2" pb="$1">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {title}
      </SizableText>
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_balance })}
      </SizableText>
    </XStack>
  );
}

/**
 * The detail page shows the fiat inline after the amount, so the server wraps
 * it in parentheses: "($2.11)". Here it sits on its own line above the
 * amount, where the parentheses read as a negative figure; unwrap them.
 */
function unwrapParentheses(text: IEarnText | undefined) {
  if (!text) {
    return text;
  }
  const match = /^\((.*)\)$/.exec(text.text.trim());
  return match ? { ...text, text: match[1] } : text;
}

/**
 * One token row: icon + symbol on the left; on the right the fiat over the
 * amount. Classified rows carry numbers and are formatted here; the rest
 * show the server's text as the detail page does.
 */
function TokenRow({
  symbol,
  logoURI,
  networkId,
  primary,
  secondary,
  fiatValue,
  amount,
  onPress,
}: {
  symbol: string;
  logoURI?: string;
  networkId: string;
  primary?: IEarnText;
  secondary?: IEarnText;
  fiatValue?: string;
  amount?: string;
  /** opens that row's own detail page; matters when a card spans chains */
  onPress?: () => void;
}) {
  const currencyInfo = useCurrency();
  return (
    <XStack
      ai="center"
      jc="space-between"
      gap="$3"
      minHeight={44}
      px="$1"
      cursor={onPress ? 'pointer' : undefined}
      onPress={onPress}
    >
      <XStack ai="center" gap="$2" flex={1} minWidth={0}>
        <Token
          size="md"
          tokenImageUri={logoURI}
          showNetworkIcon
          networkId={networkId}
        />
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {symbol}
        </SizableText>
      </XStack>
      <YStack ai="flex-end" flexShrink={0}>
        {fiatValue !== undefined ? (
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: currencyInfo.symbol }}
            numberOfLines={1}
          >
            {fiatValue}
          </NumberSizeableText>
        ) : null}
        {fiatValue === undefined && primary ? (
          <EarnText
            size="$bodyMdMedium"
            text={unwrapParentheses(primary)}
            textAlign="right"
          />
        ) : null}
        {amount !== undefined ? (
          <NumberSizeableText
            size="$bodySm"
            color="$textSubdued"
            formatter="balance"
            numberOfLines={1}
          >
            {amount}
          </NumberSizeableText>
        ) : null}
        {amount === undefined && secondary ? (
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            text={secondary}
            textAlign="right"
          />
        ) : null}
      </YStack>
    </XStack>
  );
}

/** Card chrome shared by the three cards of a position. */
function CardFrame({
  investment,
  fiatValue,
  children,
}: {
  investment: IEarnPortfolioInvestment;
  fiatValue: string;
  children: React.ReactNode;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { protocol } = investment;
  const badgeId = categoryLabelId(protocol.category);
  return (
    <YStack
      gap="$2"
      p="$3"
      borderRadius="$3"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bg"
      testID={EarnTestIDs.portfolioItem(protocol.providerDetail.name)}
    >
      <XStack ai="center" jc="space-between" gap="$2" minHeight={28}>
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          {badgeId ? (
            <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
              <Badge.Text>{intl.formatMessage({ id: badgeId })}</Badge.Text>
            </Badge>
          ) : null}
          {protocol.vaultName ? (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flex={1}
            >
              {protocol.vaultName}
            </SizableText>
          ) : null}
        </XStack>
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          numberOfLines={1}
        >
          {fiatValue}
        </NumberSizeableText>
      </XStack>
      {children}
    </YStack>
  );
}

type IRewardRowView = {
  key: string;
  symbol: string;
  logoURI?: string;
  networkId: string;
  primary?: IEarnText;
  secondary?: IEarnText;
  fiatValue?: string;
  amount?: string;
  asset?: IEarnPortfolioAsset;
};

function toRewardRowView({
  key,
  asset,
  row,
}: IPositionRewardRow): IRewardRowView {
  return {
    key,
    symbol: asset.token.info.symbol,
    logoURI: asset.token.info.logoURI,
    networkId: asset.metadata.network.networkId,
    primary: row.description ?? row.title,
    secondary: row.description ? row.title : undefined,
    fiatValue: row.fiatValue,
    amount: row.amount,
    asset,
  };
}

/** On-chain airdrop rows (Morpho / Lista / Pendle); ledger-backed ones live on the Rewards tab. */
function airdropRowViews(
  investment: IEarnPortfolioInvestment,
): IRewardRowView[] {
  if (isLedgerAirdropProvider(investment.protocol.providerDetail.code)) {
    return [];
  }
  const rows: IRewardRowView[] = [];
  investment.airdropAssets.forEach(
    (asset: IEarnPortfolioAirdropAsset, assetIndex) => {
      asset.airdropAssets?.forEach((airdrop, index) => {
        rows.push({
          key: `airdrop-${assetIndex}-${index}`,
          symbol: asset.token.info.symbol,
          logoURI: asset.token.info.logoURI,
          networkId: asset.metadata.network.networkId,
          primary: airdrop.description ?? airdrop.title,
          secondary: airdrop.description ? airdrop.title : undefined,
        });
      });
    },
  );
  return rows;
}

function RewardRows({
  investment,
  rows,
  onManage,
}: {
  investment: IEarnPortfolioInvestment;
  rows: IRewardRowView[];
  onManage?: IPositionManageHandler;
}) {
  const intl = useIntl();
  if (rows.length === 0) {
    return null;
  }
  return (
    <YStack gap="$1">
      <SectionHeader
        title={intl.formatMessage({ id: ETranslations.earn_rewards })}
      />
      {rows.map((row) => (
        <TokenRow
          key={row.key}
          symbol={row.symbol}
          logoURI={row.logoURI}
          networkId={row.networkId}
          primary={row.primary}
          secondary={row.secondary}
          fiatValue={row.fiatValue}
          amount={row.amount}
          onPress={
            onManage && row.asset
              ? () => onManage(investment, row.asset)
              : undefined
          }
        />
      ))}
    </YStack>
  );
}

/**
 * Withdrawn principal waiting to be claimed (figma 30292-17104): one card per
 * row, claimed right here with the button the server attached to the row —
 * the same claim the detail page runs. It is principal, so it is never part
 * of the Rewards figure or the Rewards tab.
 */
function PrincipalClaimCard({
  investment,
  entry,
  onManage,
}: {
  investment: IEarnPortfolioInvestment;
  entry: IPositionRewardRow;
  onManage?: IPositionManageHandler;
}) {
  const intl = useIntl();
  const view = toRewardRowView(entry);
  return (
    <CardFrame investment={investment} fiatValue={entry.row.fiatValue ?? '0'}>
      <YStack gap="$1">
        <SectionHeader
          title={intl.formatMessage({ id: ETranslations.earn_claimable })}
        />
        <TokenRow
          symbol={view.symbol}
          logoURI={view.logoURI}
          networkId={view.networkId}
          primary={view.primary}
          secondary={view.secondary}
          fiatValue={view.fiatValue}
          amount={view.amount}
          onPress={
            onManage ? () => onManage(investment, entry.asset) : undefined
          }
        />
      </YStack>
      <WrappedActionButton
        asset={entry.asset}
        reward={entry.row}
        rewardSymbol={entry.asset.token.info.symbol}
        buttonProps={{ size: 'medium', variant: 'primary' }}
      />
    </CardFrame>
  );
}

/** A withdrawal in progress (figma 30292-17104): dated when the server knows when it frees up. */
function UnstakingCard({
  investment,
  entry,
  onManage,
}: {
  investment: IEarnPortfolioInvestment;
  entry: IPositionStatusRow;
  onManage?: IPositionManageHandler;
}) {
  const intl = useIntl();
  const { asset, row } = entry;
  // Existing copy: the section reuses the status the detail page prints on
  // these very rows ("Withdrawal requested"), the date line "Unlock time".
  const unstakingLabel = intl.formatMessage({
    id: ETranslations.earn_withdrawal_requested,
  });
  return (
    <CardFrame investment={investment} fiatValue={row.fiatValue ?? '0'}>
      {row.unlockAt ? (
        <XStack px="$1" pt="$1" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {`${intl.formatMessage({ id: ETranslations.earn_unlock_time })}: `}
          </SizableText>
          <SizableText size="$bodySm">
            {formatDate(new Date(row.unlockAt), { hideTimeForever: true })}
          </SizableText>
        </XStack>
      ) : null}
      <YStack gap="$1">
        <SectionHeader title={unstakingLabel} />
        <TokenRow
          symbol={asset.token.info.symbol}
          logoURI={asset.token.info.logoURI}
          networkId={asset.metadata.network.networkId}
          primary={row.description}
          secondary={row.title}
          fiatValue={row.fiatValue}
          amount={row.amount}
          onPress={onManage ? () => onManage(investment, asset) : undefined}
        />
      </YStack>
    </CardFrame>
  );
}

/**
 * One position of a protocol, as up to three cards (figma 29180-108096 and
 * 30292-17104): the Deposited card with the position's yield rows, the PnL
 * line product asked to keep and the Manage button into the detail page;
 * then one Claimable card per withdrawn-principal row and one Unstaking card
 * per withdrawal in progress. `rewardsOnly` is the Claimable-tab variant:
 * only the rows the header counts (sized yield and on-chain airdrops).
 */
export function PositionCard({
  investment,
  rewardsOnly = false,
  onManage,
}: {
  investment: IEarnPortfolioInvestment;
  rewardsOnly?: boolean;
  onManage?: IPositionManageHandler;
}) {
  const intl = useIntl();
  const { principal, unstaking, rewards } = splitPositionRows(investment);
  const firstAsset = investment.assets[0];

  if (rewardsOnly) {
    const rows = [
      ...sizedRewardRows(investment).map(toRewardRowView),
      ...airdropRowViews(investment),
    ];
    if (rows.length === 0) {
      return null;
    }
    return (
      <CardFrame investment={investment} fiatValue={investment.totalFiatValue}>
        <RewardRows investment={investment} rows={rows} onManage={onManage} />
        {onManage ? (
          <Button
            testID="earn-btn"
            size="medium"
            variant="secondary"
            onPress={() => onManage(investment)}
          >
            {intl.formatMessage({ id: ETranslations.global_manage })}
          </Button>
        ) : null}
      </CardFrame>
    );
  }

  const rewardRows = [
    ...rewards.map(toRewardRowView),
    ...airdropRowViews(investment),
  ];

  return (
    <YStack gap="$3">
      {investment.assets.length > 0 ? (
        <CardFrame
          investment={investment}
          fiatValue={depositedFiatValue(investment)}
        >
          <YStack gap="$1">
            <SectionHeader
              title={intl.formatMessage({ id: ETranslations.earn_deposited })}
            />
            {investment.assets.map((asset, index) => (
              <TokenRow
                key={`deposit-${index}`}
                symbol={asset.token.info.symbol}
                logoURI={asset.token.info.logoURI}
                networkId={asset.metadata.network.networkId}
                primary={asset.deposit?.description ?? asset.deposit?.title}
                secondary={
                  asset.deposit?.description ? asset.deposit?.title : undefined
                }
                onPress={
                  onManage ? () => onManage(investment, asset) : undefined
                }
              />
            ))}
          </YStack>
          <RewardRows
            investment={investment}
            rows={rewardRows}
            onManage={onManage}
          />
          {firstAsset ? (
            <XStack px="$1">
              <MobilePnlSection asset={firstAsset} />
            </XStack>
          ) : null}
          {onManage ? (
            <Button
              testID="earn-btn"
              size="medium"
              variant="secondary"
              onPress={() => onManage(investment)}
            >
              {intl.formatMessage({ id: ETranslations.global_manage })}
            </Button>
          ) : null}
        </CardFrame>
      ) : null}
      {principal.map((entry) => (
        <PrincipalClaimCard
          key={entry.key}
          investment={investment}
          entry={entry}
          onManage={onManage}
        />
      ))}
      {unstaking.map((entry) => (
        <UnstakingCard
          key={entry.key}
          investment={investment}
          entry={entry}
          onManage={onManage}
        />
      ))}
    </YStack>
  );
}
