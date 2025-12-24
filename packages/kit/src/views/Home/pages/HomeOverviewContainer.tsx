import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { calculateAccountTokensValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EHomeTab } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AllNetworksManagerTrigger } from '../../../components/AccountSelector/AllNetworksManagerTrigger';
import NumberSizeableTextWrapper from '../../../components/NumberSizeableTextWrapper';
import { showResourceDetailsDialog } from '../../../components/Resource';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  useAccountDeFiOverviewAtom,
  useAccountOverviewActions,
  useAccountOverviewStateAtom,
  useAccountWorthAtom,
} from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';

import type { FontSizeTokens } from 'tamagui';

function HomeOverviewContainer() {
  const num = 0;
  const {
    activeAccount: { account, network, wallet, deriveInfoItems, vaultSettings },
  } = useActiveAccount({ num });
  const intl = useIntl();

  const [isRefreshingWorth, setIsRefreshingWorth] = useState(false);
  const [isRefreshingTokenList, setIsRefreshingTokenList] = useState(false);
  const [isRefreshingNftList, setIsRefreshingNftList] = useState(false);
  const [isRefreshingHistoryList, setIsRefreshingHistoryList] = useState(false);
  const [isRefreshingApprovalList, setIsRefreshingApprovalList] =
    useState(false);

  const listRefreshKey = useRef('');

  const [accountWorth] = useAccountWorthAtom();
  const [accountDeFiOverview] = useAccountDeFiOverviewAtom();
  const [overviewState] = useAccountOverviewStateAtom();
  const {
    updateAccountOverviewState,
    updateAccountWorth,
    updateAccountDeFiOverview,
  } = useAccountOverviewActions().current;

  const [settings] = useSettingsPersistAtom();

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      if (
        network.isAllNetworks ||
        (wallet.type === WALLET_TYPE_HD && !wallet.backuped)
      ) {
        updateAccountWorth({
          accountId: account.id,
          worth: {},
          initialized: false,
        });
        updateAccountDeFiOverview({
          overview: {
            totalValue: 0,
            totalDebt: 0,
            totalReward: 0,
            netWorth: 0,
          },
        });
      }
    }
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    updateAccountDeFiOverview,
    updateAccountOverviewState,
    updateAccountWorth,
    wallet?.backuped,
    wallet?.id,
    wallet?.type,
  ]);

  useEffect(() => {
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
      if (
        !isRefreshing &&
        listRefreshKey.current &&
        listRefreshKey.current !== key
      ) {
        return;
      }

      listRefreshKey.current = key;

      if (type === EHomeTab.ALL) {
        setIsRefreshingTokenList(isRefreshing);
        setIsRefreshingNftList(isRefreshing);
        setIsRefreshingHistoryList(isRefreshing);
        setIsRefreshingApprovalList(isRefreshing);
        setIsRefreshingWorth(isRefreshing);
        return;
      }

      if (type === EHomeTab.TOKENS) {
        setIsRefreshingTokenList(isRefreshing);
      } else if (type === EHomeTab.NFT) {
        setIsRefreshingNftList(isRefreshing);
      } else if (type === EHomeTab.HISTORY) {
        setIsRefreshingHistoryList(isRefreshing);
      } else if (type === EHomeTab.APPROVALS) {
        setIsRefreshingApprovalList(isRefreshing);
      }
      setIsRefreshingWorth(isRefreshing);
    };
    appEventBus.on(EAppEventBusNames.TabListStateUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.TabListStateUpdate, fn);
    };
  }, []);

  useEffect(() => {
    const updateAccountValue = async () => {
      if (
        account &&
        network &&
        accountWorth.initialized &&
        (account.id === accountWorth.accountId ||
          account.indexedAccountId === accountWorth.accountId)
      ) {
        const allWorth = Object.values(accountWorth.worth).reduce(
          (acc: string, cur: string) => new BigNumber(acc).plus(cur).toFixed(),
          '0',
        );

        if (
          new BigNumber(allWorth).gt(
            SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD,
          )
        ) {
          await backgroundApiProxy.serviceWalletStatus.updateWalletStatus({
            walletXfp: wallet?.xfp ?? '',
            status: {
              hasValue: true,
            },
          });
          appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
        }
        let accountValueId = '';
        if (accountUtils.isOthersAccount({ accountId: account.id })) {
          accountValueId = account.id;

          if (network.isAllNetworks || account.createAtNetwork === network.id) {
            void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
              accountId: accountValueId,
              value: accountWorth.createAtNetworkWorth,
              currency: settings.currencyInfo.id,
              shouldUpdateActiveAccountValue: true,
            });
          }
        } else {
          accountValueId = account.indexedAccountId as string;
        }

        if (
          !accountUtils.isOthersAccount({ accountId: account.id }) &&
          !network.isAllNetworks
        ) {
          void backgroundApiProxy.serviceAccountProfile.updateAccountValueForSingleNetwork(
            {
              accountId: accountValueId,
              value:
                accountWorth.worth[
                  accountUtils.buildAccountValueKey({
                    accountId: account.id,
                    networkId: network.id,
                  })
                ],
              currency: settings.currencyInfo.id,
            },
          );
        }

        void backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue(
          {
            accountId: accountValueId,
            value: accountWorth.worth,
            currency: settings.currencyInfo.id,
          },
        );
      }
    };
    void updateAccountValue();
  }, [
    account,
    accountWorth,
    accountWorth.accountId,
    accountWorth.createAtNetworkWorth,
    accountWorth.initialized,
    accountWorth.updateAll,
    accountWorth.worth,
    network,
    settings.currencyInfo.id,
    wallet,
  ]);

  const { md } = useMedia();
  const balanceDialogInstance = useRef<IDialogInstance | null>(null);
  const resourceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleRefreshWorth = useCallback(() => {
    if (isRefreshingWorth) return;
    setIsRefreshingWorth(true);
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    defaultLogger.account.wallet.walletManualRefresh();
  }, [isRefreshingWorth]);

  const isLoading =
    isRefreshingWorth ||
    isRefreshingTokenList ||
    isRefreshingNftList ||
    isRefreshingHistoryList ||
    isRefreshingApprovalList;

  const refreshButton = useMemo(() => {
    return platformEnv.isNative || isWalletNotBackedUp ? undefined : (
      <IconButton
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={isLoading}
        onPress={handleRefreshWorth}
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
      onClose: () => {
        balanceDialogInstance.current = null;
      },
    });
  }, [account, network, deriveInfoItems]);

  const handleResourceDetailsOnPress = useCallback(() => {
    if (resourceDialogInstance?.current) {
      return;
    }
    resourceDialogInstance.current = showResourceDetailsDialog({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      onClose: () => {
        resourceDialogInstance.current = null;
      },
    });
  }, [account?.id, network?.id]);

  const balanceString = useMemo(() => {
    return new BigNumber(
      calculateAccountTokensValue({
        accountId: account?.id ?? '',
        networkId: network?.id ?? '',
        tokensWorth: accountWorth,
        mergeDeriveAssetsEnabled: !!vaultSettings?.mergeDeriveAssetsEnabled,
      }),
    )
      .plus(accountDeFiOverview.netWorth ?? 0)
      .toFixed();
  }, [
    account?.id,
    network?.id,
    accountWorth,
    vaultSettings?.mergeDeriveAssetsEnabled,
    accountDeFiOverview.netWorth,
  ]);

  const debouncedBalanceString = useDebounce(balanceString, 100);

  const balanceSizeList: { length: number; size: FontSizeTokens }[] = [
    { length: 17, size: '$headingXl' },
    { length: 13, size: '$heading4xl' },
  ];
  const defaultBalanceSize = '$heading5xl';
  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  const showSkeleton = useMemo(() => {
    return overviewState.isRefreshing && !overviewState.initialized;
  }, [overviewState.isRefreshing, overviewState.initialized]);

  return (
    <YStack gap="$2.5" alignItems="flex-start">
      <YStack w="100%" gap="$2">
        <AllNetworksManagerTrigger
          num={0}
          containerProps={{
            ml: '$1',
          }}
          showSkeleton={showSkeleton}
        />
        {showSkeleton ? (
          <Skeleton.Heading5Xl my="$-0.5" />
        ) : (
          <XStack alignItems="center" gap="$3">
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
            >
              <NumberSizeableTextWrapper
                hideValue
                flexShrink={1}
                minWidth={0}
                {...numberFormatter}
                size={
                  md
                    ? balanceSizeList.find(
                        (item) =>
                          numberFormatAsRenderText(
                            String(debouncedBalanceString),
                            numberFormatter,
                          ).length >= item.length,
                      )?.size ?? defaultBalanceSize
                    : defaultBalanceSize
                }
              >
                {debouncedBalanceString}
              </NumberSizeableTextWrapper>
            </XStack>
            {refreshButton}
          </XStack>
        )}
      </YStack>
      {vaultSettings?.hasFrozenBalance ? (
        <Button
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
      {vaultSettings?.hasResource ? (
        <Button
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
