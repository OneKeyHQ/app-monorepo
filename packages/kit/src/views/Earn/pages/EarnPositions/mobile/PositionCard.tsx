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
import type {
  IEarnPortfolioAirdropAsset,
  IEarnPortfolioAsset,
  IEarnPortfolioInvestment,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { MobilePnlSection } from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';

import { categoryLabelId, isLedgerAirdropProvider } from './myPortfolio.utils';

/** "Deposited | Balance" style two-column section header. */
function SectionHeader({ title }: { title: string }) {
  const intl = useIntl();
  return (
    <XStack
      ai="center"
      jc="space-between"
      px="$3"
      py="$1.5"
      bg="$bgSubdued"
      borderRadius="$2"
    >
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
 * One token row: icon + symbol on the left; on the right the fiat text over
 * the amount text, exactly as the investment detail rendered them (the
 * server sends both as text, so nothing is re-derived here).
 */
function TokenRow({
  symbol,
  logoURI,
  networkId,
  primary,
  secondary,
}: {
  symbol: string;
  logoURI?: string;
  networkId: string;
  primary?: IEarnText;
  secondary?: IEarnText;
}) {
  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight={44} px="$1">
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
        {primary ? (
          <EarnText size="$bodyMdMedium" text={primary} textAlign="right" />
        ) : null}
        {secondary ? (
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

/**
 * One position of a protocol (figma 29180-108096): category badge + pool,
 * the Deposited and Rewards sections, the PnL line product asked to keep,
 * and the Manage button that leads into the detail page where every action
 * lives. `rewardsOnly` renders the Claimable-tab variant of the same card.
 */
export function PositionCard({
  investment,
  rewardsOnly = false,
  onManage,
}: {
  investment: IEarnPortfolioInvestment;
  rewardsOnly?: boolean;
  onManage?: (investment: IEarnPortfolioInvestment) => void;
}) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { protocol, network } = investment;
  const badgeId = categoryLabelId(protocol.category);
  const providerCode = protocol.providerDetail.code;

  const rewardRows: {
    key: string;
    symbol: string;
    logoURI?: string;
    primary?: IEarnText;
    secondary?: IEarnText;
  }[] = [];
  investment.assets.forEach((asset: IEarnPortfolioAsset, assetIndex) => {
    asset.rewardAssets?.forEach((reward, index) => {
      rewardRows.push({
        key: `reward-${assetIndex}-${index}`,
        symbol: asset.token.info.symbol,
        logoURI: asset.token.info.logoURI,
        primary: reward.description ?? reward.title,
        secondary: reward.description ? reward.title : undefined,
      });
    });
  });
  // On-chain airdrop rows (Morpho / Lista / Pendle) are position rewards too;
  // ledger-backed ones (Native / Spark) live on the Rewards tab instead.
  if (!isLedgerAirdropProvider(providerCode)) {
    investment.airdropAssets.forEach(
      (asset: IEarnPortfolioAirdropAsset, assetIndex) => {
        asset.airdropAssets?.forEach((airdrop, index) => {
          rewardRows.push({
            key: `airdrop-${assetIndex}-${index}`,
            symbol: asset.token.info.symbol,
            logoURI: asset.token.info.logoURI,
            primary: airdrop.description ?? airdrop.title,
            secondary: airdrop.description ? airdrop.title : undefined,
          });
        });
      },
    );
  }

  const firstAsset = investment.assets[0];

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
          {investment.totalFiatValue}
        </NumberSizeableText>
      </XStack>

      {!rewardsOnly && investment.assets.length > 0 ? (
        <YStack gap="$1">
          <SectionHeader
            title={intl.formatMessage({ id: ETranslations.earn_deposited })}
          />
          {investment.assets.map((asset, index) => (
            <TokenRow
              key={`deposit-${index}`}
              symbol={asset.token.info.symbol}
              logoURI={asset.token.info.logoURI}
              networkId={network.networkId}
              primary={asset.deposit?.description ?? asset.deposit?.title}
              secondary={
                asset.deposit?.description ? asset.deposit?.title : undefined
              }
            />
          ))}
        </YStack>
      ) : null}

      {rewardRows.length > 0 ? (
        <YStack gap="$1">
          <SectionHeader
            title={intl.formatMessage({ id: ETranslations.earn_rewards })}
          />
          {rewardRows.map((row) => (
            <TokenRow
              key={row.key}
              symbol={row.symbol}
              logoURI={row.logoURI}
              networkId={network.networkId}
              primary={row.primary}
              secondary={row.secondary}
            />
          ))}
        </YStack>
      ) : null}

      {!rewardsOnly && firstAsset ? (
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
    </YStack>
  );
}
