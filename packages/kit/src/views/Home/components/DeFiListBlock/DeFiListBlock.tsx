import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { useAccountDeFiOverviewAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useDeFiListProtocolMapAtom,
  useDeFiListProtocolsAtom,
  useDeFiListSlicedAtom,
  useDeFiListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { buildProtocolDisplayInfo } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';

import { RichBlock } from '../RichBlock/RichBlock';

import { shouldShowDeFiEmptyState } from './deFiListLoadingReducer';
import { DeFiListSkeleton } from './DeFiListSkeleton';
import { getOverviewCollapsedProtocolLimit } from './DeFiOverviewPlanner';
import { formatPortfolioTotal } from './formatPortfolioTotal';
import { useDeFiListAllNetworkData } from './hooks/useDeFiListAllNetworkData';
import { useDeFiListRefresh } from './hooks/useDeFiListRefresh';
import { useDeFiListSingleNetworkData } from './hooks/useDeFiListSingleNetworkData';
import { useDeFiListSupportedActions } from './hooks/useDeFiListSupportedActions';
import { buildDeFiOverviewCells } from './hooks/useDeFiOverviewTopN';
import { resolveOverviewCols } from './overviewColsResolver';
import { type IProtocolHandle, Protocol } from './Protocol';
import { useIsDeFiEnabled } from './useIsDeFiEnabled';

const MAX_PROTOCOLS_ON_SMALL_SCREEN = 6;
const PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS = 600;

function buildDeFiListOwnerKey({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId?: string;
}) {
  if (!accountId || !networkId) return undefined;
  return `${accountId}:${networkId}`;
}

function MobileProtocolDivider() {
  return (
    <YStack px="$5" py="$1.5">
      <Divider borderColor="$borderSubdued" />
    </YStack>
  );
}

export type IDeFiListBlockProps = {
  refreshCacheOnly?: boolean;
  tableLayout?: boolean;
  /**
   * Desktop: when `true`, the internal "DeFi · $total" header row is not
   * rendered — the parent mounts DeFiAllocationCard (which carries the total)
   * alongside the overview grid instead.
   */
  hideInternalTitle?: boolean;
  isDeFiEnabled?: boolean;
  registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
  onCollapseToProtocol?: (protocol: IDeFiProtocol) => void;
};

const ProtocolListItem = memo(
  ({
    isAllNetworks,
    isLast,
    protocol,
    protocolKey,
    accountId,
    indexedAccountId,
    registerProtocol,
    tableLayout,
    onActionSuccess,
  }: {
    isAllNetworks?: boolean;
    isLast: boolean;
    protocol: IDeFiProtocol;
    protocolKey: string;
    accountId?: string;
    indexedAccountId?: string;
    registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
    tableLayout?: boolean;
    onActionSuccess?: (
      params: IProtocolPositionActionSuccessParams,
    ) => void | Promise<void>;
  }) => {
    const handleProtocolRef = useCallback(
      (handle: IProtocolHandle | null) => {
        registerProtocol?.(protocolKey, handle);
      },
      [protocolKey, registerProtocol],
    );

    return (
      <YStack key={`${protocol.networkId}-${protocol.protocol}`}>
        <Protocol
          ref={registerProtocol ? handleProtocolRef : undefined}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          protocol={protocol}
          tableLayout={tableLayout}
          isAllNetworks={isAllNetworks}
          onActionSuccess={onActionSuccess}
        />
        {!tableLayout && !isLast ? <MobileProtocolDivider /> : null}
      </YStack>
    );
  },
);
ProtocolListItem.displayName = 'ProtocolListItem';

function DeFiListBlock({
  refreshCacheOnly = false,
  tableLayout,
  hideInternalTitle = false,
  isDeFiEnabled: isDeFiEnabledProp,
  registerProtocol,
  onCollapseToProtocol,
}: IDeFiListBlockProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();

  const sourceCurrencyInfo = useMemo(
    () => currencyMap[settings.currencyInfo.id],
    [settings.currencyInfo.id, currencyMap],
  );
  const targetCurrencyInfo = useMemo(() => currencyMap.usd, [currencyMap]);

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const [overview] = useAccountDeFiOverviewAtom();
  const [{ isRefreshing, initialized, loadedOwnerKey }] =
    useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const media = useMedia();

  const [isSliced, setIsSliced] = useDeFiListSlicedAtom();
  const overviewCols = useMemo(
    () =>
      resolveOverviewCols({
        gtXl: media.gtXl,
        gtLg: media.gtLg,
      }),
    [media.gtXl, media.gtLg],
  );
  const maxProtocolsOnLargeScreen = useMemo(
    () =>
      getOverviewCollapsedProtocolLimit({
        cols: overviewCols,
        protocolCount: protocols.length,
      }),
    [overviewCols, protocols.length],
  );
  const overflowThreshold = tableLayout
    ? maxProtocolsOnLargeScreen
    : MAX_PROTOCOLS_ON_SMALL_SCREEN;
  const isOverflow = protocols.length > overflowThreshold;

  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const currentOwnerKey = useMemo(
    () =>
      buildDeFiListOwnerKey({
        accountId: account?.id,
        networkId: network?.id,
      }),
    [account?.id, network?.id],
  );

  const pendingManualForceRefreshIntentRef = useRef<
    | {
        ownerKey: string;
      }
    | undefined
  >(undefined);
  const prepareManualDeFiForceRefresh = useCallback(
    (payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate]) => {
      if (!payload?.isManualRefresh || refreshCacheOnly || !currentOwnerKey) {
        return;
      }
      pendingManualForceRefreshIntentRef.current = {
        ownerKey: currentOwnerKey,
      };
    },
    [currentOwnerKey, refreshCacheOnly],
  );
  const consumePendingManualForceRefreshIntent = useCallback(async () => {
    const intent = pendingManualForceRefreshIntentRef.current;
    if (!intent) return false;
    pendingManualForceRefreshIntentRef.current = undefined;
    if (!currentOwnerKey || intent.ownerKey !== currentOwnerKey) return false;
    try {
      const { allowed } =
        await backgroundApiProxy.serviceDeFi.consumeManualDeFiForceRefreshQuota();
      return allowed;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [currentOwnerKey]);

  const computedIsDeFiEnabled = useIsDeFiEnabled(
    network?.id,
    isDeFiEnabledProp === undefined,
  );
  const isDeFiEnabled = isDeFiEnabledProp ?? computedIsDeFiEnabled;

  const { run, refreshSingleNetworkDeFiOverviewByTarget } =
    useDeFiListSingleNetworkData({
      account,
      network,
      refreshCacheOnly,
      isFocused,
      isDeFiEnabled,
      currentOwnerKey,
      settingsCurrencyId: settings.currencyInfo.id,
      currencyMap,
      sourceCurrencyInfo,
      targetCurrencyInfo,
      consumePendingManualForceRefreshIntent,
      setIsHeaderRefreshing,
    });
  const { handleRefreshAllNetworkData } = useDeFiListAllNetworkData({
    account,
    network,
    wallet,
    refreshCacheOnly,
    isDeFiEnabled,
    currentOwnerKey,
    settingsCurrencyId: settings.currencyInfo.id,
    currencyMap,
    sourceCurrencyInfo,
    targetCurrencyInfo,
    consumePendingManualForceRefreshIntent,
    setIsHeaderRefreshing,
  });
  useDeFiListSupportedActions({
    refreshCacheOnly,
    isFocused,
    isDeFiEnabled,
  });
  const { handleActionSuccess } = useDeFiListRefresh({
    account,
    network,
    protocols,
    protocolMap,
    refreshCacheOnly,
    isFocused,
    isHeaderRefreshing,
    currentOwnerKey,
    settingsCurrencyId: settings.currencyInfo.id,
    prepareManualDeFiForceRefresh,
    run,
    handleRefreshAllNetworkData,
    refreshSingleNetworkDeFiOverviewByTarget,
  });

  const filteredProtocols = useMemo(() => {
    // Keep the mounted list in the same exposure order as the overview tiles,
    // so every collapsed overview tile can scroll to an existing protocol row.
    const sorted = buildDeFiOverviewCells(protocols, (protocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: protocol.protocol,
        networkId: protocol.networkId,
      });
      const info = buildProtocolDisplayInfo({
        protocol,
        protocolInfo: protocolMap[key],
      });
      const nw = new BigNumber(info.netWorth);
      return nw.isFinite() ? nw.toNumber() : 0;
    }).map((e) => e.protocol);

    if (isOverflow && isSliced) {
      const limit = tableLayout
        ? maxProtocolsOnLargeScreen
        : MAX_PROTOCOLS_ON_SMALL_SCREEN;
      return sorted.slice(0, limit);
    }
    return sorted;
  }, [
    protocols,
    protocolMap,
    isOverflow,
    isSliced,
    tableLayout,
    maxProtocolsOnLargeScreen,
  ]);

  const protocolListLockUntilRef = useRef(0);
  const protocolListUnlockTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [isProtocolListInteractionLocked, setIsProtocolListInteractionLocked] =
    useState(false);

  const isProtocolListLocked = useCallback(
    () => protocolListLockUntilRef.current > Date.now(),
    [],
  );
  const lockProtocolListInteractions = useCallback(() => {
    protocolListLockUntilRef.current =
      Date.now() + PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS;
    setIsProtocolListInteractionLocked(true);

    if (protocolListUnlockTimerRef.current) {
      clearTimeout(protocolListUnlockTimerRef.current);
    }
    protocolListUnlockTimerRef.current = setTimeout(() => {
      protocolListUnlockTimerRef.current = null;
      setIsProtocolListInteractionLocked(false);
    }, PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (protocolListUnlockTimerRef.current) {
        clearTimeout(protocolListUnlockTimerRef.current);
      }
    };
  }, []);

  const getCollapsedBottomProtocol = useCallback(() => {
    const limit = Math.min(overflowThreshold, filteredProtocols.length);
    return filteredProtocols[limit - 1];
  }, [filteredProtocols, overflowThreshold]);

  const handleToggleSliced = useCallback(() => {
    if (isProtocolListLocked()) return;
    const targetProtocol = isSliced ? undefined : getCollapsedBottomProtocol();
    lockProtocolListInteractions();
    setIsSliced(!isSliced);
    if (targetProtocol) {
      onCollapseToProtocol?.(targetProtocol);
    }
  }, [
    isSliced,
    getCollapsedBottomProtocol,
    isProtocolListLocked,
    lockProtocolListInteractions,
    onCollapseToProtocol,
    setIsSliced,
  ]);

  const renderSubTitle = useCallback(() => {
    if (!initialized && isRefreshing) {
      // w=120 widens the preset's default 103 px to better approximate
      // a typical "$XX,XXX.XX" measurement; same width as DeFiContainer
      // for one canonical loading shape across both surfaces.
      return <Skeleton.HeadingXl w={120} />;
    }

    return (
      <SizableText
        size="$headingXl"
        color={tableLayout ? '$textSubdued' : '$text'}
      >
        {formatPortfolioTotal(
          Number(overview.netWorth) || 0,
          settings.currencyInfo.symbol,
          settingsValue.hideValue,
        )}
      </SizableText>
    );
  }, [
    settings.currencyInfo.symbol,
    settingsValue.hideValue,
    overview.netWorth,
    initialized,
    isRefreshing,
    tableLayout,
  ]);
  const renderContent = useCallback(() => {
    return (
      <>
        <YStack
          gap={tableLayout ? '$5' : '$0'}
          pt={tableLayout ? '$0' : '$1'}
          flex={platformEnv.isNative ? 1 : undefined}
          pointerEvents={isProtocolListInteractionLocked ? 'none' : undefined}
        >
          {filteredProtocols.map((protocol, index) => {
            const protocolKey = defiUtils.buildProtocolMapKey({
              protocol: protocol.protocol,
              networkId: protocol.networkId,
            });
            return (
              <ProtocolListItem
                key={`${protocol.networkId}-${protocol.protocol}`}
                isAllNetworks={network?.isAllNetworks}
                isLast={index === filteredProtocols.length - 1}
                protocol={protocol}
                protocolKey={protocolKey}
                accountId={account?.id}
                indexedAccountId={account?.indexedAccountId}
                registerProtocol={registerProtocol}
                tableLayout={tableLayout}
                onActionSuccess={handleActionSuccess}
              />
            );
          })}
        </YStack>
        {isOverflow ? (
          <XStack
            alignItems="center"
            justifyContent="center"
            pt="$4"
            px="$pagePadding"
          >
            <Button
              testID="home-render-content-btn"
              size="small"
              variant="secondary"
              disabled={isProtocolListInteractionLocked}
              onPress={handleToggleSliced}
              $md={
                {
                  flexGrow: 1,
                  flexBasis: 0,
                  size: 'medium',
                  borderRadius: '$full',
                } as any
              }
            >
              {isSliced
                ? intl.formatMessage({ id: ETranslations.global_show_more })
                : intl.formatMessage({ id: ETranslations.global_show_less })}
            </Button>
          </XStack>
        ) : null}
      </>
    );
  }, [
    filteredProtocols,
    account?.id,
    account?.indexedAccountId,
    tableLayout,
    network?.isAllNetworks,
    intl,
    isOverflow,
    isSliced,
    isProtocolListInteractionLocked,
    handleToggleSliced,
    handleActionSuccess,
    registerProtocol,
  ]);
  const shouldShowEmptyDeFi = shouldShowDeFiEmptyState({
    protocolsLength: protocols.length,
    initialized,
    isRefreshing,
    ownerKey: currentOwnerKey,
    loadedOwnerKey,
  });

  if (refreshCacheOnly) {
    return null;
  }

  if (!isDeFiEnabled) {
    return null;
  }

  if (protocols.length === 0) {
    return (
      <RichBlock
        withTitleSeparator
        title={
          hideInternalTitle
            ? undefined
            : intl.formatMessage({ id: ETranslations.global_earn })
        }
        subTitle={hideInternalTitle ? undefined : renderSubTitle()}
        subTitleProps={tableLayout ? undefined : { color: '$text' }}
        headerContainerProps={{ px: '$pagePadding' }}
        // Match the loaded branch's content inset so the loading-state
        // skeleton sits in the same column as the eventual cards.
        contentContainerProps={tableLayout ? { px: '$pagePadding' } : undefined}
        plainContentContainer
        content={
          shouldShowEmptyDeFi ? (
            <EmptyDeFi tableLayout={tableLayout} />
          ) : (
            <DeFiListSkeleton tableLayout={tableLayout} />
          )
        }
      />
    );
  }

  return (
    <RichBlock
      withTitleSeparator
      title={
        hideInternalTitle
          ? undefined
          : intl.formatMessage({ id: ETranslations.global_earn })
      }
      subTitle={hideInternalTitle ? undefined : renderSubTitle()}
      subTitleProps={tableLayout ? undefined : { color: '$text' }}
      headerContainerProps={{ px: '$pagePadding' }}
      contentContainerProps={tableLayout ? { px: '$pagePadding' } : undefined}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { DeFiListBlock };
