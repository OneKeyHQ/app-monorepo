import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { AprText } from '../../components/AprText';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnNavigation } from '../../earnUtils';

import type { RouteProp } from '@react-navigation/core';

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnProtocols>;

function BasicEarnProtocols({ route }: { route: IRouteProps }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    symbol,
    filterNetworkId,
    logoURI: encodedLogoURI,
  } = route.params || {};

  const logoURI = useMemo(() => {
    try {
      return encodedLogoURI ? decodeURIComponent(encodedLogoURI) : undefined;
    } catch {
      return undefined;
    }
  }, [encodedLogoURI]);

  const media = useMedia();

  const isDesktopLayout = !platformEnv.isNative && media.gtSm;

  const customHeaderLeft = useMemo(
    () => (
      <>
        <Token source={logoURI} size="md" />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol ||
            intl.formatMessage({
              id: ETranslations.earn_symbol_staking_provider,
            })}
        </SizableText>
      </>
    ),
    [intl, symbol, logoURI],
  );

  const [protocolData, setProtocolData] = useState<IStakeProtocolListItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchProtocolData = useCallback(async () => {
    try {
      setIsLoading(true);

      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        filterNetworkId,
      });

      setProtocolData(data);
    } catch (error) {
      setProtocolData([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, filterNetworkId]);

  useEffect(() => {
    void fetchProtocolData();
  }, [fetchProtocolData]);

  const handleProtocolPress = useCallback(
    async (protocol: IStakeProtocolListItem) => {
      try {
        defaultLogger.staking.page.selectProvider({
          network: protocol.network.networkId,
          stakeProvider: protocol.provider.name,
        });

        await EarnNavigation.pushToEarnProtocolDetails(navigation, {
          networkId: protocol.network.networkId,
          symbol,
          provider: protocol.provider.name,
          vault: earnUtils.isVaultBasedProvider({
            providerName: protocol.provider.name,
          })
            ? protocol.provider.vault
            : undefined,
        });
      } catch (error) {
        // ignore error
      }
    },
    [symbol, navigation],
  );

  const columns: ITableColumn<IStakeProtocolListItem>[] = useMemo(() => {
    return [
      {
        key: 'protocol',
        label: intl.formatMessage({ id: ETranslations.global_protocol }),
        flex: 5,
        render: (item) => {
          return (
            <XStack jc="center" ai="center">
              <Stack mr="$3">
                <Token
                  size="md"
                  borderRadius="$2"
                  tokenImageUri={item.provider.logoURI}
                  showNetworkIcon={!isDesktopLayout}
                  networkId={item.network.networkId}
                />
              </Stack>
              <YStack mr="$2" flex={1} minWidth={0}>
                <XStack ai="center" gap="$2" minWidth={0}>
                  <SizableText size="$bodyLgMedium" flexShrink={0}>
                    {normalizeToEarnProvider(item.provider.name)}
                  </SizableText>
                  {item.provider.badges?.map((badge) => (
                    <Badge
                      my="auto"
                      key={badge.tag}
                      badgeType={badge.badgeType}
                      badgeSize="sm"
                      flexShrink={1}
                      minWidth={0}
                    >
                      <Badge.Text>{badge.tag}</Badge.Text>
                    </Badge>
                  ))}
                </XStack>
                {!isDesktopLayout && item?.provider?.description ? (
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {item.provider.description}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
          );
        },
      },
      {
        key: 'network',
        label: intl.formatMessage({ id: ETranslations.global_network }),
        flex: 1,
        hideInMobile: true,
        align: 'flex-end',
        render: (item) => (
          <NetworkAvatarGroup
            networkIds={[item.network.networkId]}
            size="$5"
            variant="spread"
            maxVisible={3}
          />
        ),
      },
      {
        key: 'tvl',
        label: intl.formatMessage({ id: ETranslations.earn_tvl }),
        flex: 2,
        hideInMobile: true,
        align: 'flex-end',
        render: (item) => (
          <SizableText size="$bodyLgMedium">
            <EarnText size="$bodyLg" text={item?.tvl} />
          </SizableText>
        ),
      },
      {
        key: 'yield',
        label: intl.formatMessage({ id: ETranslations.defi_apr_apy }),
        flex: 2,
        align: 'flex-end',
        render: (item) => (
          <AprText
            asset={{
              aprWithoutFee: item?.provider?.aprWithoutFee ?? '',
              aprInfo: item?.aprInfo,
            }}
          />
        ),
      },
    ];
  }, [intl, isDesktopLayout]);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <YStack>
          {/* Table Header - Desktop only */}
          {isDesktopLayout ? (
            <ListItem mx="$0" px="$5">
              <XStack flex={2.5}>
                <Skeleton h="$3" w={80} />
              </XStack>
              <XStack flex={1} jc="flex-end">
                <Skeleton h="$3" w={60} />
              </XStack>
              <XStack flex={2} jc="flex-end">
                <Skeleton h="$3" w={40} />
              </XStack>
              <XStack flex={2} jc="flex-end">
                <Skeleton h="$3" w={40} />
              </XStack>
            </ListItem>
          ) : null}

          {/* Table Rows */}
          {Array.from({ length: 3 }).map((_, index) => (
            <ListItem
              key={index}
              mx="$0"
              px="$5"
              ai={isDesktopLayout ? 'center' : 'flex-start'}
            >
              {/* Protocol column */}
              <XStack flex={isDesktopLayout ? 2.5 : 1} ai="center" gap="$3">
                <Skeleton w="$10" h="$10" borderRadius="$2" />
                <YStack gap="$1" flex={1}>
                  <Skeleton h="$4" w="70%" />
                  <Skeleton h="$3" w="50%" />
                </YStack>
              </XStack>

              {isDesktopLayout ? (
                <>
                  {/* Network column */}
                  <XStack flex={1} jc="flex-end">
                    <Skeleton w="$6" h="$6" borderRadius="$full" />
                  </XStack>
                  {/* TVL column */}
                  <XStack flex={2} jc="flex-end">
                    <Skeleton h="$4" w={100} />
                  </XStack>
                  {/* APR column */}
                  <XStack flex={2} jc="flex-end">
                    <Skeleton h="$4" w={80} />
                  </XStack>
                </>
              ) : (
                <YStack ai="flex-end">
                  <Skeleton h="$4" w={80} />
                </YStack>
              )}
            </ListItem>
          ))}
        </YStack>
      );
    }

    if (protocolData.length === 0) {
      return (
        <YStack alignItems="center" flex={1}>
          <Empty
            px="$5"
            py="$0"
            width="100%"
            icon="ErrorOutline"
            title={intl.formatMessage({
              id: ETranslations.earn_no_protocols_available,
            })}
            buttonProps={{
              flex: 1,
              children: intl.formatMessage({
                id: ETranslations.global_refresh,
              }),
              onPress: () => {
                void fetchProtocolData();
              },
            }}
          />
        </YStack>
      );
    }

    return (
      <TableList<IStakeProtocolListItem>
        data={protocolData}
        columns={columns}
        defaultSortKey="yield"
        defaultSortDirection="desc"
        onPressRow={handleProtocolPress}
        enableDrillIn={isDesktopLayout}
        isLoading={isLoading}
      />
    );
  }, [
    isLoading,
    protocolData,
    columns,
    handleProtocolPress,
    isDesktopLayout,
    intl,
    fetchProtocolData,
  ]);

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={customHeaderLeft}
      breadcrumbProps={{
        items: [
          {
            label: intl.formatMessage({ id: ETranslations.global_earn }),
            onClick: () => {
              void EarnNavigation.popToEarnHome(navigation);
            },
          },
          {
            label:
              symbol ||
              intl.formatMessage({
                id: ETranslations.earn_symbol_staking_provider,
              }),
          },
        ],
      }}
      showBackButton
    >
      {content}
    </EarnPageContainer>
  );
}

export default function EarnProtocols(props: { route: IRouteProps }) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <DiscoveryBrowserProviderMirror>
        <BasicEarnProtocols {...props} />
      </DiscoveryBrowserProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
