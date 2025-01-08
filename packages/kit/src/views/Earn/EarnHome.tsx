import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IIconButtonProps,
  IKeyOfIcons,
  ISizableTextProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Badge,
  Banner,
  Button,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  Popover,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getPrimaryColor } from '@onekeyhq/shared/src/modules3rdParty/react-native-image-colors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
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

import { EARN_PAGE_MAX_WIDTH, EARN_RIGHT_PANEL_WIDTH } from './EarnConfig';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';

interface ITokenAccount extends IEarnAccountToken {
  account: IEarnAccount;
}

const buildAprText = (apr: string) => (apr.endsWith('%') ? `${apr} APR` : apr);
const getNumberColor = (
  value: string | number,
  defaultColor: ISizableTextProps['color'] = '$textSuccess',
): ISizableTextProps['color'] =>
  (typeof value === 'string' ? Number(value) : value) === 0
    ? '$textDisabled'
    : defaultColor;

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
  defaultLogger.staking.page.selectAsset({ tokenSymbol: symbol });
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

function RecommendedSkeletonItem({ ...rest }: IYStackProps) {
  return (
    <YStack
      gap="$4"
      px="$4"
      py="$3.5"
      borderRadius="$3"
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
      {...rest}
    >
      <XStack gap="$3" alignItems="center">
        <Skeleton width="$8" height="$8" radius="round" />
        <YStack py="$1">
          <Skeleton w={56} h={16} borderRadius="$2" />
        </YStack>
      </XStack>
      <YStack gap="$1">
        <YStack py="$1">
          <Skeleton w={80} h={20} borderRadius="$2" />
        </YStack>
        <YStack py="$1">
          <Skeleton w={120} h={12} borderRadius="$2" />
        </YStack>
      </YStack>
    </YStack>
  );
}

function RecommendedItem({
  token,
  ...rest
}: { token?: ITokenAccount } & IYStackProps) {
  const intl = useIntl();
  const accountInfo = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const [decorationColor, setDecorationColor] = useState<string | null>(null);

  useEffect(() => {
    const url = token?.logoURI;
    if (url) {
      void getPrimaryColor(url, '$bgSubdued').then(setDecorationColor);
    }
  }, [token?.logoURI]);

  const onPress = useCallback(async () => {
    const {
      activeAccount: { account, indexedAccount },
    } = accountInfo;
    if (account && token) {
      await toTokenProviderListPage(navigation, {
        indexedAccountId: indexedAccount?.id,
        accountId: account?.id ?? '',
        networkId: token.account.networkId,
        symbol: token.symbol,
      });
    }
  }, [accountInfo, navigation, token]);

  if (!token) {
    return <YStack width="$40" flexGrow={1} />;
  }

  return (
    <YStack
      role="button"
      flex={1}
      px="$4"
      py="$3.5"
      borderRadius="$3"
      borderCurve="continuous"
      // bg={decorationColor || '$bgSubdued'} // $bgSubdued is the default color. Will cause a blink.
      bg={decorationColor}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      animation="quick"
      hoverStyle={{
        scale: 1.05,
      }}
      pressStyle={{
        scale: 0.95,
      }}
      onPress={onPress}
      userSelect="none"
      {...rest}
    >
      <XStack gap="$3" alignItems="center">
        <YStack>
          <Image size="$8">
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
        </YStack>
        <SizableText size="$bodyLgMedium">
          {token.symbol.toUpperCase()}
        </SizableText>
      </XStack>
      <SizableText size="$headingXl" pt="$4" pb="$1">
        {buildAprText(token.apr)}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {`${intl.formatMessage({ id: ETranslations.global_available })}: `}
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="balance"
          formatterOptions={{ tokenSymbol: token.symbol.toUpperCase() }}
        >
          {token.balanceParsed}
        </NumberSizeableText>
      </SizableText>
    </YStack>
  );
}

function RecommendedContainer({
  profit,
  children,
}: PropsWithChildren<{ profit: BigNumber }>) {
  const [settings] = useSettingsPersistAtom();
  const intl = useIntl();
  return (
    <YStack gap="$3">
      {/* since the children have been used negative margin, so we should use zIndex to make sure the trigger of popover is on top of the children */}
      <YStack gap="$1" zIndex={10}>
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_recommended })}
        </SizableText>
        <XStack gap="$1.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {`${intl.formatMessage({
              id: ETranslations.earn_missing_rewards,
            })}: `}
            <NumberSizeableText
              size="$bodyMdMedium"
              color="$textSuccess"
              formatter="balance"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
            >
              {profit.toFixed()}
            </NumberSizeableText>
          </SizableText>
          <Popover
            placement="bottom-start"
            title={intl.formatMessage({
              id: ETranslations.earn_missing_rewards,
            })}
            renderContent={
              <SizableText px="$5" py="$4">
                {intl.formatMessage({
                  id: ETranslations.earn_missing_rewards_tooltip,
                })}
              </SizableText>
            }
            renderTrigger={
              <IconButton
                variant="tertiary"
                size="small"
                icon="InfoCircleOutline"
              />
            }
          />
        </XStack>
      </YStack>
      {children}
    </YStack>
  );
}

function Recommended({
  isFetchingAccounts = false,
}: {
  isFetchingAccounts: boolean;
}) {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const totalFiatMapKey = useMemo(
    () => actions.current.buildEarnAccountsKey(account?.id, network?.id),
    [account?.id, actions, network?.id],
  );
  const [{ earnAccount }] = useEarnAtom();
  const { tokens, profit } = useMemo(() => {
    const accountTokens: ITokenAccount[] = [];
    let totalProfit = new BigNumber(0);
    const list = earnAccount?.[totalFiatMapKey]?.accounts || [];
    list?.forEach((accountItem) => {
      accountItem.tokens.forEach((token) => {
        totalProfit = totalProfit.plus(token.profit || 0);
        accountTokens.push({
          ...token,
          account: accountItem,
        });
      });
    });
    return {
      tokens: accountTokens,
      profit: totalProfit,
    };
  }, [earnAccount, totalFiatMapKey]);
  if (isFetchingAccounts && tokens.length < 1) {
    return (
      <RecommendedContainer profit={profit}>
        <XStack m="$-5" p="$3.5">
          {Array.from({ length: 2 }).map((_, index) => (
            <YStack
              key={index}
              p="$1.5"
              flexBasis="50%"
              $gtLg={{
                flexBasis: '33.33%',
              }}
            >
              <RecommendedSkeletonItem />
            </YStack>
          ))}
        </XStack>
      </RecommendedContainer>
    );
  }
  if (tokens.length) {
    return (
      <RecommendedContainer profit={profit}>
        <XStack m="$-5" p="$3.5" flexWrap="wrap">
          {tokens.map((token) => (
            <YStack
              key={token.symbol}
              p="$1.5"
              flexBasis="50%"
              $gtLg={{
                flexBasis: '33.33%',
              }}
            >
              <RecommendedItem token={token} />
            </YStack>
          ))}
        </XStack>
      </RecommendedContainer>
    );
  }
  return null;
}

function Overview({ isFetchingAccounts }: { isFetchingAccounts: boolean }) {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const totalFiatMapKey = useMemo(
    () => actions.current.buildEarnAccountsKey(account?.id, network?.id),
    [account?.id, actions, network?.id],
  );
  const [{ earnAccount }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const totalFiatValue = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.totalFiatValue || '0',
    [earnAccount, totalFiatMapKey],
  );
  const earnings24h = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.earnings24h || '0',
    [earnAccount, totalFiatMapKey],
  );
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.InvestmentDetails,
    });
  }, [navigation]);
  const intl = useIntl();
  return (
    <YStack
      gap="$1"
      $gtLg={{
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: '$8',
        p: '$8',
        bg: '$bg',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
        borderRadius: '$3',
        borderCurve: 'continuous',
        elevation: 0.5,
      }}
    >
      {/* total value */}
      <YStack gap="$1.5" flexShrink={1}>
        <SizableText
          size="$bodyLgMedium"
          $gtLg={{
            pl: '$0.5',
          }}
        >
          {intl.formatMessage({ id: ETranslations.earn_total_staked_value })}
        </SizableText>
        <NumberSizeableText
          size="$heading5xl"
          formatter="price"
          color={getNumberColor(totalFiatValue, '$text')}
          formatterOptions={{ currency: settings.currencyInfo.symbol }}
          numberOfLines={1}
        >
          {totalFiatValue}
        </NumberSizeableText>
      </YStack>
      {/* 24h earnings */}
      <XStack
        gap="$1.5"
        flexShrink={1}
        $gtLg={{
          flexDirection: 'column-reverse',
        }}
      >
        <NumberSizeableText
          formatter="price"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
            showPlusMinusSigns: Number(earnings24h) !== 0,
          }}
          size="$bodyLgMedium"
          color={getNumberColor(earnings24h)}
          numberOfLines={1}
          $gtLg={{
            size: '$heading5xl',
          }}
        >
          {earnings24h}
        </NumberSizeableText>
        <XStack gap="$1.5" alignItems="center">
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            $gtLg={{
              pl: '$0.5',
              color: '$text',
              size: '$bodyLgMedium',
            }}
          >
            {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
          </SizableText>
          <Popover
            placement="bottom-start"
            renderTrigger={
              <IconButton
                variant="tertiary"
                size="small"
                icon="InfoCircleOutline"
              />
            }
            title={intl.formatMessage({
              id: ETranslations.earn_24h_earnings,
            })}
            renderContent={
              <SizableText px="$5" py="$4">
                {intl.formatMessage({
                  id: ETranslations.earn_24h_earnings_tooltip,
                })}
              </SizableText>
            }
          />
        </XStack>
      </XStack>

      {/* details button */}
      {isFetchingAccounts ? null : (
        <Button
          onPress={onPress}
          variant="tertiary"
          iconAfter="ChevronRightOutline"
          position="absolute"
          top={0}
          right={0}
          $gtLg={{
            right: '$8',
            top: '$8',
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_details })}
        </Button>
      )}
    </YStack>
  );
}
function AvailableAssets() {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ availableAssets: assets = [] }] = useEarnAtom();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const media = useMedia();

  if (assets.length) {
    return (
      <YStack gap="$3">
        <YStack gap="$1">
          <SizableText size="$headingLg">
            {intl.formatMessage({ id: ETranslations.earn_available_assets })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.earn_available_assets_desc,
            })}
          </SizableText>
        </YStack>
        <YStack
          mx="$-5"
          $gtLg={{
            mx: 0,
            overflow: 'hidden',
            bg: '$bg',
            borderRadius: '$3',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$borderSubdued',
            borderCurve: 'continuous',
          }}
        >
          {assets.map(
            ({ name, logoURI, apr, networkId, symbol, tags = [] }, index) => (
              <ListItem
                userSelect="none"
                key={name}
                onPress={async () => {
                  await toTokenProviderListPage(navigation, {
                    networkId,
                    accountId: account?.id ?? '',
                    indexedAccountId: indexedAccount?.id,
                    symbol,
                  });
                }}
                avatarProps={{
                  src: logoURI,
                  fallbackProps: {
                    borderRadius: '$full',
                  },
                  ...(media.gtLg
                    ? {
                        size: '$8',
                      }
                    : {}),
                }}
                {...(media.gtLg
                  ? {
                      drillIn: true,
                      mx: '$0',
                      px: '$4',
                      borderRadius: '$0',
                    }
                  : {})}
                {...(index !== 0 && media.gtLg
                  ? {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: '$borderSubdued',
                    }
                  : {})}
              >
                <ListItem.Text
                  flexGrow={1}
                  flexBasis={0}
                  primary={
                    <XStack gap="$2" alignItems="center">
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
                  }
                />
                <ListItem.Text
                  $gtLg={{
                    flexGrow: 1,
                    flexBasis: 0,
                  }}
                  primary={buildAprText(apr)}
                />
              </ListItem>
            ),
          )}
        </YStack>
      </YStack>
    );
  }
  return null;
}

const bannerIconStyle: Omit<IIconButtonProps, 'icon'> = {
  bottom: '$3',
  size: 'small',
  transform: platformEnv.isNative ? '' : 'unset',
};

function BasicEarnHome() {
  const {
    activeAccount: { account, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const media = useMedia();
  const actions = useEarnActions();
  const { isLoading: isFetchingAccounts, result } = usePromiseResult(
    async () => {
      const totalFiatMapKey = actions.current.buildEarnAccountsKey(
        account?.id,
        network?.id,
      );
      let assets = actions.current.getAvailableAssets();
      if (assets.length === 0) {
        assets = await backgroundApiProxy.serviceStaking.getAvailableAssets();
        actions.current.updateAvailableAssets(assets);
      } else {
        setTimeout(() => {
          void backgroundApiProxy.serviceStaking
            .getAvailableAssets()
            .then(actions.current.updateAvailableAssets);
        });
      }

      const fetchAndUpdateAction = async () => {
        const earnAccount =
          await backgroundApiProxy.serviceStaking.fetchAllNetworkAssets({
            assets,
            accountId: account?.id ?? '',
            networkId: network?.id ?? '',
          });
        const earnAccountData = actions.current.getEarnAccount(totalFiatMapKey);
        actions.current.updateEarnAccounts({
          key: totalFiatMapKey,
          earnAccount: {
            ...earnAccountData,
            ...earnAccount,
          },
        });
      };
      const fetchAndUpdateOverview = async () => {
        const overviewData =
          await backgroundApiProxy.serviceStaking.fetchAccountOverview({
            assets,
            accountId: account?.id ?? '',
            networkId: network?.id ?? '',
          });
        const earnAccountData = actions.current.getEarnAccount(totalFiatMapKey);
        actions.current.updateEarnAccounts({
          key: totalFiatMapKey,
          earnAccount: {
            accounts: earnAccountData?.accounts || [],
            ...overviewData,
          },
        });
      };
      const earnAccountData = actions.current.getEarnAccount(totalFiatMapKey);
      if (earnAccountData) {
        setTimeout(() => {
          void fetchAndUpdateOverview();
          void fetchAndUpdateAction();
        });
      } else {
        await fetchAndUpdateAction();
        void fetchAndUpdateOverview();
      }
      return { loaded: true };
    },
    [actions, account?.id, network?.id],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
      revalidateOnReconnect: true,
      alwaysSetState: true,
    },
  );

  const { result: earnBanners } = usePromiseResult(
    async () => {
      const bannerResult =
        await backgroundApiProxy.serviceStaking.fetchEarnHomePageData();
      return (
        bannerResult?.map((i) => ({
          ...i,
          imgUrl: i.src,
          title: i.title || '',
          titleTextProps: {
            size: '$headingMd',
          },
        })) || []
      );
    },
    [],
    {
      revalidateOnReconnect: true,
    },
  );

  const INTRODUCTION_ITEMS: {
    icon: IKeyOfIcons;
    title: string;
    description: string;
  }[] = [
    {
      icon: 'HandCoinsOutline',
      title: intl.formatMessage({
        id: ETranslations.earn_feature_1_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.earn_feature_1_desc,
      }),
    },
    {
      icon: 'LockOutline',
      title: intl.formatMessage({
        id: ETranslations.earn_feature_2_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.earn_feature_2_desc,
      }),
    },
    {
      icon: 'ChartColumnar3Outline',
      title: intl.formatMessage({
        id: ETranslations.earn_feature_3_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.earn_feature_3_desc,
      }),
    },
  ];

  const navigation = useAppNavigation();

  const onBannerPress = useCallback(
    async ({
      hrefType,
      href,
    }: {
      imgUrl: string;
      title: string;
      bannerId: string;
      src: string;
      href: string;
      hrefType: string;
      rank: number;
      useSystemBrowser: boolean;
      theme?: 'light' | 'dark';
    }) => {
      if (account) {
        if (href.includes('/earn/staking')) {
          const [path, query] = href.split('?');
          const paths = path.split('/');
          const provider = paths.pop();
          const symbol = paths.pop();
          const params = new URLSearchParams(query);
          const networkId = params.get('networkId');
          if (provider && symbol && networkId) {
            void EarnNavigation.pushDetailPageFromDeeplink(navigation, {
              accountId: account?.id ?? '',
              indexedAccountId: indexedAccount?.id,
              provider,
              symbol,
              networkId,
            });
          }
          return;
        }
        if (hrefType === 'external') {
          openUrlExternal(href);
        } else {
          openUrlInApp(href);
        }
      }
    },
    [account, indexedAccount?.id, navigation],
  );

  const banners = useMemo(() => {
    if (earnBanners) {
      return earnBanners.length ? (
        <Banner
          showPaginationButton={!platformEnv.isNative}
          height="$36"
          $md={{
            height: '$28',
          }}
          data={earnBanners}
          onItemPress={onBannerPress}
          isLoading={false}
          leftIconButtonStyle={{
            ...bannerIconStyle,
            left: '$3.5',
          }}
          rightIconButtonStyle={{
            ...bannerIconStyle,
            right: '$3.5',
          }}
          indicatorContainerStyle={{
            right: 0,
            width: '100%',
            jc: 'center',
            bottom: '$5',
          }}
          itemTitleContainerStyle={{
            top: 0,
            bottom: 0,
            right: '$5',
            left: '$5',
            justifyContent: 'center',
          }}
        />
      ) : null;
    }
    return (
      <Skeleton
        height="$36"
        $md={{
          height: '$28',
        }}
        width="100%"
      />
    );
  }, [earnBanners, onBannerPress]);

  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        showHeaderRight={false}
      />
      <Page.Body>
        <ScrollView contentContainerStyle={{ py: '$5' }}>
          {/* container */}
          <YStack w="100%" maxWidth={EARN_PAGE_MAX_WIDTH} mx="auto" gap="$4">
            {/* overview and banner */}
            <YStack
              px="$5"
              gap="$8"
              $gtLg={{
                flexDirection: 'row',
              }}
            >
              <Overview
                isFetchingAccounts={Boolean(
                  result === undefined || !!isFetchingAccounts,
                )}
              />
              <YStack
                minHeight="$36"
                $md={{
                  minHeight: '$28',
                }}
                borderRadius="$3"
                width="100%"
                borderCurve="continuous"
                $gtLg={{
                  w: EARN_RIGHT_PANEL_WIDTH,
                }}
              >
                {banners}
              </YStack>
            </YStack>
            {/* Recommended, available assets and introduction */}
            <YStack
              px="$5"
              gap="$8"
              $gtLg={{
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <YStack
                pt="$3.5"
                gap="$8"
                $gtLg={{
                  flex: 1,
                }}
              >
                <Recommended isFetchingAccounts={!!isFetchingAccounts} />
                <AvailableAssets />
              </YStack>
              {media.gtLg ? (
                <YStack
                  gap="$6"
                  p="$4"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="$transparent"
                  borderRadius="$3"
                  borderCurve="continuous"
                  bg="$bgSubdued"
                  $gtMd={{
                    w: EARN_RIGHT_PANEL_WIDTH,
                  }}
                >
                  <SizableText size="$headingSm">
                    {intl.formatMessage({
                      id: ETranslations.earn_feature_list_title,
                    })}
                  </SizableText>
                  {INTRODUCTION_ITEMS.map((item, index) => (
                    <YStack key={index} gap="$3" alignItems="flex-start">
                      <YStack
                        p="$2"
                        bg="$bgStrong"
                        borderRadius="$3"
                        borderCurve="continuous"
                      >
                        <Icon name={item.icon} color="$iconSubdued" />
                      </YStack>
                      <YStack gap="$1.5">
                        <SizableText size="$bodyMdMedium">
                          {item.title}
                        </SizableText>
                        <SizableText size="$bodyMd" color="$textSubdued">
                          {item.description}
                        </SizableText>
                      </YStack>
                    </YStack>
                  ))}
                </YStack>
              ) : null}
            </YStack>
          </YStack>
        </ScrollView>
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
