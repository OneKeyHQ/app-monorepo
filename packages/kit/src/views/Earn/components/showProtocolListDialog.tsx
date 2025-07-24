import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Badge,
  Dialog,
  Empty,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../Staking/utils/utils';

import { AprText } from './AprText';

// Adapter function to convert IStakeProtocolListItem to IEarnAvailableAsset format
const createAssetFromProtocol = (
  item: IStakeProtocolListItem,
): IEarnAvailableAsset => ({
  name: item.provider.name,
  symbol: '', // Not used in this context
  logoURI: item.provider.logoURI,
  apr: `${BigNumber(item.provider.aprWithoutFee || 0).toFixed(2)}%`,
  aprWithoutFee: `${BigNumber(item.provider.aprWithoutFee || 0).toFixed(2)}%`,
  tags: [],
  rewardUnit: item.provider.rewardUnit,
  protocols: [],
  aprInfo: item.aprInfo,
});

// Section data structure for SectionList
interface IProtocolSection {
  title: string;
  data: IStakeProtocolListItem[];
  group: EStakeProtocolGroupEnum;
}

// Get section title based on group
const getSectionTitle = (group: string): string => {
  switch (group) {
    case EStakeProtocolGroupEnum.Available:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_available_to_deposit,
      });
    case EStakeProtocolGroupEnum.WithdrawOnly:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_withdrawal_only,
      });
    case EStakeProtocolGroupEnum.Deposited:
      return appLocale.intl.formatMessage({ id: ETranslations.earn_deposited });
    case EStakeProtocolGroupEnum.Unavailable:
      return appLocale.intl.formatMessage({
        id: ETranslations.provider_unavailable,
      });
    default:
      return group;
  }
};

// Group protocols by their group field
const groupProtocolsByGroup = (
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

  // Convert to sections array and sort by group priority
  const groupOrder = [
    EStakeProtocolGroupEnum.Deposited,
    EStakeProtocolGroupEnum.Available,
    EStakeProtocolGroupEnum.WithdrawOnly,
  ];
  const sections: IProtocolSection[] = [];

  // Add groups in predefined order first
  groupOrder.forEach((group) => {
    if (grouped[group] && grouped[group].length > 0) {
      sections.push({
        title: getSectionTitle(group),
        data: grouped[group],
        group,
      });
    }
  });

  // Add any remaining groups not in the predefined order
  Object.keys(grouped).forEach((group: string) => {
    if (
      !groupOrder.includes(group as EStakeProtocolGroupEnum) &&
      grouped[group].length > 0
    ) {
      sections.push({
        title: getSectionTitle(group),
        data: grouped[group],
        group: group as EStakeProtocolGroupEnum,
      });
    }
  });

  return sections;
};

function ProtocolListDialogContent({
  symbol,
  accountId,
  indexedAccountId,
  filterNetworkId,
  onProtocolSelect,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  filterNetworkId?: string;
  onProtocolSelect: (protocol: IStakeProtocolListItem) => Promise<void>;
}) {
  const [protocolData, setProtocolData] = useState<IProtocolSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProtocolData = useCallback(async () => {
    try {
      setIsLoading(true);

      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId,
        indexedAccountId,
        filterNetworkId,
      });

      const groupedData = groupProtocolsByGroup(data);
      setProtocolData(groupedData);
    } catch (error) {
      console.error('Failed to fetch protocol data:', error);
      setProtocolData([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, accountId, indexedAccountId, filterNetworkId]);

  useEffect(() => {
    void fetchProtocolData();
  }, [fetchProtocolData]);

  const handleProtocolPress = useCallback(
    async (protocol: IStakeProtocolListItem) => {
      await onProtocolSelect(protocol);
    },
    [onProtocolSelect],
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

  if (isLoading) {
    return (
      <YStack gap="$2">
        {/* Section Header Skeleton */}
        <YStack px="$5" pb="$2">
          <Skeleton h="$5" w={120} borderRadius="$2" />
        </YStack>

        {/* ListItem Skeletons */}
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
          title={appLocale.intl.formatMessage({
            id: ETranslations.earn_no_protocols_available,
          })}
          buttonProps={{
            flex: 1,
            width: '100%',
            children: appLocale.intl.formatMessage({
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
    <YStack gap="$4" minHeight={90} p="$0" m="$0">
      {protocolData.map((section) => (
        <YStack key={section.group}>
          {renderSectionHeader({ section })}
          {section.data.map((item) => renderItem({ item }))}
        </YStack>
      ))}
    </YStack>
  );
}

export function showProtocolListDialog({
  symbol,
  accountId,
  indexedAccountId,
  filterNetworkId,
  onProtocolSelect,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  filterNetworkId?: string;
  onProtocolSelect: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    provider: string;
    vault?: string;
  }) => Promise<void>;
}) {
  console.log('showProtocolListDialog called with:', { symbol });

  const dialog = Dialog.show({
    title: appLocale.intl.formatMessage(
      {
        id: ETranslations.earn_symbol_staking_provider,
      },
      { symbol },
    ),
    showFooter: false,
    contentContainerProps: {
      px: '$0',
      pb: '$5',
    },
    renderContent: (
      <ProtocolListDialogContent
        symbol={symbol}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        filterNetworkId={filterNetworkId}
        onProtocolSelect={async (protocol: IStakeProtocolListItem) => {
          try {
            defaultLogger.staking.page.selectProvider({
              network: protocol.network.networkId,
              stakeProvider: protocol.provider.name,
            });

            const earnAccount =
              await backgroundApiProxy.serviceStaking.getEarnAccount({
                accountId,
                indexedAccountId,
                networkId: protocol.network.networkId,
              });

            await onProtocolSelect({
              networkId: protocol.network.networkId,
              accountId: earnAccount?.accountId || accountId,
              indexedAccountId:
                earnAccount?.account.indexedAccountId || indexedAccountId,
              symbol,
              provider: protocol.provider.name,
              vault: earnUtils.useVaultProvider({
                providerName: protocol.provider.name,
              })
                ? protocol.provider.vault
                : undefined,
            });
          } catch (error) {
            console.error('Failed to select protocol:', error);
          } finally {
            void dialog.close();
          }
        }}
      />
    ),
  });

  return dialog;
}
