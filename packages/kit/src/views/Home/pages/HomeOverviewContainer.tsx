import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
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
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOTAL_VALUE,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { IMPL_ALLNETWORKS } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAllNetworkRequests } from '../../../hooks/useAllNetwork';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';

import type { FontSizeTokens } from 'tamagui';

function HomeOverviewContainer() {
  const intl = useIntl();
  const num = 0;
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num });

  const [overviewState, setOverviewState] = useState({
    initialized: false,
    isRefreshing: false,
  });

  const refreshAllNetworksWorth = useRef(false);

  const [allNetWorth, setAllNetWorth] = useState<string | undefined>();

  const [settings] = useSettingsPersistAtom();

  const { result: overview } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      if (account.impl === IMPL_ALLNETWORKS) return;
      await backgroundApiProxy.serviceAccountProfile.abortFetchAccountDetails();
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId: network.id,
          accountId: account.id,
          withNetWorth: true,
          withNonce: false,
        });
      setOverviewState({
        initialized: true,
        isRefreshing: false,
      });
      return r;
    },
    [account, network],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOTAL_VALUE,
    },
  );

  const handleAllNetworkRequests = useCallback(
    async ({
      networkId,
      accountId,
    }: {
      networkId: string;
      accountId: string;
    }) => {
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId,
          accountId,
          withNetWorth: true,
          withNonce: false,
        });

      if (!refreshAllNetworksWorth.current) {
        setAllNetWorth((prev) =>
          new BigNumber(prev ?? '0').plus(r.netWorth ?? 0).toString(),
        );

        setOverviewState({
          initialized: true,
          isRefreshing: false,
        });
      }

      return r;
    },
    [],
  );

  const handleClearAllNetworkData = useCallback(() => {
    setAllNetWorth('0');
  }, []);

  const { result: allNetworksResult } =
    useAllNetworkRequests<IFetchAccountDetailsResp>({
      account,
      network,
      wallet,
      allNetworkRequests: handleAllNetworkRequests,
      clearAllNetworkData: handleClearAllNetworkData,
      interval: 200,
    });

  const { result: vaultSettings } = usePromiseResult(async () => {
    if (!network) return;
    const s = backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network.id,
    });
    return s;
  }, [network]);

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      setOverviewState({
        initialized: false,
        isRefreshing: true,
      });
      refreshAllNetworksWorth.current = false;
    }
  }, [account?.id, network?.id, wallet?.id]);

  useEffect(() => {
    let allNetworksWorth = new BigNumber('0');
    if (refreshAllNetworksWorth.current && allNetworksResult) {
      for (const r of allNetworksResult) {
        allNetworksWorth = allNetworksWorth.plus(r.netWorth ?? 0);
      }
      setAllNetWorth(allNetworksWorth.toString());
    }
  }, [allNetworksResult]);

  const { md } = useMedia();
  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  if (overviewState.isRefreshing && !overviewState.initialized)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  const balanceString =
    account?.impl === IMPL_ALLNETWORKS
      ? allNetWorth ?? '0'
      : overview?.netWorth ?? '0';
  const balanceSizeList: { length: number; size: FontSizeTokens }[] = [
    { length: 25, size: '$headingXl' },
    { length: 13, size: '$heading4xl' },
  ];
  const defaultBalanceSize = '$heading5xl';
  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  return (
    <XStack alignItems="center" space="$2">
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
      {vaultSettings?.hasFrozenBalance ? (
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.balance_detail_button_balance,
          })}
          icon="InfoCircleOutline"
          variant="tertiary"
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
        />
      ) : null}
    </XStack>
  );
}

export { HomeOverviewContainer };
