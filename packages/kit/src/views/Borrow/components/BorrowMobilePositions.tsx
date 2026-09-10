import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  ESwitchSize,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowEModeStatus,
  IBorrowToken,
} from '@onekeyhq/shared/types/staking';

import { isBorrowReservesPending } from '../borrowDataStatus';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowPositionEntries } from '../hooks/useBorrowPositionEntries';
import { BorrowTestIDs } from '../testIDs';

import { BorrowPositionCard } from './BorrowPositionCard';
import { isUnsupportedAaveNativeReserve } from './borrowRepayPosition.utils';
import { CollateralBadge } from './BorrowTableList/CollateralBadge';
import { getCollateralCellState } from './collateralControls.utils';
import { CollateralSwitchCell } from './CollateralSwitchCell';

import type { IBorrowPositionCardAction } from './BorrowPositionCard';

function buildDisabledByReserve<T extends { reserveAddress: string }>(
  assets: T[] | undefined,
  networkId: string,
  isDisabled: (asset: T) => boolean,
) {
  const map = new Map<string, boolean>();
  (assets ?? []).forEach((asset) => {
    map.set(
      earnUtils.normalizeBorrowAddress({
        networkId,
        address: asset.reserveAddress,
      }),
      isDisabled(asset),
    );
  });
  return map;
}

function PositionCardSkeleton() {
  return (
    <YStack
      bg="$bgApp"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      p="$3"
      gap="$2"
    >
      <XStack ai="center" jc="space-between" gap="$3">
        <Skeleton w={110} h="$5" borderRadius="$2" />
        <Skeleton w={120} h="$6" borderRadius="$2" />
      </XStack>
      <XStack ai="center" gap="$3" py="$2">
        <Skeleton w="$10" h="$10" borderRadius="$full" />
        <YStack flex={1} gap="$1">
          <Skeleton w={80} h="$4" borderRadius="$2" />
        </YStack>
        <XStack ai="center" gap="$2">
          <YStack ai="flex-end" gap="$1">
            <Skeleton w={70} h="$5" borderRadius="$2" />
            <Skeleton w={50} h="$4" borderRadius="$2" />
          </YStack>
          <Skeleton w="$5" h="$5" borderRadius="$2" />
        </XStack>
      </XStack>
    </YStack>
  );
}

// Aave native reserves carry an empty reserveAddress, so the address alone is
// not an identity: the same `supplied-` key would match a different market's
// native card, and the list is not remounted when the market or account
// changes. Scope the key to both, and reuse the normalized address so a
// checksum-cased refresh does not silently collapse the open card.
function getPositionKey({
  kind,
  accountId,
  networkId,
  marketAddress,
  reserveKey,
}: {
  kind: 'supplied' | 'borrowed';
  accountId: string;
  networkId: string;
  marketAddress: string;
  reserveKey: string;
}) {
  return [
    kind,
    accountId,
    networkId,
    marketAddress.toLowerCase(),
    reserveKey,
  ].join('-');
}

export function BorrowMobilePositions({
  eModeStatus,
}: {
  eModeStatus?: IBorrowEModeStatus | null;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { reserves, market, borrowDataStatus, earnAccount } =
    useBorrowContext();
  // One card at a time: tapping another position replaces the open one.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKey((current) => (current === key ? null : key));
  }, []);

  const accountId = earnAccount.data?.account?.id || '';
  const indexedAccountId = earnAccount.data?.account?.indexedAccountId;
  const networkId = market?.networkId ?? '';
  const marketAddress = market?.marketAddress ?? '';
  const eModeId = eModeStatus?.eModeId;
  const hasCollateralControls = Boolean(market && accountId);

  const labels = useMemo(
    () => ({
      supplied: intl.formatMessage({
        id: ETranslations.wallet_defi_asset_type_supplied,
      }),
      borrowed: intl.formatMessage({
        id: ETranslations.wallet_defi_asset_type_borrowed,
      }),
      supply: intl.formatMessage({ id: ETranslations.defi_supply }),
      withdraw: intl.formatMessage({ id: ETranslations.global_withdraw }),
      borrow: intl.formatMessage({ id: ETranslations.global_borrow }),
      repay: intl.formatMessage({ id: ETranslations.defi_repay }),
      collateral: intl.formatMessage({ id: ETranslations.defi_collateral }),
      collateralNotAvailable: intl.formatMessage({
        id: ETranslations.global_not_available,
      }),
    }),
    [intl],
  );

  const openManagePosition = useCallback(
    (
      asset: { reserveAddress: string; token: IBorrowToken },
      type: EManagePositionType,
    ) => {
      if (!market) return;
      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId,
        indexedAccountId,
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: asset.reserveAddress,
        symbol: asset.token.symbol,
        providerLogoURI: market.logoURI,
        logoURI: asset.token.logoURI,
        type,
      });
    },
    [accountId, indexedAccountId, market, navigation],
  );

  // An absent server flag is not a disabled verdict.
  const supplyDisabledByReserve = useMemo(
    () =>
      buildDisabledByReserve(
        reserves.data?.supply?.assets,
        networkId,
        (asset) => asset.supplyButton?.disabled === true,
      ),
    [networkId, reserves.data?.supply?.assets],
  );

  const borrowDisabledByReserve = useMemo(
    () =>
      buildDisabledByReserve(
        reserves.data?.borrow?.assets,
        networkId,
        (asset) =>
          asset.borrowButton?.disabled === true ||
          asset.canBeBorrowed === false,
      ),
    [networkId, reserves.data?.borrow?.assets],
  );

  const entries = useBorrowPositionEntries();

  if (isBorrowReservesPending(borrowDataStatus)) {
    return (
      <YStack gap="$3">
        <PositionCardSkeleton />
        <PositionCardSkeleton />
      </YStack>
    );
  }

  return (
    <YStack gap="$3">
      {entries.map((entry) => {
        const reserveKey = earnUtils.normalizeBorrowAddress({
          networkId,
          address: entry.asset.reserveAddress,
        });
        const isNativeActionUnsupported = isUnsupportedAaveNativeReserve({
          networkId,
          providerName: market?.provider,
          reserveAddress: entry.asset.reserveAddress,
        });

        if (entry.kind === 'supplied') {
          const suppliedAsset = entry.asset;
          const collateralState = getCollateralCellState(suppliedAsset);
          const positionKey = getPositionKey({
            kind: 'supplied',
            accountId,
            networkId,
            marketAddress,
            reserveKey,
          });
          const actions: IBorrowPositionCardAction[] = [
            {
              key: 'withdraw',
              label: labels.withdraw,
              variant: 'secondary',
              testID: BorrowTestIDs.positionCardAction(
                'supplied',
                suppliedAsset.reserveAddress,
                'withdraw',
              ),
              disabled:
                isNativeActionUnsupported ||
                suppliedAsset.withdrawButton?.disabled === true,
              onPress: () =>
                openManagePosition(suppliedAsset, EManagePositionType.Withdraw),
            },
            {
              key: 'supply',
              label: labels.supply,
              variant: 'primary',
              testID: BorrowTestIDs.positionCardAction(
                'supplied',
                suppliedAsset.reserveAddress,
                'supply',
              ),
              disabled:
                isNativeActionUnsupported ||
                supplyDisabledByReserve.get(reserveKey) === true,
              onPress: () =>
                openManagePosition(suppliedAsset, EManagePositionType.Supply),
            },
          ];

          return (
            <BorrowPositionCard
              key={positionKey}
              testID={BorrowTestIDs.positionCard(
                'supplied',
                suppliedAsset.reserveAddress,
              )}
              actionsTestID={BorrowTestIDs.positionCardActions(
                'supplied',
                suppliedAsset.reserveAddress,
              )}
              token={suppliedAsset.token}
              tokenAmount={suppliedAsset.suppliedAmount.title}
              fiatValue={suppliedAsset.suppliedAmount.description}
              apyDetail={suppliedAsset.apyDetail}
              statusLabel={labels.supplied}
              statusBadgeType="success"
              platformBonusApy={suppliedAsset.platformBonusApy}
              collateral={
                hasCollateralControls && collateralState !== 'hidden' ? (
                  <>
                    <SizableText size="$bodySm" color="$text" numberOfLines={1}>
                      {labels.collateral}
                    </SizableText>
                    {collateralState === 'unavailable' ? (
                      // The kit already stamps "this capability is not
                      // available for this asset" as a gray dash chip —
                      // CollateralBadge in the desktop table, CapabilityBadge
                      // in the e-mode table. Reuse the mark and leave the
                      // words to the accessibility label, the way the e-mode
                      // table does, instead of spending a third vocabulary on
                      // the state 23 of 40 mainnet reserves are in.
                      <Stack
                        testID={BorrowTestIDs.positionCardCollateralUnavailable(
                          suppliedAsset.reserveAddress,
                        )}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={[
                          suppliedAsset.token.symbol,
                          labels.collateral,
                          labels.collateralNotAvailable,
                        ].join(', ')}
                      >
                        <CollateralBadge canBeCollateral={false} />
                      </Stack>
                    ) : (
                      <CollateralSwitchCell
                        item={suppliedAsset}
                        eModeId={eModeId}
                        size={ESwitchSize.small}
                      />
                    )}
                  </>
                ) : null
              }
              actions={actions}
              isExpanded={expandedKey === positionKey}
              onToggleExpand={() => toggleExpanded(positionKey)}
            />
          );
        }

        const borrowedAsset = entry.asset;
        const positionKey = getPositionKey({
          kind: 'borrowed',
          accountId,
          networkId,
          marketAddress,
          reserveKey,
        });
        const actions: IBorrowPositionCardAction[] = [
          {
            key: 'repay',
            label: labels.repay,
            variant: 'secondary',
            testID: BorrowTestIDs.positionCardAction(
              'borrowed',
              borrowedAsset.reserveAddress,
              'repay',
            ),
            disabled:
              isNativeActionUnsupported ||
              borrowedAsset.repayButton?.disabled === true,
            onPress: () =>
              openManagePosition(borrowedAsset, EManagePositionType.Repay),
          },
          {
            key: 'borrow',
            label: labels.borrow,
            variant: 'primary',
            testID: BorrowTestIDs.positionCardAction(
              'borrowed',
              borrowedAsset.reserveAddress,
              'borrow',
            ),
            disabled:
              isNativeActionUnsupported ||
              borrowDisabledByReserve.get(reserveKey) === true,
            onPress: () =>
              openManagePosition(borrowedAsset, EManagePositionType.Borrow),
          },
        ];

        return (
          <BorrowPositionCard
            key={positionKey}
            testID={BorrowTestIDs.positionCard(
              'borrowed',
              borrowedAsset.reserveAddress,
            )}
            actionsTestID={BorrowTestIDs.positionCardActions(
              'borrowed',
              borrowedAsset.reserveAddress,
            )}
            token={borrowedAsset.token}
            tokenAmount={borrowedAsset.borrowedAmount.title}
            fiatValue={borrowedAsset.borrowedAmount.description}
            apyDetail={borrowedAsset.apyDetail}
            statusLabel={labels.borrowed}
            statusBadgeType="critical"
            platformBonusApy={borrowedAsset.platformBonusApy}
            actions={actions}
            isExpanded={expandedKey === positionKey}
            onToggleExpand={() => toggleExpanded(positionKey)}
          />
        );
      })}
    </YStack>
  );
}
