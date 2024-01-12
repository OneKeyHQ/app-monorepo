import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EAccountManagerStacksRoutes } from '../../AccountManagerStacks/router/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorActiveAccountHome } from '../../../components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { WalletActionsContainer } from './WalletActionsContainer';

function HomeHeaderContainer() {
  const intl = useIntl();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const [settings] = useSettingsPersistAtom();

  const overview = usePromiseResult(async () => {
    if (!account || !network) return;
    const r = await backgroundApiProxy.serviceAddress.fetchAddressDetails({
      networkId: network.id,
      accountAddress: account.address,
      withNetWorth: true,
    });
    return r;
  }, [account, network]).result;

  const totalValue = useMemo(
    () =>
      `${settings.currencyInfo.symbol}${intl.formatNumber(
        new BigNumber(overview?.netWorth ?? 0).toNumber(),
      )}`,
    [intl, overview?.netWorth, settings.currencyInfo.symbol],
  );

  return (
    <Stack
      p="$5"
      $gtMd={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Stack>
        <XStack mb="$1" alignItems="center" space="$1">
          <NetworkSelectorTriggerHome num={0} />
          <AccountSelectorActiveAccountHome num={0} />
          <DeriveTypeSelectorTrigger miniMode num={0} />
        </XStack>

        <Stack mt="$1">
          <SizableText
            size="$heading4xl"
            $gtMd={{
              size: '$heading5xl',
            }}
          >
            {totalValue}
          </SizableText>
        </Stack>
      </Stack>
      <WalletActionsContainer />
    </Stack>
  );
}

export { HomeHeaderContainer };
