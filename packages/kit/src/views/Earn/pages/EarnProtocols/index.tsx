import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  Image,
  SizableText,
  Skeleton,
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
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { AprText } from '../../components/AprText';
import { EarnPageContainer } from '../../components/EarnPageContainer';

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
  const { activeAccount } = useActiveAccount({ num: 0 });

  const customHeaderLeft = useMemo(
    () => (
      <>
        <Image source={logoURI} size="$8" />
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
    if (!activeAccount?.account?.id) {
      return;
    }

    try {
      setIsLoading(true);

      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId: activeAccount.account.id,
        indexedAccountId: activeAccount.indexedAccount?.id,
        filterNetworkId,
      });

      // const groupedData = groupProtocolsByGroup(intl, data);
      setProtocolData(data);
    } catch (error) {
      console.error('Failed to fetch protocol data:', error);
      setProtocolData([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    symbol,
    activeAccount?.account?.id,
    activeAccount?.indexedAccount?.id,
    filterNetworkId,
  ]);

  useEffect(() => {
    void fetchProtocolData();
  }, [fetchProtocolData]);

  const handleProtocolPress = useCallback(
    async (protocol: IStakeProtocolListItem) => {
      if (!activeAccount?.account?.id) {
        return;
      }

      try {
        defaultLogger.staking.page.selectProvider({
          network: protocol.network.networkId,
          stakeProvider: protocol.provider.name,
        });

        const earnAccount =
          await backgroundApiProxy.serviceStaking.getEarnAccount({
            accountId: activeAccount.account.id,
            indexedAccountId: activeAccount.indexedAccount?.id,
            networkId: protocol.network.networkId,
          });

        navigation.push(ETabEarnRoutes.EarnProtocolDetails, {
          networkId: protocol.network.networkId,
          accountId: earnAccount?.accountId || activeAccount.account.id,
          indexedAccountId:
            earnAccount?.account.indexedAccountId ||
            activeAccount.indexedAccount?.id,
          symbol,
          provider: protocol.provider.name,
          vault: earnUtils.isVaultBasedProvider({
            providerName: protocol.provider.name,
          })
            ? protocol.provider.vault
            : undefined,
        });
      } catch (error) {
        console.error('Failed to select protocol:', error);
      }
    },
    [
      activeAccount?.account?.id,
      activeAccount?.indexedAccount?.id,
      symbol,
      navigation,
    ],
  );

  const columns: ITableColumn<IStakeProtocolListItem>[] = useMemo(() => {
    return [
      {
        key: 'protocol',
        label: 'Protocol',
        flex: 2.5,
        render: (item) => {
          return (
            <XStack>
              <Token
                size="md"
                borderRadius="$2"
                mr="$3"
                my="$3"
                tokenImageUri={item.provider.logoURI}
              />
              <YStack mr="$2" jc="center">
                <SizableText size="$bodyLgMedium">
                  {item.provider.name}
                </SizableText>
                {item?.provider?.description ? (
                  <SizableText
                    mt="$0.5"
                    size="$bodySmMedium"
                    color="$textSubdued"
                  >
                    {item.provider.description}
                  </SizableText>
                ) : null}
              </YStack>
              {item.provider.badges?.map((badge) => (
                <Badge
                  my="auto"
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))}
            </XStack>
          );
        },
      },
      {
        key: 'network',
        label: 'Network',
        flex: 1,
        hideInMobile: true,
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
        label: 'Tvl',
        flex: 1,
        hideInMobile: true,
        render: (item) => (
          <SizableText mr="$2" size="$bodyLgMedium">
            <EarnText size="$bodyLg" text={item?.tvl} />
          </SizableText>
        ),
      },
      {
        key: 'yield',
        label: 'Yield',
        flex: 1,
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
  }, []);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <YStack gap="$2">
          <YStack px="$5" pb="$2">
            <Skeleton h="$5" w={120} borderRadius="$2" />
          </YStack>
          {Array.from({ length: 2 }).map((_, index) => (
            <ListItem key={index} mx="$0" px="$5">
              <Skeleton w="$10" h="$10" borderRadius="$2" />
              <YStack flex={1} gap="$2">
                <Skeleton h="$4" w={120} borderRadius="$2" />
                <Skeleton h="$3" w={180} borderRadius="$2" />
              </YStack>
              <YStack alignSelf="flex-start">
                <Skeleton h="$4" w={80} borderRadius="$2" />
              </YStack>
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
        enableDrillIn={media.gtSm}
        isLoading={isLoading}
      />
    );
  }, [
    media,
    columns,
    fetchProtocolData,
    intl,
    isLoading,
    protocolData,
    handleProtocolPress,
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
              navigation.switchTab(ETabRoutes.Earn, {
                screen: ETabEarnRoutes.EarnHome,
              });
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
      <BasicEarnProtocols {...props} />
    </AccountSelectorProviderMirror>
  );
}
