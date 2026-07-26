import { useCallback, useEffect, useMemo, useRef } from 'react';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';

import NumberSizeableTextWrapper from '../../../components/NumberSizeableTextWrapper';
import { showResourceDetailsDialog } from '../../../components/Resource';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';
import { resolveHomeOverviewBalanceRenderDecision } from '../model/compatibility/homeShellRenderAdapter';
import { buildHomeScalarKey } from '../model/core/homeIdentity';
import { resolveHomeBalanceQuotedAmount } from '../model/facts/currentHomeBalanceFactsAdapter';
import { useHomeRefreshIntents } from '../model/react/useHomeRefreshIntents';
import { HomeTestIDs } from '../testIDs';

import type { IHomeBalanceDisplayPresentation } from '../model/policies/homeDisplayModelPolicy';

function HomeOverviewContainer({
  balancePresentation,
  manualRefreshEnabled = true,
  nativeSlot = false,
}: {
  balancePresentation?: IHomeBalanceDisplayPresentation;
  manualRefreshEnabled?: boolean;
  nativeSlot?: boolean;
} = {}) {
  const num = 0;
  const { activeAccount } = useActiveAccount({ num });
  const { account, network, deriveInfoItems, vaultSettings } = activeAccount;
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
  const { refreshAllSections, refreshingBySection } = useHomeRefreshIntents();

  const [{ currencyMap }] = useCurrencyPersistAtom();

  const [settings] = useSettingsPersistAtom();
  useEffect(() => {
    perfMark('Home:overview:mount');
    return () => {
      perfMark('Home:overview:unmount');
    };
  }, []);

  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleRefreshWorth = useCallback(() => {
    refreshAllSections();
    defaultLogger.account.wallet.walletManualRefresh();
  }, [refreshAllSections]);

  const isLoading = Object.values(refreshingBySection).some(Boolean);

  const refreshButton = useMemo(() => {
    return platformEnv.isNative || !manualRefreshEnabled ? undefined : (
      <IconButton
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={isLoading}
        onPress={handleRefreshWorth}
        testID="wallet-refresh-manually"
        trackID="wallet-refresh-manually"
      />
    );
  }, [handleRefreshWorth, isLoading, manualRefreshEnabled]);

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
      balanceState: balancePresentation ? 'unknown' : 'missing',
      hasSemanticDisplayAmount: semanticBalanceStringDisplay !== undefined,
      showSkeleton: balanceRenderDecision.showSkeleton,
      isRefreshing: isLoading,
    } as const;
    const key = buildHomeScalarKey(Object.values(decision));
    if (homeBalanceDecisionKeyRef.current === key) {
      return;
    }
    homeBalanceDecisionKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeBalanceDecision(decision);
  }, [
    balancePresentation,
    balanceRenderDecision.showSkeleton,
    isLoading,
    networkScope,
    semanticBalanceStringDisplay,
  ]);

  return (
    <YStack
      flex={nativeSlot ? 1 : undefined}
      gap="$2.5"
      alignItems="flex-start"
      justifyContent={nativeSlot ? 'center' : undefined}
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
      {!nativeSlot && vaultSettings?.hasFrozenBalance ? (
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
      {!nativeSlot && !manualRefreshEnabled && vaultSettings?.hasResource ? (
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
