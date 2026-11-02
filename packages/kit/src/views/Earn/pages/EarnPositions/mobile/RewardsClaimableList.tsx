import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  NumberSizeableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnPortfolioPosition } from '@onekeyhq/shared/types/earn/portfolioPositions';
import type { IEarnRewardsPortfolioGroup } from '@onekeyhq/shared/types/staking';

import { WrappedActionButton } from '../../../components/PortfolioTabContent';
import { EarnTestIDs } from '../../../testIDs';
import { resolveUniquePortfolioClaimSourceIdentity } from '../../../utils/portfolioClaimUtils';

import { ClaimableRewardRow } from './ClaimableRewardRow';
import { GroupRow, useGroupExpansion } from './GroupRow';
import {
  buildClaimSourceCandidates,
  buildNetworkInfoMap,
  hasPositionDetailPage,
  mergeRewardGroups,
  toLedgerClaimAsset,
  toPositionRewardClaim,
} from './myPortfolio.utils';

import type { IEarnPositionCardHandlers } from './EarnPositionCard';
import type {
  IEarnPositionRewardGroup,
  IEarnPositionRewardRow,
} from './earnPositionModel';
import type { IRewardsStageGroup } from './myPortfolio.utils';

/** The group's figure: fiat the way the protocol rows read, the token amount only when nothing priced it. */
export function RewardsGroupTotal({ group }: { group: IRewardsStageGroup }) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  if (group.amountOnly) {
    return (
      <NumberSizeableText
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={{ tokenSymbol: group.amountOnly.symbol }}
        numberOfLines={1}
      >
        {group.amountOnly.amount}
      </NumberSizeableText>
    );
  }
  return (
    <ProtocolValueCell
      value={group.value.value}
      currencySymbol={currencyInfo.symbol}
      priceUnavailableLabel={intl.formatMessage({
        id: ETranslations.wallet_price_unavailable,
      })}
      isUnavailable={!group.value.hasAvailableValue}
      size="$bodyLgMedium"
      textAlign="right"
      numberOfLines={1}
    />
  );
}

/**
 * The row's action: the claim the server attached to the reward, or Lista's
 * Check, run by the button the wide layout runs on that row (enabled or
 * not, as sent; the button carries its own label). A reward without a claim
 * of its own is collected on the detail page, so the way there stays on the
 * row.
 */
function PositionRewardAction({
  row,
  onManage,
}: { row: IEarnPositionRewardRow } & IEarnPositionCardHandlers) {
  const intl = useIntl();
  const { position, asset } = row;
  const { source, action } = position;
  if (asset.claim) {
    const claim = toPositionRewardClaim(source, {
      ...asset,
      claim: asset.claim,
    });
    return (
      <WrappedActionButton
        asset={claim.asset}
        reward={claim.reward}
        rewardSymbol={claim.rewardSymbol}
      />
    );
  }
  const opensDetail = action?.kind === 'manage' || action?.kind === 'unstake';
  if (!opensDetail || !onManage || !hasPositionDetailPage(source)) {
    return null;
  }
  return (
    <Button
      testID={EarnTestIDs.portfolioRewardManageButton}
      size="small"
      variant="secondary"
      onPress={() => onManage(action.target)}
    >
      {intl.formatMessage({ id: ETranslations.global_manage })}
    </Button>
  );
}

/**
 * Claimable (figma 30490-21537; product: split by what the user has to do,
 * not by where the reward comes from): every reward the user claims by hand
 * that the header also counts, one row each with its own Claim, under one
 * group per protocol per network —
 *   - the positions' rewards, claimed through the claim the server attached
 *     to the row;
 *   - Campaign / airdrop rows from the ledger, claimed through the ledger's
 *     own button, because some of those rows cannot resolve to a detail
 *     page at all.
 * Claimable principal is a position of its own on DeFi Assets, never here.
 */
export function RewardsClaimableList({
  positionGroups,
  positions,
  ledgerGroups,
  isLoading = false,
  emptyTitle,
  onManage,
}: {
  positionGroups: IEarnPositionRewardGroup[];
  positions: IEarnPortfolioPosition[];
  ledgerGroups: IEarnRewardsPortfolioGroup[];
  /** the ledger part is still on its way: no empty state yet */
  isLoading?: boolean;
  emptyTitle: string;
} & IEarnPositionCardHandlers) {
  const expansion = useGroupExpansion();
  // A ledger amount comes formatted from the server: hidden as a whole.
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const candidates = useMemo(
    () => buildClaimSourceCandidates(positions),
    [positions],
  );
  const networkInfoById = useMemo(
    () => buildNetworkInfoMap(positions),
    [positions],
  );
  const groups = useMemo(
    () => mergeRewardGroups({ positionGroups, ledgerGroups }),
    [positionGroups, ledgerGroups],
  );

  if (groups.length === 0) {
    if (isLoading) {
      return (
        <Stack ai="center" py="$8">
          <Spinner size="large" />
        </Stack>
      );
    }
    return <Empty illustration="BlockCoins" title={emptyTitle} />;
  }

  return (
    <YStack gap="$4">
      {groups.map((group) => (
        <GroupRow
          key={group.key}
          name={group.name}
          logoURI={group.logoURI}
          networkId={group.networkId}
          expanded={expansion.isExpanded(group.key)}
          onToggle={() => expansion.toggle(group.key)}
          total={<RewardsGroupTotal group={group} />}
        >
          <YStack
            px="$3"
            py="$1"
            borderRadius="$3"
            borderWidth="$px"
            borderColor="$borderSubdued"
            bg="$bg"
          >
            {group.positionRows.map((row) => (
              <ClaimableRewardRow
                key={row.key}
                networkId={row.position.source.networkId}
                logoURI={row.asset.meta?.logoUrl}
                title={
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$bodyMdMedium"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: row.asset.symbol }}
                    numberOfLines={1}
                  >
                    {row.asset.amount}
                  </NumberSizeableTextWrapper>
                }
                subtitle={row.position.name}
                fiatValue={
                  isProtocolAssetValueUnavailable(row.asset) ||
                  !new BigNumber(row.asset.amount).gt(0)
                    ? undefined
                    : row.asset.value
                }
                action={<PositionRewardAction row={row} onManage={onManage} />}
              />
            ))}
            {group.ledgerItems.map(({ group: ledgerGroup, item }, index) => {
              const network = networkInfoById.get(ledgerGroup.networkId);
              const asset = toLedgerClaimAsset({
                group: ledgerGroup,
                item,
                networkName: network?.name ?? '',
                networkLogoURI: network?.logoURI ?? '',
              });
              const reward = asset?.airdropAssets[0];
              return (
                <ClaimableRewardRow
                  key={`${item.token.info.symbol}-${item.vault ?? ''}-${index}`}
                  networkId={ledgerGroup.networkId}
                  logoURI={item.token.info.logoURI}
                  title={
                    <EarnText
                      text={hideValue ? { text: '****' } : item.title}
                      size="$bodyMdMedium"
                      numberOfLines={1}
                    />
                  }
                  subtitle={
                    item.description ? (
                      <EarnText
                        text={item.description}
                        size="$bodySm"
                        color="$textSubdued"
                        numberOfLines={1}
                      />
                    ) : undefined
                  }
                  fiatValue={item.fiatValue || undefined}
                  action={
                    asset && reward ? (
                      <WrappedActionButton
                        asset={asset}
                        reward={reward}
                        claimSourceIdentity={resolveUniquePortfolioClaimSourceIdentity(
                          {
                            networkId: ledgerGroup.networkId,
                            providerName: ledgerGroup.provider,
                            vault: item.vault,
                            candidates,
                          },
                        )}
                        rewardSymbol={item.token.info.symbol}
                      />
                    ) : null
                  }
                />
              );
            })}
          </YStack>
        </GroupRow>
      ))}
    </YStack>
  );
}
