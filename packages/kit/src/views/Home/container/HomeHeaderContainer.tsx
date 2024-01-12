import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Stack,
  Toast,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorActiveAccountHome } from '../../../components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EChainSelectorPages } from '../../ChainSelector/router/type';
import { POLLING_INTERVAL_FOR_TOTAL_VALUE } from '../constants';

import { WalletActionsContainer } from './WalletActionsContainer';

import type { ITabHomeParamList } from '../router/types';

function HomeHeaderContainer() {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();

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

  const handleChainPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.ChainSelector,
    });
  }, [navigation]);

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
