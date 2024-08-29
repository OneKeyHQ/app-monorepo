import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IEarnAccount,
  IEarnAccountToken,
} from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { ListItem } from '../../components/ListItem';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useEarnActions, useEarnAtom } from '../../states/jotai/contexts/earn';

import { EarnProviderMirror } from './EarnProviderMirror';

interface ITokenAccount extends IEarnAccountToken {
  account: IEarnAccount;
}

const toTokenProviderListPage = async (
  navigation: ReturnType<typeof useAppNavigation>,
  {
    networkId,
    accountId,
    indexedAccountId,
    symbol,
  }: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
  },
) => {
  navigation.pushModal(EModalRoutes.StakingModal, {
    screen: EModalStakingRoutes.AssetProtocolList,
    params: {
      networkId,
      accountId,
      indexedAccountId,
      symbol,
    },
  });
};

function RecommendedItem({ token }: { token: ITokenAccount }) {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const onPress = useCallback(async () => {
    if (account) {
      await toTokenProviderListPage(navigation, {
        indexedAccountId: indexedAccount?.id,
        accountId: account?.id ?? '',
        networkId: token.account.networkId,
        symbol: token.symbol,
      });
    }
  }, [
    account,
    indexedAccount,
    navigation,
    token.account.networkId,
    token.symbol,
  ]);
  return (
    <YStack
      gap="$3"
      px="$4"
      width="$40"
      py="$3.5"
      mt="$3"
      borderRadius="$3"
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      $md={{
        flexGrow: 1,
      }}
      onPress={onPress}
      {...listItemPressStyle}
    >
      <XStack gap="$2">
        <Image size="$6" borderRadius="$1">
          <Image.Source
            source={{
              uri: token.logoURI,
            }}
          />
          <Image.Fallback
            alignItems="center"
            justifyContent="center"
            bg="$bgStrong"
            delayMs={1000}
          >
            <Icon size="$5" name="CoinOutline" color="$iconDisabled" />
          </Image.Fallback>
        </Image>
        <SizableText size="$bodyLgMedium">
          {token.symbol.toUpperCase()}
        </SizableText>
      </XStack>
      <SizableText size="$headingXl">{token.apr}</SizableText>
    </YStack>
  );
}

function Recommended() {
  const { gtMd } = useMedia();
  const [{ accounts }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const { tokens, profit } = useMemo(() => {
    const accountTokens: ITokenAccount[] = [];
    const totalProfit = new BigNumber(0);
    accounts?.forEach((account) => {
      account.earn.tokens.forEach((token) => {
        totalProfit.plus(token.profit || 0);
        accountTokens.push({
          ...token,
          account,
        });
      });
    });
    return {
      tokens: accountTokens,
      profit: totalProfit,
    };
  }, [accounts]);
  if (tokens.length) {
    return (
      <YStack userSelect="none" px="$5">
        <YStack gap="$1" mt="$2">
          <SizableText size="$headingLg">Recommended</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {'Missing rewards: '}
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="balance"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
            >
              {profit.toString()}
            </NumberSizeableText>
          </SizableText>
        </YStack>
        {gtMd ? (
          <XStack gap="$3" $gtMd={{ flexWrap: 'wrap' }}>
            {tokens.map((token) => (
              <RecommendedItem key={token.symbol} token={token} />
            ))}
          </XStack>
        ) : (
          <YStack>
            {new Array(Math.ceil(tokens.length / 2)).fill(0).map((_, index) => (
              <XStack gap="$3" justifyContent="space-between" key={index}>
                <RecommendedItem token={tokens[index * 2]} />
                <RecommendedItem token={tokens[index * 2 + 1]} />
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    );
  }
  return null;
}

function Overview() {
  const [{ accounts }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const totalFiatValue = useMemo(
    () =>
      accounts
        ? accounts
            .reduce(
              (prev, account) => prev.plus(account.earn.totalFiatValue || 0),
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
            (prev, account) => prev.plus(account.earn.earnings24h || 0),
            new BigNumber(0),
          )
        : new BigNumber(0),
    [accounts],
  );
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.InvestmentDetails,
    });
  }, [navigation]);
  return (
    <YStack
      gap="$1"
      px="$5"
      borderRadius="$3"
      userSelect="none"
      {...listItemPressStyle}
      onPress={onPress}
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
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
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
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ availableAssets: assets = [] }] = useEarnAtom();
  const navigation = useAppNavigation();

  if (assets.length) {
    return (
      <YStack gap="$2" userSelect="none">
        <SizableText px="$5" size="$headingLg">
          Available assets
        </SizableText>
        {assets.map(({ name, logoURI, apr, networkId, symbol, tags = [] }) => (
          <ListItem
            key={name}
            mx={0}
            px="$5"
            onPress={async () => {
              await toTokenProviderListPage(navigation, {
                networkId,
                accountId: account?.id ?? '',
                indexedAccountId: indexedAccount?.id,
                symbol,
              });
            }}
            avatarProps={{ src: logoURI }}
            renderItemText={
              <XStack justifyContent="space-between" flex={1}>
                <XStack gap="$2">
                  <SizableText size="$bodyLgMedium">{name}</SizableText>
                  <XStack gap="$1">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        badgeType="critical"
                        badgeSize="sm"
                        userSelect="none"
                      >
                        <Badge.Text>{tag}</Badge.Text>
                      </Badge>
                    ))}
                  </XStack>
                </XStack>
                <XStack>
                  <SizableText size="$bodyLgMedium">{apr}</SizableText>
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
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  usePromiseResult(
    async () => {
      actions.current.clearEarnAccounts();
      const assets =
        await backgroundApiProxy.serviceStaking.getAvailableAssets();
      await actions.current.updateAvailableAssets(assets);

      await backgroundApiProxy.serviceStaking.fetchAllNetworkAssets({
        assets,
        accountId: account?.id ?? '',
        networkId: network?.id ?? '',
      });
    },
    [account, network, actions],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  useEffect(() => {
    const callback = async (payload: IEarnAccount) => {
      await actions.current.addEarnAccount(payload);
    };
    appEventBus.on(EAppEventBusNames.EarnAccountUpdate, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.EarnAccountUpdate, callback);
    };
  }, [actions]);

  return (
    <Page scrollEnabled>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        showHeaderRight={false}
      />
      <Page.Body>
        <YStack alignItems="center" py="$5">
          <YStack maxWidth="$180" w="100%" gap="$8">
            <Overview />
            <Recommended />
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
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicEarnHome />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
