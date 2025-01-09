import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  Heading,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SectionList,
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
    <ListItem>
      <Skeleton w="$10" h="$10" radius="round" />
      <YStack>
        <YStack py="$1">
          <Skeleton h="$4" w={120} borderRadius="$2" />
        </YStack>
        <YStack py="$1">
          <Skeleton h="$3" w={80} borderRadius="$2" />
        </YStack>
      </YStack>
    </ListItem>
  );
}

const isTrue = (value: number | string) => Number(value) > 0;
function BasicInvestmentDetails() {
  const accountInfo = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { result: earnInvestmentItems = [], isLoading } = usePromiseResult(
    () => {
      const totalFiatMapKey = actions.current.buildEarnAccountsKey(
        accountInfo.activeAccount?.account?.id,
        accountInfo.activeAccount?.network?.id,
      );
      const list = earnAccount?.[totalFiatMapKey]?.accounts || [];
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
      actions,
      earnAccount,
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
        userSelect="none"
        drillIn
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
          networkId: tokenInfo.networkId,
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
              <YStack>
                <XStack px="$5" gap="$3" py="$3">
                  <Skeleton width="$6" height="$6" radius="round" />
                  <YStack py="$1">
                    <Skeleton h="$3" w={80} borderRadius="$2" />
                  </YStack>
                </XStack>
                <ListSkeletonItem />
                <ListSkeletonItem />
                <ListSkeletonItem />
              </YStack>
            ) : (
              <Empty
                pt={180}
                icon="ClockTimeHistoryOutline"
                title={intl.formatMessage({ id: ETranslations.earn_no_orders })}
                description={intl.formatMessage({
                  id: ETranslations.earn_no_orders_desc,
                })}
              />
            )
          }
          renderItem={renderItem}
          sections={sectionData}
          renderSectionHeader={({
            section: { title, logoURI },
          }: {
            section: {
              title: string;
              logoURI: string;
            };
          }) => (
            <XStack px="$5" gap="$3" py="$3" alignItems="center">
              <Image height="$6" width="$6" borderRadius="$1">
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
              <Heading color="$textSubdued" size="$headingSm">
                {`${title.charAt(0).toUpperCase()}${title.slice(1)}`}
              </Heading>
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
