import { useCallback, useEffect, useRef, useState } from 'react';

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
          worth: '0',
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
    }: {
      isRefreshing: boolean;
      type: EHomeTab;
    }) => {
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
    if (account && network) {
      if (
        (accountUtils.isOthersAccount({ accountId: account.id }) &&
          !network.isAllNetworks &&
          account.createAtNetwork === network.id) ||
        (!accountUtils.isOthersAccount({ accountId: account.id }) &&
          network.isAllNetworks)
      ) {
        void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
          accountId: accountUtils.isOthersAccount({ accountId: account.id })
            ? account.id
            : (account.indexedAccountId as string),
          value: accountWorth.worth,
          currency: settings.currencyInfo.id,
        });
      }
    }
  }, [account, accountWorth.worth, network, settings.currencyInfo.id, wallet]);

  const { md } = useMedia();
  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleRefreshWorth = useCallback(() => {
    if (isRefreshingWorth) return;
    setIsRefreshingWorth(true);
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
  }, [isRefreshingWorth]);

  if (overviewState.isRefreshing && !overviewState.initialized)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  const balanceString = accountWorth.worth ?? '0';
  const balanceSizeList: { length: number; size: FontSizeTokens }[] = [
    { length: 25, size: '$headingXl' },
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
    <XStack alignItems="center" space="$3">
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
          focusStyle={{
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
      <IconButton
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={
          isRefreshingWorth ||
          isRefreshingTokenList ||
          isRefreshingNftList ||
          isRefreshingHistoryList
        }
        onPress={handleRefreshWorth}
      />
    </XStack>
  );
}

export { HomeOverviewContainer };
