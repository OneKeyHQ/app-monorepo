import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
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
import { useEarnAccountKey } from '@onekeyhq/kit/src/views/Earn/hooks/useEarnAccountKey';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  ETabEarnRoutes,
} from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IEarnAccount,
  IEarnAlert,
  IEarnInvestmentItem,
  IEarnRewardNum,
  IEarnSummary,
  IInvestment,
} from '@onekeyhq/shared/types/staking';

import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { EarnActionIcon } from '../../components/ProtocolDetails/EarnActionIcon';
import { EarnAlert } from '../../components/ProtocolDetails/EarnAlert';
import { EarnIcon } from '../../components/ProtocolDetails/EarnIcon';
import { EarnText } from '../../components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../components/ProtocolDetails/EarnTooltip';

function EarnOverview({
  earnSummary,
  onHistory,
}: {
  earnSummary: IEarnSummary | undefined;
  onHistory: (params?: { filterType?: string }) => void;
}) {
  if (!earnSummary?.items?.length) {
    return null;
  }
  return (
    <YStack px="$5">
      <EarnAlert alerts={earnSummary.alerts} />
      <XStack ai="center" jc="space-between" h={44}>
        <XStack ai="center" gap="$1.5">
          <EarnIcon size="$5" icon={earnSummary.icon} />
          <EarnText
            text={earnSummary.title}
            size="$bodyMdMedium"
            color="$textSubdued"
          />
        </XStack>
        <EarnActionIcon
          actionIcon={earnSummary.items[0].button}
          onHistory={onHistory}
        />
      </XStack>
      <YStack>
        {earnSummary.items.map((item) => (
          <XStack ai="center" h="$10" jc="space-between" key={item.title.text}>
            <XStack gap="$1.5" key={item.title.text}>
              <EarnText
                key={item.title.text}
                text={item.title}
                size="$bodyMd"
              />
              <EarnText
                text={item.description}
                size="$bodyMd"
                color="$textSubdued"
              />
              <EarnTooltip tooltip={item.tooltip} />
            </XStack>
          </XStack>
        ))}
      </YStack>
      <Divider my="$3" />
    </YStack>
  );
}

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

const isTrue = (value: number | string | undefined) =>
  value && Number(value) > 0;
const hasPositiveReward = ({
  rewardNum,
}: {
  rewardNum: IEarnRewardNum | undefined;
}): boolean => {
  if (!rewardNum) {
    return false;
  }
  return Object.values(rewardNum).some((value) =>
    new BigNumber(value.claimableNow).isGreaterThan(0),
  );
};

function BasicInvestmentDetails() {
  const accountInfo = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const [EarnData] = useEarnAtom();
  const earnAccount = EarnData.earnAccount;
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const allNetworkId = useMemo(() => getNetworkIdsMap().onekeyall, []);
  const evmNetworkId = useMemo(() => getNetworkIdsMap().eth, []);
  const totalFiatMapKey = useEarnAccountKey();

  const { result, isLoading } = usePromiseResult(
    async () => {
      let list = earnAccount?.[totalFiatMapKey]?.accounts || [];
      if (list.length === 0) {
        const earnAccountOnNetwork =
          await backgroundApiProxy.serviceStaking.fetchAllNetworkAssets({
            accountId: accountInfo.activeAccount?.account?.id ?? '',
            networkId: allNetworkId,
            indexedAccountId: accountInfo.activeAccount?.indexedAccount?.id,
          });
        list = earnAccountOnNetwork.accounts;
      }

      if (list.length > 0) {
        const response =
          await backgroundApiProxy.serviceStaking.fetchInvestmentDetail(
            list.map(({ networkId, accountAddress, publicKey }) => ({
              networkId,
              accountAddress,
              publicKey,
            })),
          );
        const evmAccount = list.find((item) => item.networkId === evmNetworkId);
        // XXX
        if (evmAccount) {
          const earnSummary =
            await backgroundApiProxy.serviceStaking.getEarnSummary(evmAccount);
          return {
            evmAccount,
            earnSummary,
            earnInvestmentItems: response,
          };
        }
        return {
          earnSummary: undefined,
          evmAccount: undefined,
          earnInvestmentItems: response,
        };
      }

      return {
        earnSummary: undefined,
        evmAccount: undefined,
        earnInvestmentItems: [],
      };
    },
    [
      accountInfo.activeAccount?.account?.id,
      accountInfo.activeAccount?.indexedAccount?.id,
      allNetworkId,
      earnAccount,
      evmNetworkId,
      totalFiatMapKey,
    ],
    {
      watchLoading: true,
    },
  );

  const {
    earnSummary,
    evmAccount,
    earnInvestmentItems = [],
  } = result ||
  ({} as {
    earnSummary: IEarnSummary | undefined;
    evmAccount: IEarnAccount | undefined;
    earnInvestmentItems: IEarnInvestmentItem[];
  });

  const appNavigation = useAppNavigation();
  const onHistory = useMemo(() => {
    return async (params?: { filterType?: string }) => {
      if (!evmAccount) {
        return;
      }
      const { filterType } = params || {};
      const currentEarnAccount =
        await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId: accountInfo.activeAccount?.account?.id || '',
          indexedAccountId: accountInfo.activeAccount?.indexedAccount?.id || '',
          networkId: evmNetworkId,
          btcOnlyTaproot: true,
        });
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        title: intl.formatMessage({
          id: ETranslations.referral_reward_history,
        }),
        alerts: [
          {
            key: ESpotlightTour.earnRewardHistory,
            badge: 'info',
            alert: intl.formatMessage({
              id: ETranslations.earn_reward_distribution_schedule,
            }),
          } as IEarnAlert,
        ],
        accountId: currentEarnAccount?.account.id,
        networkId: evmNetworkId,
        filterType,
      });
    };
  }, [
    evmAccount,
    accountInfo.activeAccount?.account?.id,
    accountInfo.activeAccount?.indexedAccount?.id,
    evmNetworkId,
    appNavigation,
    intl,
  ]);

  const sectionData = useMemo(() => {
    return earnInvestmentItems
      .map((item) => ({
        title: item.name,
        logoURI: item.logoURI,
        data: item.investment
          .map((i) => ({ ...i, providerName: item.name }))
          .filter((i) => !new BigNumber(i.staked).isZero()),
      }))
      .filter((i) => i.data.length > 0);
  }, [earnInvestmentItems]);
  const renderItem = useCallback(
    ({
      item: {
        tokenInfo,
        staked,
        stakedFiatValue,
        claimable,
        overflow,
        providerName,
        rewardNum,
        rewards,
        vault,
      },
    }: {
      item: IInvestment & { providerName: string };
    }) => (
      <ListItem
        userSelect="none"
        drillIn
        onPress={async () => {
          if (tokenInfo) {
            navigation.push(ETabEarnRoutes.EarnProtocolDetails, {
              networkId: tokenInfo.networkId,
              symbol: tokenInfo.symbol,
              provider: providerName,
              vault,
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
              {isTrue(claimable) ||
              hasPositiveReward({ rewardNum }) ||
              isTrue(rewards) ? (
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
    [intl, navigation, settings.currencyInfo.symbol],
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
          ListHeaderComponent={
            <EarnOverview earnSummary={earnSummary} onHistory={onHistory} />
          }
          ListFooterComponent={<YStack height="$5" />}
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
              <Image
                size="$6"
                borderRadius="$1"
                source={{ uri: logoURI }}
                fallback={
                  <Image.Fallback
                    w="$6"
                    h="$6"
                    alignItems="center"
                    justifyContent="center"
                    bg="$bgStrong"
                  >
                    <Icon size="$5" name="CoinOutline" color="$iconDisabled" />
                  </Image.Fallback>
                }
              />
              <Heading color="$textSubdued" size="$headingSm">
                {`${title.charAt(0).toUpperCase()}${title.slice(1)}`}
              </Heading>
            </XStack>
          )}
          SectionSeparatorComponent={
            <XStack h="$6" px="$5" ai="center">
              <Divider />
            </XStack>
          }
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
