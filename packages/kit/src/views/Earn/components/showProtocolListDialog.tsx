import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Dialog,
  SectionList,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../Staking/utils/utils';

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
  onProtocolSelect,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  onProtocolSelect: (protocol: IStakeProtocolListItem) => Promise<void>;
}) {
  const [protocolData, setProtocolData] = useState<IProtocolSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProtocolData = async () => {
      try {
        console.log('Fetching protocol data for:', {
          symbol,
          accountId,
        });
        setIsLoading(true);

        const data = await backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          accountId,
          indexedAccountId,
        });

        const groupedData = groupProtocolsByGroup(data);
        setProtocolData(groupedData);
      } catch (error) {
        console.error('Failed to fetch protocol data:', error);
        setProtocolData([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProtocolData();
  }, [symbol, accountId, indexedAccountId]);

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
          primary={capitalizeString(item.provider.name)}
          secondary={item.provider.description || ''}
        />
        <ListItem.Text
          alignSelf="flex-start"
          primary={
            item.provider.aprWithoutFee &&
            Number(item.provider.aprWithoutFee) > 0
              ? `${BigNumber(item.provider.aprWithoutFee).toFixed(2)}% ${
                  item.provider.rewardUnit || 'APY'
                }`
              : null
          }
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
      <YStack py="$5" px="$5" alignItems="center">
        <SizableText>No protocols available</SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$2" minHeight={90} p="$0" m="$0">
      <SectionList
        sections={protocolData}
        keyExtractor={(item, index) =>
          `${(item as IStakeProtocolListItem).provider.name}-${index}`
        }
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        SectionSeparatorComponent={<YStack h="$4" />}
        stickySectionHeadersEnabled={false}
        estimatedItemSize={62}
      />
    </YStack>
  );
}

export function showProtocolListDialog({
  symbol,
  accountId,
  indexedAccountId,
  onProtocolSelect,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
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
              vault: earnUtils.isMorphoProvider({
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
