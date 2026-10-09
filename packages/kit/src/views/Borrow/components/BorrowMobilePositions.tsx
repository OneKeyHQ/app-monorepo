import type { ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';
import type { IBorrowToken, IEarnText } from '@onekeyhq/shared/types/staking';

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

// Keep a position closer to its actions than to the next card.
const POSITION_CARD_GAP = '$4';

function swapAmountTypography({
  title,
  description,
}: {
  title: IEarnText;
  description: IEarnText;
}): { tokenAmount: IEarnText; fiatValue: IEarnText } {
  return {
    tokenAmount: {
      text: title.text,
      ...(description.size === undefined ? {} : { size: description.size }),
      ...(description.color === undefined ? {} : { color: description.color }),
    },
    fiatValue: {
      text: description.text,
      ...(title.size === undefined ? {} : { size: title.size }),
      ...(title.color === undefined ? {} : { color: title.color }),
    },
  };
}

function PositionCardSkeleton(): ReactElement {
  return (
    <YStack
      bg="$bgSubdued"
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

// Identifies the position within the list it is rendered in, including native
// reserves with an empty address. Deliberately free of the account, network
// and market: the scope reset below owns those, and it knows to sit out the
// blank frames that publishing a scope produces. Carrying them here as well
// made every such frame a new key, which remounted the card and dropped the
// expansion the reset had just been taught to keep.
function getPositionKey({
  kind,
  reserveKey,
}: {
  kind: 'supplied' | 'borrowed';
  reserveKey: string;
}): string {
  return [kind, reserveKey].join('-');
}

export function BorrowMobilePositions({
  eModeId,
  isPending,
}: {
  eModeId?: number;
  /** The home page also knows when the published owner key is unsettled. */
  isPending?: boolean;
}): ReactElement {
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
  // Case-insensitive on EVM only: lowercasing a base58 Solana address can
  // fold two distinct markets onto one scope.
  const normalizedMarketAddress = earnUtils.normalizeBorrowAddress({
    networkId,
    address: marketAddress,
  });
  const hasCollateralControls = Boolean(market && accountId);

  // Collapse the open card when the user moves to a different account, network
  // or market, so the next scope does not inherit the previous one's expansion.
  //
  // Compare against the last scope that actually resolved rather than reacting
  // to every change of these values. A blank accountId is a loading frame, not
  // a different account: BorrowDataGate publishes data: null whenever the
  // derive scope resets or an in-flight market switch is cancelled, and this
  // component stays mounted throughout because the position entries come from
  // reserves alone. Treating that as a scope change would collapse the card on
  // a background event the user never triggered, and it would not come back —
  // exactly the failure this reset exists to prevent, in the other direction.
  // X -> '' -> X is therefore a no-op here, while X -> '' -> Y still collapses.
  //
  // During render rather than in an effect. The key identifies the position
  // alone, so the same asset held under the next account matches the open key:
  // an effect would let that render reach the screen first and flash the card's
  // actions open under a scope the user already left. Adjusting here re-runs
  // the component before anything is committed.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const resolvedScope =
    accountId && networkId && normalizedMarketAddress
      ? [accountId, networkId, normalizedMarketAddress].join('|')
      : null;
  const [lastResolvedScope, setLastResolvedScope] = useState<string | null>(
    null,
  );
  if (resolvedScope !== null && resolvedScope !== lastResolvedScope) {
    setLastResolvedScope(resolvedScope);
    if (lastResolvedScope !== null) {
      setExpandedKey(null);
    }
  }

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
  const reservesPending =
    isPending ?? isBorrowReservesPending(borrowDataStatus);

  // One derivation of each position's identity, shared by the reset below and
  // the list itself. Deriving it twice would mean two copies that have to
  // agree forever, and the day they drifted the reset would start closing
  // cards that are on screen.
  const keyedEntries = entries.map((entry) => {
    const reserveKey = earnUtils.normalizeBorrowAddress({
      networkId,
      address: entry.asset.reserveAddress,
    });
    return {
      entry,
      reserveKey,
      positionKey: getPositionKey({ kind: entry.kind, reserveKey }),
    };
  });

  // Membership flattened to one string, so the effect below fires on a
  // position appearing or leaving rather than on every refresh. Computed per
  // render rather than memoized on `entries`: the list is a handful of items,
  // and keying off its array identity would miss a change delivered in place.
  const presentKeys = keyedEntries
    .map((keyed) => keyed.positionKey)
    .join('\u0000');

  // A position the user left open can go away for good: fully withdrawn, or
  // repaid to zero. Its key would otherwise sit in state and re-open the card
  // by itself if that asset is ever supplied or borrowed again. Only a settled
  // list is evidence of absence — while reserves are pending it says nothing,
  // and collapsing then would be the loading-frame failure the scope reset
  // above already goes out of its way to avoid.
  useEffect(() => {
    if (reservesPending) {
      return;
    }
    const present = new Set(presentKeys ? presentKeys.split('\u0000') : []);
    setExpandedKey((current) =>
      current === null || present.has(current) ? current : null,
    );
  }, [presentKeys, reservesPending]);

  if (reservesPending) {
    return (
      <YStack gap={POSITION_CARD_GAP}>
        <PositionCardSkeleton />
        <PositionCardSkeleton />
      </YStack>
    );
  }

  return (
    <YStack gap={POSITION_CARD_GAP}>
      {keyedEntries.map(({ entry, reserveKey, positionKey }) => {
        const isNativeActionUnsupported = isUnsupportedAaveNativeReserve({
          networkId,
          providerName: market?.provider,
          reserveAddress: entry.asset.reserveAddress,
        });

        const amount =
          entry.kind === 'supplied'
            ? entry.asset.suppliedAmount
            : entry.asset.borrowedAmount;
        const { tokenAmount, fiatValue } = swapAmountTypography(amount);
        let actions: IBorrowPositionCardAction[];
        let collateral: ReactNode = null;

        if (entry.kind === 'supplied') {
          const suppliedAsset = entry.asset;
          const collateralState = getCollateralCellState(suppliedAsset);
          actions = [
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

          if (hasCollateralControls && collateralState !== 'hidden') {
            // The mark carries no text, so this label is the only thing a
            // screen reader has to go on.
            const unavailableLabel = [
              suppliedAsset.token.symbol,
              labels.collateral,
              labels.collateralNotAvailable,
            ].join(', ');
            collateral = (
              <>
                <SizableText size="$bodySm" color="$text" numberOfLines={1}>
                  {labels.collateral}
                </SizableText>
                {collateralState === 'unavailable' ? (
                  // Match the unavailable mark used by the desktop table.
                  <Stack
                    testID={BorrowTestIDs.positionCardCollateralUnavailable(
                      suppliedAsset.reserveAddress,
                    )}
                    // Each target gets only what it reads, and nothing else.
                    // Tamagui renders stacks straight to a div outside native
                    // and maps none of the React Native accessibility props,
                    // so shipping them to a browser would leave the mark
                    // unnamed and land three unknown attributes on the div. A
                    // bare div drops aria-label under ARIA naming rules, hence
                    // the role.
                    {...(platformEnv.isRuntimeBrowser
                      ? { role: 'img' as const, 'aria-label': unavailableLabel }
                      : {
                          accessible: true,
                          accessibilityRole: 'text' as const,
                          accessibilityLabel: unavailableLabel,
                        })}
                  >
                    <CollateralBadge
                      canBeCollateral={false}
                      unavailableBg="$bgStrong"
                    />
                  </Stack>
                ) : (
                  <Stack ml={platformEnv.isNative ? '$-2' : undefined}>
                    <CollateralSwitchCell
                      item={suppliedAsset}
                      eModeId={eModeId}
                      size={ESwitchSize.extraSmall}
                    />
                  </Stack>
                )}
              </>
            );
          }
        } else {
          const borrowedAsset = entry.asset;
          actions = [
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
        }

        return (
          <BorrowPositionCard
            key={positionKey}
            testID={BorrowTestIDs.positionCard(
              entry.kind,
              entry.asset.reserveAddress,
            )}
            actionsTestID={BorrowTestIDs.positionCardActions(
              entry.kind,
              entry.asset.reserveAddress,
            )}
            token={entry.asset.token}
            tokenAmount={tokenAmount}
            fiatValue={fiatValue}
            apyDetail={entry.asset.apyDetail}
            statusLabel={labels[entry.kind]}
            statusBadgeType={entry.kind === 'supplied' ? 'success' : 'critical'}
            platformBonusApy={entry.asset.platformBonusApy}
            collateral={collateral}
            actions={actions}
            isExpanded={expandedKey === positionKey}
            onToggleExpand={() => toggleExpanded(positionKey)}
          />
        );
      })}
    </YStack>
  );
}
