import { useEffect, useState } from 'react';

import { NumberSizeableText, Skeleton, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOTAL_VALUE,
} from '@onekeyhq/shared/src/consts/walletConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function HomeOverviewContainer() {
  const num = 0;
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num });

  const [overviewState, setOverviewState] = useState({
    initialized: false,
    isRefreshing: false,
  });

  const [settings] = useSettingsPersistAtom();

  const { result: overview } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: account.id,
          networkId: network.id,
        });
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId: network.id,
          accountAddress,
          xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
            accountId: account.id,
            networkId: network.id,
          }),
          withNetWorth: true,
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

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      setOverviewState({
        initialized: false,
        isRefreshing: true,
      });
    }
  }, [account?.id, network?.id, wallet?.id]);

  if (overviewState.isRefreshing && !overviewState.initialized)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  return (
    <NumberSizeableText
      formatter="value"
      formatterOptions={{ currency: settings.currencyInfo.symbol }}
      size="$heading5xl"
    >
      {overview?.netWorth ?? 0}
    </NumberSizeableText>
  );
}

export { HomeOverviewContainer };
