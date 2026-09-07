import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  ESwitchSize,
  SizableText,
  Skeleton,
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
        <YStack ai="flex-end" gap="$1">
          <Skeleton w={70} h="$5" borderRadius="$2" />
          <Skeleton w={50} h="$4" borderRadius="$2" />
        </YStack>
      </XStack>
    </YStack>
  );
}

function getPositionKey(kind: 'supplied' | 'borrowed', reserveAddress: string) {
  return `${kind}-${reserveAddress}`;
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
      useAsCollateral: intl.formatMessage({
        id: ETranslations.defi_use_as_collateral,
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
          const positionKey = getPositionKey(
            'supplied',
            suppliedAsset.reserveAddress,
          );
          const actions: IBorrowPositionCardAction[] = [
            {
              key: 'withdraw',
              label: labels.withdraw,
              variant: 'secondary',
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
                hasCollateralControls &&
                suppliedAsset.usageAsCollateral !== undefined ? (
                  <>
                    <SizableText size="$bodySm" color="$text">
                      {labels.useAsCollateral}
                    </SizableText>
                    <CollateralSwitchCell
                      item={suppliedAsset}
                      eModeId={eModeId}
                      size={ESwitchSize.small}
                    />
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
        const positionKey = getPositionKey(
          'borrowed',
          borrowedAsset.reserveAddress,
        );
        const actions: IBorrowPositionCardAction[] = [
          {
            key: 'repay',
            label: labels.repay,
            variant: 'secondary',
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
