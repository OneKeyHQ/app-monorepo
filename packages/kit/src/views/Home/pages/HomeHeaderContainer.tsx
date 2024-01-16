import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorActiveAccount,
  AccountSelectorActiveAccountHome,
  AccountSelectorTrigger,
} from '../../../components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

import { WalletActionsContainer } from './WalletActionsContainer';

import type { ITabHomeParamList } from '../router';

function HomeAccountSelectorInfoDemo() {
  return (
    <YStack mx="$2" my="$4">
      <AccountSelectorTrigger num={0} />
      <AccountSelectorActiveAccount num={0} />
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceHardware.inputPinOnDevice();
        }}
      >
        硬件输入 PIN
      </Button>
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceHardware.inputPassphraseOnDevice();
        }}
      >
        硬件输入 Passphrase
      </Button>
    </YStack>
  );
}

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

  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();
  const actions = useAccountSelectorActions();

  const navigateAccountManagerStacks = useCallback(() => {
    actions.current.showAccountSelector({
      navigation,
      activeWallet: undefined,
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    });
  }, [actions, navigation]);
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
      <HomeAccountSelectorInfoDemo />
    </Stack>
  );
}

export { HomeHeaderContainer };
