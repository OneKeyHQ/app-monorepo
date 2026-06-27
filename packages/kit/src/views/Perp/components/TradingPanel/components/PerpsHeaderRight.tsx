import { useCallback, useEffect, useMemo, useRef } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  GlassView,
  Icon,
  IconButton,
  SizableText,
  XStack,
  isLiquidGlassAvailable,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletConnectionForWeb } from '@onekeyhq/kit/src/components/TabPageHeader/components/WalletConnectionGroup';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useShowPortfolio } from '@onekeyhq/kit/src/views/Perp/hooks/useShowPortfolio';
import {
  getPerpsAccountDisplaySnapshotEntry,
  perpsActiveAccountAtom,
  perpsActiveAccountStatusAtom,
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
  perpsActiveOrderBookOptionsAtom,
  usePerpsAccountDisplayReadyAtom,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsActiveAccountAtom,
  usePerpsComputedAccountValueAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

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
  return (
    <DebugRenderTracker name="PerpsHeaderRight__DebugButton">
      <IconButton
        testID="perp-debug-button-icon-btn"
        icon="BugSolid"
        size="small"
        variant="tertiary"
        onPress={async () => {
          const [
            simpleDbPerpData,
            activeAccount,
            activeAccountStatus,
            activeAsset,
            activeAssetCtx,
            activeAssetData,
            activeOrderBookOptions,
          ] = await Promise.all([
            backgroundApiProxy.simpleDb.perp.getPerpData(),
            perpsActiveAccountAtom.get(),
            perpsActiveAccountStatusAtom.get(),
            perpsActiveAssetAtom.get(),
            perpsActiveAssetCtxAtom.get(),
            perpsActiveAssetDataAtom.get(),
            perpsActiveOrderBookOptionsAtom.get(),
          ]);
          console.log('PerpsHeaderRight__DebugButton', {
            simpleDbPerpData,
            activeAccount,
            activeAccountStatus,
            activeAsset,
            activeAssetCtx,
            activeAssetData,
            activeOrderBookOptions,
          });
        }}
      />
    </DebugRenderTracker>
  );
}

// Fully-rounded pill matching the Badge's borderRadius="$full"; the Badge fill
// is made transparent so this Liquid Glass material shows through.
const depositGlassStyle = {
  borderRadius: 9999,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

function DepositButton() {
  const { gtSm } = useMedia();
  const theme = useTheme();
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const [displayReady] = usePerpsAccountDisplayReadyAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const { showPortfolio } = useShowPortfolio();
  const lastAccountValueRef = useRef<
    | {
        accountKey: string;
        value: string;
      }
    | undefined
  >(undefined);
  const selectedWalletAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.account?.id
    : undefined;
  const selectedWalletIndexedAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.indexedAccount?.id
    : undefined;
  const activeAccountAddress = activeAccount?.accountAddress?.toLowerCase();
  const isActivePerpsAccountForSelectedWallet =
    !selectedWalletAccount.ready ||
    Boolean(
      selectedWalletAccountId &&
      activeAccount?.accountId &&
      selectedWalletAccountId === activeAccount.accountId,
    ) ||
    Boolean(
      selectedWalletIndexedAccountId &&
      activeAccount?.indexedAccountId &&
      selectedWalletIndexedAccountId === activeAccount.indexedAccountId,
    );
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
  const liveAccountValue = isActivePerpsAccountForSelectedWallet
    ? computedValue?.accountValue
    : undefined;
  const accountValue = isUsingSnapshotValue
    ? snapshotEntry?.accountValue
    : liveAccountValue;
  const accountDisplayKey =
    snapshotEntry?.account.accountAddress?.toLowerCase() ??
    (isActivePerpsAccountForSelectedWallet ? activeAccountAddress : undefined);
  const stableAccountValue =
    accountDisplayKey &&
    lastAccountValueRef.current?.accountKey === accountDisplayKey
      ? lastAccountValueRef.current.value
      : undefined;
  const isUsingStableAccountValue =
    accountValue === undefined && stableAccountValue !== undefined;
  const displayAccountValue = accountValue ?? stableAccountValue;
  const hasActiveAccount = Boolean(
    activeAccount?.accountAddress || snapshotEntry?.account.accountAddress,
  );

  useEffect(() => {
    if (accountDisplayKey && accountValue !== undefined) {
      lastAccountValueRef.current = {
        accountKey: accountDisplayKey,
        value: accountValue,
      };
    }
  }, [accountDisplayKey, accountValue]);

  // Treat unknown as "still loading" rather than "empty" so the green
  // Deposit badge only appears once we definitively know the account is
  // empty. `summaryReady` is true only when the computed atom has finished
  // loading AND summary belongs to the current address (live or hydrated
  // from display cache), so a cache-hit cold start renders the value
  // without first flashing a skeleton.
  const isUnknownAccountValue = displayAccountValue === undefined;
  const shouldDisplayAccountValueDuringLoading =
    displayAccountValue !== undefined;
  const isEmptyAccount =
    !isUnknownAccountValue && new BigNumber(displayAccountValue ?? '0').lte(0);
  let badgeVariant: 'unknown' | 'deposit' | 'portfolio' = 'portfolio';
  if (isUnknownAccountValue) {
    badgeVariant = 'unknown';
  } else if (isEmptyAccount) {
    badgeVariant = 'deposit';
  }

  useEffect(() => {
    tracePerpsMobileLayout('header.depositBadge.state', {
      hasActiveAccount,
      hasAccountValue: Boolean(displayAccountValue),
      isEmptyAccount,
      isUnknownAccountValue,
      isUsingStableAccountValue,
      isUsingSnapshotValue,
      height: gtSm ? 30 : 28,
      variant: badgeVariant,
    });
  }, [
    badgeVariant,
    displayAccountValue,
    gtSm,
    hasActiveAccount,
    isEmptyAccount,
    isUnknownAccountValue,
    isUsingStableAccountValue,
    isUsingSnapshotValue,
  ]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('header.depositBadge.layout', {
          rect,
          hasActiveAccount,
          hasAccountValue: Boolean(displayAccountValue),
          isEmptyAccount,
          isUnknownAccountValue,
          isUsingStableAccountValue,
          isUsingSnapshotValue,
          variant: badgeVariant,
        });
        layoutRef.current = rect;
      }
    },
    [
      badgeVariant,
      displayAccountValue,
      hasActiveAccount,
      isEmptyAccount,
      isUnknownAccountValue,
      isUsingStableAccountValue,
      isUsingSnapshotValue,
    ],
  );

  if (!hasActiveAccount) {
    return null;
  }

  // iOS 26: host the balance pill in a Liquid Glass capsule. The Deposit CTA
  // keeps its green as a green-tinted glass; the balance/unknown states use the
  // neutral material. Off iOS 26 (every other platform) this stays the original
  // solid Badge.
  const glassActive = isLiquidGlassAvailable();
  const nonGlassBg = isEmptyAccount ? '$brand8' : '$bgStrong';
  const badge = (
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
      // In the glass capsule, drop the solid fill (the glass provides it) and
      // the press/hover feedback (the glass material handles it).
      bg={glassActive ? '$transparent' : nonGlassBg}
      cursor="default"
      onLayout={handleLayout}
      {...(glassActive && { hoverStyle: undefined, pressStyle: undefined })}
    >
      {(() => {
        if (isUnknownAccountValue) {
          return (
            <>
              <Icon name="ChartLine2Outline" size="$4" />
              <SizableText size="$bodySmMedium" color="$textSubdued">
                --
              </SizableText>
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
              value={displayAccountValue ?? ''}
              skeletonWidth={60}
              textSize="$bodySmMedium"
              allowValueDuringAccountLoading={
                shouldDisplayAccountValueDuringLoading
              }
              skipAccountSummaryCheck={shouldDisplayAccountValueDuringLoading}
            />
          </>
        );
      })()}
    </Badge>
  );
  const content = glassActive ? (
    <GlassView
      isInteractive
      glassEffectStyle="regular"
      // Deposit CTA → green-tinted glass; balance/unknown → neutral glass.
      {...(isEmptyAccount && { tintColor: theme.brand8?.val })}
      style={depositGlassStyle}
    >
      {badge}
    </GlassView>
  ) : (
    badge
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
