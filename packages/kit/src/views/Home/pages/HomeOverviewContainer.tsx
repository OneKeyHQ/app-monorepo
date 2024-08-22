import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Icon,
  IconButton,
  NumberSizeableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { EHomeTab } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
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
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num });

  const [isRefreshingWorth, setIsRefreshingWorth] = useState(false);
  const [isRefreshingTokenList, setIsRefreshingTokenList] = useState(false);
  const [isRefreshingNftList, setIsRefreshingNftList] = useState(false);
  const [isRefreshingHistoryList, setIsRefreshingHistoryList] = useState(false);

  const listRefreshKey = useRef('');

  const [accountWorth] = useAccountWorthAtom();
  const [overviewState] = useAccountOverviewStateAtom();
  const { updateAccountOverviewState, updateAccountWorth } =
    useAccountOverviewActions().current;

  const [settings] = useSettingsPersistAtom();

  const { result: vaultSettings } = usePromiseResult(async () => {
    if (!network) return;
    const s = backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network.id,
    });
    return s;
  }, [network]);

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      updateAccountOverviewState({
        initialized: false,
        isRefreshing: true,
      });
      if (network.isAllNetworks) {
        updateAccountWorth({
          accountId: account.id,
          worth: '0',
          initialized: false,
        });
      }
    }
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    updateAccountOverviewState,
    updateAccountWorth,
    wallet?.id,
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

      if (type === EHomeTab.TOKENS) {
        setIsRefreshingTokenList(isRefreshing);
      } else if (type === EHomeTab.NFT) {
        setIsRefreshingNftList(isRefreshing);
      } else if (type === EHomeTab.HISTORY) {
        setIsRefreshingHistoryList(isRefreshing);
      }
      setIsRefreshingWorth(isRefreshing);
    };
    appEventBus.on(EAppEventBusNames.TabListStateUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.TabListStateUpdate, fn);
    };
  }, []);

  useEffect(() => {
    if (
      account &&
      network &&
      accountWorth.initialized &&
      account.id === accountWorth.accountId
    ) {
      if (accountUtils.isOthersAccount({ accountId: account.id })) {
        if (!network.isAllNetworks && account.createAtNetwork !== network.id)
          return;

        const accountValueId = account.id;

        void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
          accountId: accountValueId,
          value: accountWorth.createAtNetworkWorth,
          currency: settings.currencyInfo.id,
        });
      } else if (
        !accountUtils.isOthersAccount({ accountId: account.id }) &&
        network.isAllNetworks
      ) {
        const accountValueId = account.indexedAccountId as string;

        void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
          accountId: accountValueId,
          value: accountWorth.worth,
          currency: settings.currencyInfo.id,
        });
      }
    }
  }, [
    account,
    accountWorth.accountId,
    accountWorth.createAtNetworkWorth,
    accountWorth.initialized,
    accountWorth.worth,
    network,
    settings.currencyInfo.id,
    wallet,
  ]);

  const { md } = useMedia();
  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleRefreshWorth = useCallback(() => {
    if (isRefreshingWorth) return;
    setIsRefreshingWorth(true);
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
  }, [isRefreshingWorth]);

  const isLoading =
    isRefreshingWorth ||
    isRefreshingTokenList ||
    isRefreshingNftList ||
    isRefreshingHistoryList;

  const refreshButton = useMemo(() => {
    if (platformEnv.isNative) {
      return isLoading ? (
        <IconButton
          icon="RefreshCcwOutline"
          variant="tertiary"
          loading={isLoading}
        />
      ) : undefined;
    }
    return platformEnv.isNative ? undefined : (
      <IconButton
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={isLoading}
        onPress={handleRefreshWorth}
      />
    );
  }, [handleRefreshWorth, isLoading]);

  if (overviewState.isRefreshing && !overviewState.initialized)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  const balanceString = accountWorth.worth ?? '0';
  const balanceSizeList: { length: number; size: FontSizeTokens }[] = [
    { length: 17, size: '$headingXl' },
    { length: 13, size: '$heading4xl' },
  ];
  const defaultBalanceSize = '$heading5xl';
  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  const basicTextElement = (
    <NumberSizeableText
      flexShrink={1}
      minWidth={0}
      {...numberFormatter}
      size={
        md
          ? balanceSizeList.find(
              (item) =>
                numberFormat(String(balanceString), numberFormatter, true)
                  .length >= item.length,
            )?.size ?? defaultBalanceSize
          : defaultBalanceSize
      }
    >
      {balanceString}
    </NumberSizeableText>
  );

  return (
    <XStack alignItems="center" gap="$3">
      {vaultSettings?.hasFrozenBalance ? (
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
          onPress={() => {
            if (balanceDialogInstance?.current) {
              return;
            }
            balanceDialogInstance.current = showBalanceDetailsDialog({
              accountId: account?.id ?? '',
              networkId: network?.id ?? '',
              onClose: () => {
                balanceDialogInstance.current = null;
              },
            });
          }}
        >
          {basicTextElement}
          <Icon
            flexShrink={0}
            name="InfoCircleOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      ) : (
        basicTextElement
      )}
      {refreshButton}
    </XStack>
  );
}

export { HomeOverviewContainer };
