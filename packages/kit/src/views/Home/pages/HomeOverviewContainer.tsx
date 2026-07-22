import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  PROPORTIONAL_NUMS,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import {
  settingsValuePersistAtom,
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHomeTab } from '@onekeyhq/shared/types';

import NumberSizeableTextWrapper from '../../../components/NumberSizeableTextWrapper';
import { showResourceDetailsDialog } from '../../../components/Resource';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';
import { resolveHomeOverviewBalanceRenderDecision } from '../model/compatibility/homeShellRenderAdapter';
import { resolveHomeBalanceQuotedAmount } from '../model/facts/currentHomeBalanceFactsAdapter';
import { HomeTestIDs } from '../testIDs';

import type { IHomeCorrelatedBalancePresentation } from '../model/compatibility/homeShellRenderAdapter';

const HOME_OVERVIEW_REFRESH_TABS = [
  EHomeTab.TOKENS,
  EHomeTab.NFT,
  EHomeTab.HISTORY,
  EHomeTab.DEFI,
] as const;

type IHomeOverviewRefreshTab = (typeof HOME_OVERVIEW_REFRESH_TABS)[number];

function isHomeOverviewRefreshTab(
  type: EHomeTab,
): type is IHomeOverviewRefreshTab {
  return HOME_OVERVIEW_REFRESH_TABS.includes(type as IHomeOverviewRefreshTab);
}

function HomeOverviewContainer({
  balancePresentation,
}: {
  balancePresentation?: IHomeCorrelatedBalancePresentation;
} = {}) {
  const num = 0;
  const { activeAccount } = useActiveAccount({ num });
  const { account, network, wallet, deriveInfoItems, vaultSettings } =
    activeAccount;
  const resourceDialogInstance = useRef<IDialogInstance | null>(null);
  const handleResourceDetailsOnPress = useCallback(() => {
    if (resourceDialogInstance.current) return;
    resourceDialogInstance.current = showResourceDetailsDialog({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      onClose: () => {
        resourceDialogInstance.current = null;
      },
    });
  }, [account?.id, network?.id]);
  const intl = useIntl();

  const [isRefreshingWorth, setIsRefreshingWorth] = useState(false);
  const [isRefreshingTokenList, setIsRefreshingTokenList] = useState(false);
  const [isRefreshingNftList, setIsRefreshingNftList] = useState(false);
  const [isRefreshingDeFiList, setIsRefreshingDeFiList] = useState(false);
  const [isRefreshingHistoryList, setIsRefreshingHistoryList] = useState(false);

  const listRefreshKeys = useRef<
    Partial<Record<IHomeOverviewRefreshTab, string>>
  >({});

  const [{ currencyMap }] = useCurrencyPersistAtom();

  const [settings] = useSettingsPersistAtom();
  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  useEffect(() => {
    perfMark('Home:overview:mount');
    return () => {
      perfMark('Home:overview:unmount');
    };
  }, []);

  useEffect(() => {
    const refreshStateSetters: Record<
      IHomeOverviewRefreshTab,
      (isRefreshing: boolean) => void
    > = {
      [EHomeTab.TOKENS]: setIsRefreshingTokenList,
      [EHomeTab.NFT]: setIsRefreshingNftList,
      [EHomeTab.HISTORY]: setIsRefreshingHistoryList,
      [EHomeTab.DEFI]: setIsRefreshingDeFiList,
    };

    const syncWorthRefreshingState = () => {
      setIsRefreshingWorth(
        HOME_OVERVIEW_REFRESH_TABS.some((refreshType) =>
          Boolean(listRefreshKeys.current[refreshType]),
        ),
      );
    };

    const updateRefreshState = ({
      refreshType,
      isRefreshing,
      key,
    }: {
      refreshType: IHomeOverviewRefreshTab;
      isRefreshing: boolean;
      key: string;
    }) => {
      if (isRefreshing) {
        listRefreshKeys.current[refreshType] = key;
        refreshStateSetters[refreshType](true);
        return true;
      }

      if (
        listRefreshKeys.current[refreshType] &&
        listRefreshKeys.current[refreshType] !== key
      ) {
        return false;
      }

      delete listRefreshKeys.current[refreshType];
      refreshStateSetters[refreshType](false);
      return true;
    };

    const fn = ({
      isRefreshing,
      type,
      accountId,
      networkId,
    }: {
      isRefreshing: boolean;
      type: EHomeTab;
      accountId: string;
      networkId: string;
    }) => {
      const key = `${accountId}-${networkId}`;
      let didUpdateState = false;

      if (type === EHomeTab.ALL) {
        HOME_OVERVIEW_REFRESH_TABS.forEach((refreshType) => {
          didUpdateState =
            updateRefreshState({ refreshType, isRefreshing, key }) ||
            didUpdateState;
        });
      } else if (isHomeOverviewRefreshTab(type)) {
        didUpdateState = updateRefreshState({
          refreshType: type,
          isRefreshing,
          key,
        });
      }

      if (!didUpdateState) {
        return;
      }

      syncWorthRefreshingState();
      if (isRefreshing) {
        perfMark(`Home:refresh:start:${type}`, {
          refreshType: type,
        });
      } else {
        perfMark(`Home:done:${type}`, {
          refreshType: type,
        });
        perfMark(`Home:refresh:done:${type}`, {
          refreshType: type,
        });
      }
    };
    appEventBus.on(EAppEventBusNames.TabListStateUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.TabListStateUpdate, fn);
    };
  }, []);

  useEffect(() => {
    listRefreshKeys.current = {};
    setIsRefreshingWorth(false);
    setIsRefreshingTokenList(false);
    setIsRefreshingNftList(false);
    setIsRefreshingHistoryList(false);
    setIsRefreshingDeFiList(false);
  }, [account?.id, account?.indexedAccountId, network?.id, wallet?.id]);

  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleRefreshWorth = useCallback(() => {
    if (isRefreshingWorth) return;
    setIsRefreshingWorth(true);
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, {
      isManualRefresh: true,
      refreshSource: 'home-header',
    });
    defaultLogger.account.wallet.walletManualRefresh();
  }, [isRefreshingWorth]);

  const isLoading =
    isRefreshingWorth ||
    isRefreshingTokenList ||
    isRefreshingNftList ||
    isRefreshingHistoryList ||
    isRefreshingDeFiList;

  const refreshButton = useMemo(() => {
    return platformEnv.isNative || isWalletNotBackedUp ? undefined : (
      <IconButton
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={isLoading}
        onPress={handleRefreshWorth}
        testID="wallet-refresh-manually"
        trackID="wallet-refresh-manually"
      />
    );
  }, [handleRefreshWorth, isLoading, isWalletNotBackedUp]);

  const handleBalanceOnPress = useCallback(async () => {
    const settingsValue = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !settingsValue.hideValue });
  }, []);

  const handleBalanceDetailsOnPress = useCallback(() => {
    if (balanceDialogInstance?.current) {
      return;
    }
    balanceDialogInstance.current = showBalanceDetailsDialog({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      deriveInfoItems,
      indexedAccountId: account?.indexedAccountId,
      intl,
      onClose: () => {
        balanceDialogInstance.current = null;
      },
    });
  }, [account, network, deriveInfoItems, intl]);

  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  const semanticBalanceStringDisplay = useMemo(() => {
    if (balancePresentation?.kind !== 'ready') {
      return undefined;
    }
    return resolveHomeBalanceQuotedAmount({
      currencyMap,
      value: balancePresentation.balance.amount,
      sourceCurrency: balancePresentation.balance.currency,
      targetCurrency: settings.currencyInfo.id,
    })?.amount;
  }, [balancePresentation, currencyMap, settings.currencyInfo.id]);
  const balanceRenderDecision = resolveHomeOverviewBalanceRenderDecision({
    balancePresentation,
    semanticDisplayAmount: semanticBalanceStringDisplay,
  });
  let networkScope: 'allNetworks' | 'singleNetwork' | 'unknown' = 'unknown';
  if (network) {
    networkScope = network.isAllNetworks ? 'allNetworks' : 'singleNetwork';
  }

  const homeBalanceDecisionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const decision = {
      networkScope,
      balancePresentationKind: balancePresentation?.kind ?? 'missing',
      balanceState: balancePresentation?.balanceState ?? 'missing',
      hasSemanticDisplayAmount: semanticBalanceStringDisplay !== undefined,
      showSkeleton: balanceRenderDecision.showSkeleton,
      isRefreshing: isLoading,
    } as const;
    const key = stringUtils.stableStringify(decision);
    if (homeBalanceDecisionKeyRef.current === key) {
      return;
    }
    homeBalanceDecisionKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeBalanceDecision(decision);
  }, [
    balancePresentation?.balanceState,
    balancePresentation?.kind,
    balanceRenderDecision.showSkeleton,
    isLoading,
    networkScope,
    semanticBalanceStringDisplay,
  ]);

  // Track when balance is first displayed
  const balanceReady =
    !balanceRenderDecision.showSkeleton &&
    balanceRenderDecision.amount !== undefined;
  useEffect(() => {
    if (balanceReady && !(globalThis as any).__onekeyBalanceDisplayed) {
      (globalThis as any).__onekeyBalanceDisplayed = true;
      appEventBus.emit(EAppEventBusNames.HomePageReady, undefined);
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeLogger: NL, LogLevel: LL } =
          require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
        const jsEntry: number =
          (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || 0;
        if (jsEntry) {
          NL.write(
            LL.Info,
            `[StartupTiming] Balance displayed (+${Date.now() - jsEntry}ms)`,
          );
        }
      } catch {
        /* NativeLogger may not be available */
      }
    }
  }, [balanceReady]);

  return (
    <YStack
      gap="$2.5"
      alignItems="flex-start"
      testID={HomeTestIDs.walletOverview}
    >
      <YStack w="100%" gap="$2">
        {balanceRenderDecision.showSkeleton ? (
          <Skeleton.Heading5Xl />
        ) : (
          <XStack alignItems="center" gap="$3" h={48}>
            <XStack
              flexShrink={1}
              borderRadius="$3"
              px="$1"
              py="$0.5"
              mx="$-1"
              my="$-0.5"
              cursor="default"
              focusable
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineOffset: 0,
                outlineStyle: 'solid',
              }}
              onPress={handleBalanceOnPress}
              testID={HomeTestIDs.totalBalance}
            >
              <NumberSizeableTextWrapper
                hideValue
                splitDecimal
                flexShrink={1}
                minWidth={0}
                fontSize={48}
                lineHeight={48}
                fontWeight={500}
                // Large hero balance reads better with the font's natural
                // proportional figures than equal-width tabular ones.
                fontVariant={PROPORTIONAL_NUMS}
                {...numberFormatter}
              >
                {balanceRenderDecision.amount ?? '0'}
              </NumberSizeableTextWrapper>
            </XStack>
            {refreshButton}
          </XStack>
        )}
      </YStack>
      {vaultSettings?.hasFrozenBalance ? (
        <Button
          testID="home-btn"
          onPress={handleBalanceDetailsOnPress}
          variant="tertiary"
          size="small"
          iconAfter="InfoCircleOutline"
        >
          {intl.formatMessage({
            id: ETranslations.balance_detail_button_balance,
          })}
        </Button>
      ) : undefined}
      {isWalletNotBackedUp && vaultSettings?.hasResource ? (
        <Button
          testID="home-btn"
          onPress={handleResourceDetailsOnPress}
          variant="tertiary"
          size="small"
          iconAfter="InfoCircleOutline"
          px="$1"
          py="$0.5"
          mx="$-1"
        >
          {intl.formatMessage({
            id: vaultSettings.resourceKey,
          })}
        </Button>
      ) : undefined}
    </YStack>
  );
}

export { HomeOverviewContainer };
