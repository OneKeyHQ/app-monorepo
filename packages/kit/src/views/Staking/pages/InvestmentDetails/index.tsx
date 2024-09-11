import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IEarnInvestmentItem,
  IInvestment,
} from '@onekeyhq/shared/types/staking';

import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';

function ListSkeletonItem() {
  return (
    <ListItem
      drillIn
      px={0}
      mx={0}
      renderAvatar={<Skeleton w="$10" h="$10" radius="round" />}
      renderItemText={
        <YStack flex={1} justifyContent="space-between" h="$10">
          <Skeleton h="$4" w={80} borderRadius="$3" />
          <Skeleton h="$4" w={120} borderRadius="$3" />
        </YStack>
      }
    />
  );
}

const isTrue = (value: number | string) => Number(value) > 0;
function BasicInvestmentDetails() {
  const accountInfo = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const [{ accounts }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { result: earnInvestmentItems = [], isLoading } = usePromiseResult(
    () => {
      const totalFiatMapKey = actions.current.buildEarnAccountsKey(
        accountInfo.activeAccount?.account?.id,
        accountInfo.activeAccount?.network?.id,
      );
      const list = accounts?.[totalFiatMapKey] || [];
      return list.length
        ? backgroundApiProxy.serviceStaking.fetchInvestmentDetail(
            list.map(({ networkId, accountAddress, publicKey }) => ({
              networkId,
              accountAddress,
              publicKey,
            })),
          )
        : new Promise<IEarnInvestmentItem[]>((resolve) => {
            setTimeout(() => resolve([]), 1500);
          });
    },
    [
      accountInfo.activeAccount?.account?.id,
      accountInfo.activeAccount?.network?.id,
      accounts,
      actions,
    ],
    {
      watchLoading: true,
    },
  );

  const sectionData = earnInvestmentItems
    .map((item) => ({
      title: item.name,
      logoURI: item.logoURI,
      data: item.investment
        .map((i) => ({ ...i, providerName: item.name }))
        .filter((i) => !new BigNumber(i.staked).isZero()),
    }))
    .filter((i) => i.data.length > 0);
  const renderItem = useCallback(
    ({
      item: {
        tokenInfo,
        staked,
        stakedFiatValue,
        claimable,
        overflow,
        providerName,
      },
    }: {
      item: IInvestment & { providerName: string };
    }) => (
      <ListItem
        drillIn
        mx={0}
        px="$5"
        onPress={() => {
          const {
            activeAccount: { account, indexedAccount },
          } = accountInfo;
          if (account && tokenInfo) {
            navigation.push(EModalStakingRoutes.ProtocolDetails, {
              indexedAccountId: indexedAccount?.id,
              accountId: account?.id ?? '',
              networkId: tokenInfo.networkId,
              symbol: tokenInfo.symbol.toUpperCase(),
              provider: providerName,
            });
          }
        }}
        avatarProps={{
          src: tokenInfo.logoURI,
        }}
        renderItemText={
          <XStack justifyContent="space-between" flex={1}>
            <YStack>
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: tokenInfo.symbol }}
              >
                {staked}
              </NumberSizeableText>
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="balance"
                formatterOptions={{
                  currency: settings.currencyInfo.symbol,
                }}
              >
                {stakedFiatValue}
              </NumberSizeableText>
            </YStack>
            <Stack $gtMd={{ flexDirection: 'row' }} gap="$1.5">
              {isTrue(claimable) ? (
                <Badge
                  badgeType="info"
                  badgeSize="sm"
                  userSelect="none"
                  my="auto"
                >
                  <Badge.Text>
                    {intl.formatMessage({ id: ETranslations.earn_claimable })}
                  </Badge.Text>
                </Badge>
              ) : null}
              {isTrue(overflow) ? (
                <Badge
                  badgeType="critical"
                  badgeSize="sm"
                  userSelect="none"
                  my="auto"
                >
                  <Badge.Text>
                    {intl.formatMessage({ id: ETranslations.earn_overflow })}
                  </Badge.Text>
                </Badge>
              ) : null}
            </Stack>
          </XStack>
        }
      />
    ),
    [accountInfo, intl, navigation, settings.currencyInfo.symbol],
  );
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.earn_investment_details,
        })}
      />
      <Page.Body>
        <SectionList
          ListEmptyComponent={
            isLoading ? (
              <YStack px="$4">
                <XStack gap="$1.5" py="$3">
                  <Skeleton width="$5" height="$5" radius="round" />
                  <Skeleton h="$5" w={80} borderRadius="$3" />
                </XStack>
                <ListSkeletonItem />
                <ListSkeletonItem />
                <ListSkeletonItem />
              </YStack>
            ) : (
              <YStack flex={1} alignItems="center">
                <Icon size="$16" mt="$5" name="ClockTimeHistoryOutline" />
                <SizableText mt="$6" size="$headingXl">
                  {intl.formatMessage({ id: ETranslations.earn_no_orders })}
                </SizableText>
                <SizableText mt="$2" size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.earn_no_orders_desc,
                  })}
                </SizableText>
              </YStack>
            )
          }
          renderItem={renderItem}
          sections={sectionData}
          py="$3"
          renderSectionHeader={({
            section: { title, logoURI },
          }: {
            section: {
              title: string;
              logoURI: string;
            };
          }) => (
            <XStack px="$5" gap="$1.5" py="$3">
              <Image height="$5" width="$5" borderRadius="$1">
                <Image.Source
                  source={{
                    uri: logoURI,
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
              <SizableText color="$textSubdued" size="$bodyMdMedium">
                {`${title.charAt(0).toUpperCase()}${title.slice(1)}`}
              </SizableText>
            </XStack>
          )}
          estimatedItemSize={60}
        />
      </Page.Body>
    </Page>
  );
}

export default function InvestmentDetails() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicInvestmentDetails />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
