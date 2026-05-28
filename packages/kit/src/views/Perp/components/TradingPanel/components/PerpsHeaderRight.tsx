import { useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletConnectionForWeb } from '@onekeyhq/kit/src/components/TabPageHeader/components/WalletConnectionGroup';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
  usePerpsAllAssetCtxsAtom,
  usePerpsAllMidsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useShowPortfolio } from '@onekeyhq/kit/src/views/Perp/hooks/useShowPortfolio';
import {
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAccountDisplayReadyAtom,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsActiveOrderBookOptionsAtom,
  usePerpsComputedAccountValueAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

import { usePerpsAssetCtx } from '../../../hooks/usePerpsAssetCtx';
import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { PerpTestIDs } from '../../../testIDs';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../../../utils/mobileLayoutTrace';
import { PerpGuidePopover } from '../../Guide/PerpGuidePopover';
import { PerpsActivityCenterAction } from '../../PerpsActivityCenterAction';
import { PerpSettingsButton } from '../../PerpSettingsButton';

import { PerpsAccountNumberValue } from './PerpsAccountNumberValue';

import type { LayoutChangeEvent } from 'react-native';

function DebugButton() {
  const [allMids] = usePerpsAllMidsAtom();
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();
  const { assetCtx: btcAssetCtx } = usePerpsAssetCtx({ assetId: 0 });
  const { mid: btcMid, midFormattedByDecimals: btcMidFormattedByDecimals } =
    usePerpsMidPrice({ coin: 'BTC' });

  const [activeAccount] = usePerpsActiveAccountAtom();
  const [activeAccountSummary] = usePerpsActiveAccountSummaryAtom();
  const [activeAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [activeOpenOrders] = usePerpsActiveOpenOrdersAtom();
  const [activePositions] = usePerpsActivePositionAtom();
  const [activeOrderBookOptions] = usePerpsActiveOrderBookOptionsAtom();

  return (
    <DebugRenderTracker name="PerpsHeaderRight__DebugButton">
      <IconButton
        testID="perp-debug-button-icon-btn"
        icon="BugSolid"
        size="small"
        variant="tertiary"
        onPress={async () => {
          const simpleDbPerpData =
            await backgroundApiProxy.simpleDb.perp.getPerpData();
          console.log('PerpsHeaderRight__DebugButton', {
            simpleDbPerpData,
            allMids,
            allAssetCtxs,
            btcAssetCtx,
            btcMidFormattedByDecimals,
            btcMid,
            activeAccount,
            activeAccountSummary,
            activeAsset,
            activeAssetCtx,
            activeAssetData,
            activeOpenOrders,
            activePositions,
            activeOrderBookOptions,
            activeAccountStatus,
            isAgentReady,
          });
        }}
      />
    </DebugRenderTracker>
  );
}

function DepositButton() {
  const { gtSm } = useMedia();
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const [displayReady] = usePerpsAccountDisplayReadyAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const { showPortfolio } = useShowPortfolio();
  const snapshotLookupIndexedAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.indexedAccount?.id
    : activeAccount?.indexedAccountId;
  const snapshotLookupAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.account?.id
    : activeAccount?.accountId;
  const snapshotLookupAccountAddress =
    !selectedWalletAccount.ready ||
    snapshotLookupIndexedAccountId ||
    snapshotLookupAccountId
      ? activeAccount?.accountAddress
      : undefined;
  const snapshotEntry = useMemo(
    () =>
      getPerpsAccountDisplaySnapshotEntry({
        snapshot: displaySnapshot,
        accountAddress: snapshotLookupAccountAddress,
        indexedAccountId: snapshotLookupIndexedAccountId,
        accountId: snapshotLookupAccountId,
        deriveType:
          selectedWalletAccount.deriveType ?? activeAccount.deriveType,
      }),
    [
      activeAccount?.deriveType,
      displaySnapshot,
      selectedWalletAccount.deriveType,
      snapshotLookupAccountAddress,
      snapshotLookupAccountId,
      snapshotLookupIndexedAccountId,
    ],
  );
  const isUsingSnapshotValue =
    !displayReady.summaryReady && snapshotEntry?.accountValue !== undefined;
  const accountValue = isUsingSnapshotValue
    ? snapshotEntry?.accountValue
    : computedValue?.accountValue;
  const hasActiveAccount = Boolean(
    activeAccount?.accountAddress || snapshotEntry?.account.accountAddress,
  );

  // Treat unknown as "still loading" rather than "empty" so the green
  // Deposit badge only appears once we definitively know the account is
  // empty. `summaryReady` is true only when the computed atom has finished
  // loading AND summary belongs to the current address (live or hydrated
  // from display cache), so a cache-hit cold start renders the value
  // without first flashing a skeleton.
  const isUnknownAccountValue = accountValue === undefined;
  const isEmptyAccount =
    !isUnknownAccountValue && new BigNumber(accountValue ?? '0').lte(0);
  let badgeVariant: 'unknown' | 'deposit' | 'portfolio' = 'portfolio';
  if (isUnknownAccountValue) {
    badgeVariant = 'unknown';
  } else if (isEmptyAccount) {
    badgeVariant = 'deposit';
  }

  useEffect(() => {
    tracePerpsMobileLayout('header.depositBadge.state', {
      hasActiveAccount,
      hasAccountValue: Boolean(accountValue),
      isEmptyAccount,
      isUnknownAccountValue,
      isUsingSnapshotValue,
      height: gtSm ? 30 : 28,
      variant: badgeVariant,
    });
  }, [
    accountValue,
    badgeVariant,
    gtSm,
    hasActiveAccount,
    isEmptyAccount,
    isUnknownAccountValue,
    isUsingSnapshotValue,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('header.depositBadge.layout', {
          rect,
          hasActiveAccount,
          hasAccountValue: Boolean(accountValue),
          isEmptyAccount,
          isUnknownAccountValue,
          isUsingSnapshotValue,
          variant: badgeVariant,
        });
        layoutRef.current = rect;
      }
    },
    [
      accountValue,
      badgeVariant,
      hasActiveAccount,
      isEmptyAccount,
      isUnknownAccountValue,
      isUsingSnapshotValue,
    ],
  );

  if (!hasActiveAccount) {
    return null;
  }

  const content = (
    <Badge
      borderRadius="$full"
      size="medium"
      variant={isEmptyAccount ? 'primary' : 'secondary'}
      testID={PerpTestIDs.PortfolioButton}
      onPress={showPortfolio}
      alignItems="center"
      justifyContent="center"
      flexDirection="row"
      gap="$2"
      px="$3"
      h={gtSm ? 30 : 28}
      bg={isEmptyAccount ? '$brand8' : '$bgStrong'}
      cursor="default"
      onLayout={handleLayout}
    >
      {(() => {
        if (isUnknownAccountValue) {
          return (
            <>
              <Icon name="ChartLine2Outline" size="$4" />
              <Skeleton width={60} height={16} />
            </>
          );
        }
        if (isEmptyAccount) {
          return (
            <>
              <Icon name="AlignBottomOutline" size="$4" color="$iconOnColor" />
              <SizableText size="$bodySmMedium" color="$textOnColor">
                {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
              </SizableText>
            </>
          );
        }
        return (
          <>
            <Icon name="ChartLine2Outline" size="$4" />
            <PerpsAccountNumberValue
              value={accountValue ?? ''}
              skeletonWidth={60}
              textSize="$bodySmMedium"
              allowValueDuringAccountLoading={isUsingSnapshotValue}
              skipAccountSummaryCheck={isUsingSnapshotValue}
            />
          </>
        );
      })()}
    </Badge>
  );
  return (
    <DebugRenderTracker name="PerpsHeaderRight__DepositButton">
      {content}
    </DebugRenderTracker>
  );
}

export function PerpsHeaderRight() {
  const { gtMd } = useMedia();
  const content = (
    <XStack alignItems="center" gap="$5">
      <WalletConnectionForWeb tabRoute={ETabRoutes.Perp} />
      {process.env.NODE_ENV !== 'production' ? <DebugButton /> : null}
      <DepositButton />
      {(() => {
        if (platformEnv.isWebDappMode) return null;
        if (gtMd) {
          return (
            <>
              <PerpsActivityCenterAction copyAsUrl />
              <PerpGuidePopover />
              <PerpSettingsButton testID={PerpTestIDs.HeaderSettingsButton} />
            </>
          );
        }
        return null;
      })()}
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpsHeaderRight" position="bottom-center">
      {content}
    </DebugRenderTracker>
  );
}
