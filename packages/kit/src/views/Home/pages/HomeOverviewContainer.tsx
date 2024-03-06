import { NumberSizeableText, Skeleton, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function HomeOverviewContainer() {
  const num = 0;
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

  if (isLoading)
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
