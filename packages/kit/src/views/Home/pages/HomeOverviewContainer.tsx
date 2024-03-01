import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function HomeOverviewContainer() {
  const num = 0;
  const intl = useIntl();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num });

  const [settings] = useSettingsPersistAtom();

  const { result: overview, isLoading } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId: network.id,
          accountAddress: account.address,
          withNetWorth: true,
        });
      return r;
    },
    [account, network],
    {
      watchLoading: true,
    },
  );

  const totalValue = useMemo(
    () =>
      `${settings.currencyInfo.symbol}${intl.formatNumber(
        new BigNumber(overview?.netWorth ?? 0).toNumber(),
      )}`,
    [intl, overview?.netWorth, settings.currencyInfo.symbol],
  );

  if (isLoading)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  return <SizableText size="$heading5xl">{totalValue}</SizableText>;
}

export { HomeOverviewContainer };
