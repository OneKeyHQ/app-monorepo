import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  Image,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../../Staking/utils/utils';
import { AprText } from '../../components/AprText';
import { EarnPageContainer } from '../../components/EarnPageContainer';

import type { RouteProp } from '@react-navigation/core';

// Adapter function to convert IStakeProtocolListItem to IEarnAvailableAsset format
const createAssetFromProtocol = (
  item: IStakeProtocolListItem,
): IEarnAvailableAsset => ({
  name: item.provider.name,
  symbol: '',
  logoURI: item.provider.logoURI,
  apr: `${BigNumber(item.provider.aprWithoutFee || 0).toFixed(2)}%`,
  aprWithoutFee: `${BigNumber(item.provider.aprWithoutFee || 0).toFixed(2)}%`,
  tags: [],
  rewardUnit: item.provider.rewardUnit,
  protocols: [],
  aprInfo: item.aprInfo,
});

interface IProtocolSection {
  title: string;
  data: IStakeProtocolListItem[];
  group: EStakeProtocolGroupEnum;
}

const getSectionTitle = (
  intl: ReturnType<typeof useIntl>,
  group: string,
): string => {
  switch (group) {
    case EStakeProtocolGroupEnum.Available:
      return intl.formatMessage({
        id: ETranslations.earn_available_to_deposit,
      });
    case EStakeProtocolGroupEnum.WithdrawOnly:
      return intl.formatMessage({
        id: ETranslations.earn_withdrawal_only,
      });
    case EStakeProtocolGroupEnum.Deposited:
      return intl.formatMessage({ id: ETranslations.earn_deposited });
    case EStakeProtocolGroupEnum.Unavailable:
      return intl.formatMessage({
        id: ETranslations.provider_unavailable,
      });
    default:
      return group;
  }
};

const groupProtocolsByGroup = (
  intl: ReturnType<typeof useIntl>,
  protocols: IStakeProtocolListItem[],
): IProtocolSection[] => {
  const grouped = protocols.reduce((acc, protocol) => {
    const group = protocol.provider.group || EStakeProtocolGroupEnum.Available;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(protocol);
    return acc;
  }, {} as Record<string, IStakeProtocolListItem[]>);

  const groupOrder = [
    EStakeProtocolGroupEnum.Deposited,
    EStakeProtocolGroupEnum.Available,
    EStakeProtocolGroupEnum.WithdrawOnly,
  ];
  const sections: IProtocolSection[] = [];

  groupOrder.forEach((group) => {
    if (grouped[group] && grouped[group].length > 0) {
      sections.push({
        title: getSectionTitle(intl, group),
        data: grouped[group],
        group,
      });
    }
  });

  Object.keys(grouped).forEach((group: string) => {
    if (
      !groupOrder.includes(group as EStakeProtocolGroupEnum) &&
      grouped[group].length > 0
    ) {
      sections.push({
        title: getSectionTitle(intl, group),
        data: grouped[group],
        group: group as EStakeProtocolGroupEnum,
      });
    }
  });

  return sections;
};

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnProtocols>;

function BasicEarnProtocols({ route }: { route: IRouteProps }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { symbol, filterNetworkId, logoURI } = route.params || {};

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

  const [protocolData, setProtocolData] = useState<IProtocolSection[]>([]);
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

      const groupedData = groupProtocolsByGroup(intl, data);
      setProtocolData(groupedData);
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
    intl,
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

        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ProtocolDetailsV2,
          params: {
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
          },
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

  const renderSectionHeader = useCallback(
    ({ section }: { section: IProtocolSection }) => (
      <YStack px="$5" pb="$2" h={28}>
        <SizableText
          size="$bodyMdMedium"
          color={
            section.group === EStakeProtocolGroupEnum.Deposited
              ? '$textSuccess'
              : '$textSubdued'
          }
        >
          {section.title}
        </SizableText>
      </YStack>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: IStakeProtocolListItem }) => (
      <ListItem
        userSelect="none"
        onPress={() => handleProtocolPress(item)}
        borderRadius="$2"
        borderCurve="continuous"
        pressStyle={{ backgroundColor: '$bgHover' }}
        px="$2.5"
        mx="$2.5"
        h={62}
      >
        <Token
          size="lg"
          borderRadius="$2"
          tokenImageUri={item.provider.logoURI}
          networkImageUri={item.network.logoURI}
        />
        <ListItem.Text
          flex={1}
          primary={
            <XStack ai="center" gap="$1.5">
              <SizableText>{capitalizeString(item.provider.name)}</SizableText>
              {item.provider.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))}
            </XStack>
          }
          secondary={item.provider.description || ''}
        />
        <ListItem.Text
          alignSelf="flex-start"
          primary={<AprText asset={createAssetFromProtocol(item)} />}
        />
      </ListItem>
    ),
    [handleProtocolPress],
  );

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
              width: '100%',
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
      <YStack gap="$4" minHeight={90}>
        {protocolData.map((section) => (
          <YStack key={section.group}>
            {renderSectionHeader({ section })}
            {section.data.map((item) => renderItem({ item }))}
          </YStack>
        ))}
      </YStack>
    );
  }, [
    fetchProtocolData,
    intl,
    isLoading,
    protocolData,
    renderItem,
    renderSectionHeader,
  ]);

  return (
    <EarnPageContainer
      pageTitle={customHeaderLeft}
      breadcrumbProps={{
        items: [
          {
            label: intl.formatMessage({ id: ETranslations.global_earn }),
            onClick: () => navigation.pop(),
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
