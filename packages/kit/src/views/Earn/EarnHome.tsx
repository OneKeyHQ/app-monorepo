import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Badge,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAvailableAsset } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { ListItem } from '../../components/ListItem';
import { TabPageHeader } from '../../components/TabPageHeader';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useEarnActions, useEarnAtom } from '../../states/jotai/contexts/earn';

import { EarnProviderMirror } from './EarnProviderMirror';

function Overview() {
  const [{ accounts }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const totalFiatValue = useMemo(
    () =>
      accounts
        ? accounts
            .reduce(
              (prev, account) => prev.plus(account.totalFiatValue || 0),
              new BigNumber(0),
            )
            .toString()
        : 0,
    [accounts],
  );
  const earnings24h = useMemo(
    () =>
      accounts
        ? accounts.reduce(
            (prev, account) => prev.plus(account.earnings24h || 0),
            new BigNumber(0),
          )
        : new BigNumber(0),
    [accounts],
  );
  return (
    <YStack
      gap="$1"
      px="$5"
      borderRadius="$3"
      userSelect="none"
      {...listItemPressStyle}
    >
      <XStack justifyContent="space-between">
        <SizableText size="$bodyLg">Total staked value</SizableText>
        <XStack>
          <SizableText color="$textSubdued" size="$bodyLgMedium">
            Details
          </SizableText>
          <Icon name="ChevronRightSmallSolid" color="$textSubdued" />
        </XStack>
      </XStack>
      <NumberSizeableText
        size="$heading5xl"
        formatter="price"
        formatterOptions={{ currency: '$' }}
      >
        {totalFiatValue}
      </NumberSizeableText>
      <XStack gap="$1.5">
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
            showPlusMinusSigns: !earnings24h.isZero(),
          }}
          color={earnings24h.isZero() ? '$textDisabled' : '$textInteractive'}
        >
          {earnings24h.toFixed()}
        </NumberSizeableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          24h earnings
        </SizableText>
      </XStack>
    </YStack>
  );
}

function AvailableAssets() {
  const [{ availableAssets: assets = [] }] = useEarnAtom();
  if (assets.length) {
    return (
      <YStack gap="$2" userSelect="none">
        <SizableText px="$5" size="$headingLg">
          Available assets
        </SizableText>
        {assets.map(({ name, logoURI, apr }) => (
          <ListItem
            key={name}
            mx={0}
            px="$5"
            onPress={() => {}}
            avatarProps={{ src: logoURI }}
            renderItemText={
              <XStack justifyContent="space-between" flex={1}>
                <XStack gap="$2">
                  <SizableText size="$bodyLgMedium">{name}</SizableText>
                  {/* <Badge badgeType="critical" badgeSize="sm" userSelect="none">
                    <Badge.Text>Hot</Badge.Text>
                  </Badge> */}
                </XStack>
                <XStack>
                  <SizableText size="$bodyLgMedium">{`${apr} APR`}</SizableText>
                </XStack>
              </XStack>
            }
          />
        ))}
      </YStack>
    );
  }
  return null;
}

function BasicEarnHome() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  usePromiseResult(
    async () => {
      const assets =
        await backgroundApiProxy.serviceStaking.getAvailableAssets();
      actions.current.updateAvailableAssets(assets);

      if (account) {
        const { indexedAccountId } = account;
        if (indexedAccountId) {
          const accounts =
            await backgroundApiProxy.serviceStaking.getAllNetworkAccount({
              assets,
              indexedAccountId,
            });
          actions.current.updateEarnAccounts(accounts);
        }
      }
    },
    [account, actions],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  return (
    <Page scrollEnabled>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.earn}
        showHeaderRight={false}
      />
      <Page.Body>
        <YStack alignItems="center" py="$5">
          <YStack maxWidth="$180" w="100%" gap="$8">
            <Overview />
            <AvailableAssets />
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default function EarnHome() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.earn,
        sceneUrl: '',
      }}
      enabledNum={[0, 1]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicEarnHome />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
