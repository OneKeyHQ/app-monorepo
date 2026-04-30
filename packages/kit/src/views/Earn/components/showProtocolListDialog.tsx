import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Dialog,
  Empty,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EStakeProtocolGroupEnum } from '@onekeyhq/shared/types/staking';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  ProtocolImage,
  formatTvl,
} from '../../Staking/components/ProtocolDisplayShared';
import { capitalizeString } from '../../Staking/utils/utils';

import { AprText } from './AprText';

import type { IntlShape } from 'react-intl';

type ISelectedProtocol = {
  networkId: string;
  provider: string;
  vault?: string;
};

function getProtocolKey({ networkId, provider, vault }: ISelectedProtocol) {
  return `${provider.toLowerCase()}-${networkId}-${vault ?? ''}`;
}

function getProtocolItemKey(item: IStakeProtocolListItem) {
  return getProtocolKey({
    networkId: item.network.networkId,
    provider: item.provider.name,
    vault: earnUtils.isVaultBasedProvider({
      providerName: item.provider.name,
    })
      ? item.provider.vault
      : undefined,
  });
}

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

type IProtocolListVariant = 'dialog' | 'switcher';

// Get section title based on group
const getSectionTitle = (group: string, intl: IntlShape): string => {
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

// Group protocols by their group field
const groupProtocolsByGroup = (
  protocols: IStakeProtocolListItem[],
  intl: IntlShape,
): IProtocolSection[] => {
  const grouped = protocols.reduce(
    (acc, protocol) => {
      const group =
        protocol.provider.group || EStakeProtocolGroupEnum.Available;
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(protocol);
      return acc;
    },
    {} as Record<string, IStakeProtocolListItem[]>,
  );

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
        title: getSectionTitle(group, intl),
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
        title: getSectionTitle(group, intl),
        data: grouped[group],
        group: group as EStakeProtocolGroupEnum,
      });
    }
  });

  return sections;
};

const getProtocolAprValue = (item: IStakeProtocolListItem) => {
  const aprText =
    item.aprInfo?.highlight?.text ||
    item.aprInfo?.normal?.text ||
    item.aprInfo?.deprecated?.text ||
    `${BigNumber(item.provider.aprWithoutFee || 0).toFixed(2)} ${item.provider.rewardUnit || 'APR'}`;

  return aprText.replace(/\s*(APR|APY)\s*$/iu, '').trim();
};

export function ProtocolListContent({
  symbol,
  accountId,
  indexedAccountId,
  filterNetworkId,
  selectedProtocol,
  onProtocolSelect,
  protocols,
  isLoading: isLoadingProp,
  variant = 'dialog',
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  filterNetworkId?: string;
  selectedProtocol?: ISelectedProtocol;
  onProtocolSelect: (protocol: IStakeProtocolListItem) => Promise<void>;
  protocols?: IStakeProtocolListItem[];
  isLoading?: boolean;
  variant?: IProtocolListVariant;
}) {
  const intl = useIntl();
  const [fetchedProtocols, setFetchedProtocols] = useState<
    IStakeProtocolListItem[]
  >([]);
  const [isFetching, setIsFetching] = useState(protocols === undefined);
  const media = useMedia();
  const selectedProtocolKey = useMemo(
    () => (selectedProtocol ? getProtocolKey(selectedProtocol) : undefined),
    [selectedProtocol],
  );
  const shouldFetchProtocols = protocols === undefined;
  const switcherContentContainerProps = useMemo(
    () =>
      media.gtMd
        ? { p: '$1' as const, pb: '$2' as const }
        : { px: '$3' as const, pb: '$5' as const },
    [media.gtMd],
  );

  const fetchProtocolData = useCallback(async () => {
    if (!shouldFetchProtocols) {
      return;
    }

    try {
      setIsFetching(true);

      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId,
        indexedAccountId,
        filterNetworkId,
      });

      setFetchedProtocols(data);
    } catch (_error) {
      setFetchedProtocols([]);
    } finally {
      setIsFetching(false);
    }
  }, [
    accountId,
    filterNetworkId,
    indexedAccountId,
    shouldFetchProtocols,
    symbol,
  ]);

  useEffect(() => {
    if (shouldFetchProtocols) {
      void fetchProtocolData();
    }
  }, [fetchProtocolData, shouldFetchProtocols]);

  const resolvedProtocols = useMemo(
    () => protocols ?? fetchedProtocols,
    [fetchedProtocols, protocols],
  );
  const isLoading = shouldFetchProtocols ? isFetching : !!isLoadingProp;
  const protocolData = useMemo(
    () => groupProtocolsByGroup(resolvedProtocols, intl),
    [resolvedProtocols, intl],
  );
  const flatProtocolData = useMemo(
    () => protocolData.flatMap((section) => section.data),
    [protocolData],
  );

  const handleProtocolPress = useCallback(
    async (protocol: IStakeProtocolListItem) => {
      await onProtocolSelect(protocol);
    },
    [onProtocolSelect],
  );

  const renderDialogSectionHeader = useCallback(
    ({ section }: { section: IProtocolSection }) => (
      <YStack px="$pagePadding" pb="$2" h={28}>
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

  const renderDialogItem = useCallback(
    ({ item }: { item: IStakeProtocolListItem }) => {
      const isSelected =
        selectedProtocolKey !== undefined &&
        getProtocolItemKey(item) === selectedProtocolKey;

      return (
        <ListItem
          userSelect="none"
          onPress={() => handleProtocolPress(item)}
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor={isSelected ? '$borderActive' : '$transparent'}
          bg={isSelected ? '$bgSubdued' : undefined}
          hoverStyle={{
            backgroundColor: isSelected ? '$bgSubdued' : '$bgHover',
          }}
          pressStyle={{
            backgroundColor: isSelected ? '$bgSubdued' : '$bgHover',
          }}
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
                <SizableText>
                  {capitalizeString(item.provider.name)}
                </SizableText>
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
          <XStack alignItems="center" alignSelf="flex-start" gap="$2">
            <ListItem.Text
              alignSelf="flex-start"
              primary={<AprText asset={createAssetFromProtocol(item)} />}
            />
            {isSelected ? (
              <Icon
                name="Checkmark1SmallSolid"
                size="$4.5"
                color="$iconSuccess"
              />
            ) : null}
          </XStack>
        </ListItem>
      );
    },
    [handleProtocolPress, selectedProtocolKey],
  );

  const renderSwitcherItem = useCallback(
    ({ item }: { item: IStakeProtocolListItem }) => {
      const isSelected =
        selectedProtocolKey !== undefined &&
        getProtocolItemKey(item) === selectedProtocolKey;
      const secondaryText = [
        formatTvl(item.provider.tvl),
        item.provider.vaultName,
      ]
        .filter(Boolean)
        .join(' · ');

      return (
        <XStack
          key={getProtocolItemKey(item)}
          role="button"
          userSelect="none"
          alignItems="center"
          gap="$3"
          px="$2"
          py="$2"
          mx="$1"
          borderRadius="$2"
          bg={isSelected ? '$bgActive' : '$transparent'}
          hoverStyle={{
            bg: isSelected ? '$bgActive' : '$bgHover',
          }}
          pressStyle={{
            bg: isSelected ? '$bgActive' : '$bgHover',
          }}
          onPress={() => handleProtocolPress(item)}
        >
          <ProtocolImage
            logoURI={item.provider.logoURI}
            networkLogoURI={item.network.logoURI}
          />
          <YStack flex={1} minWidth={0} gap="$0.5">
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {capitalizeString(item.provider.name)}
            </SizableText>
            {secondaryText ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {secondaryText}
              </SizableText>
            ) : null}
          </YStack>
          <SizableText size="$bodyLgMedium">
            {getProtocolAprValue(item)}
          </SizableText>
        </XStack>
      );
    },
    [handleProtocolPress, selectedProtocolKey],
  );

  if (isLoading) {
    if (variant === 'switcher') {
      return (
        <YStack gap="$1" {...switcherContentContainerProps}>
          <XStack px="$2" py="$1.5" alignItems="center">
            <Skeleton h="$4" w={72} borderRadius="$2" />
            <XStack flex={1} />
            <Skeleton h="$4" w={64} borderRadius="$2" />
          </XStack>
          {Array.from({ length: 3 }).map((_, index) => (
            <XStack key={index} alignItems="center" gap="$3" px="$2" py="$2">
              <Skeleton w="$10" h="$10" borderRadius="$2" />
              <YStack flex={1} gap="$1">
                <Skeleton h="$4" w={96} borderRadius="$2" />
                <Skeleton h="$3" w={132} borderRadius="$2" />
              </YStack>
              <Skeleton h="$4" w={52} borderRadius="$2" />
            </XStack>
          ))}
        </YStack>
      );
    }

    return (
      <YStack gap="$2">
        {/* Section Header Skeleton */}
        <YStack px="$pagePadding" pb="$2">
          <Skeleton h="$5" w={120} borderRadius="$2" />
        </YStack>

        {/* ListItem Skeletons */}
        {Array.from({ length: 2 }).map((_, index) => (
          <ListItem key={index} mx="$0" px="$pagePadding">
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
          px="$pagePadding"
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

  if (variant === 'switcher') {
    return (
      <YStack gap="$1" minHeight={90} {...switcherContentContainerProps}>
        <XStack px="$2" py="$1.5" alignItems="center">
          <SizableText size="$bodySmMedium" color="$textSubdued" flex={1}>
            {intl.formatMessage({
              id: ETranslations.global_protocol,
            })}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.defi_apr_apy,
            })}
          </SizableText>
        </XStack>
        <YStack gap="$0.5">
          {flatProtocolData.map((item) => renderSwitcherItem({ item }))}
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$4" minHeight={90} p="$0" m="$0">
      {protocolData.map((section) => (
        <YStack key={section.group}>
          {renderDialogSectionHeader({ section })}
          {section.data.map((item) => renderDialogItem({ item }))}
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
  selectedProtocol,
  onProtocolSelect,
  intl,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  filterNetworkId?: string;
  selectedProtocol?: ISelectedProtocol;
  onProtocolSelect: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    provider: string;
    vault?: string;
  }) => Promise<void>;
  intl: IntlShape;
}) {
  const dialog = Dialog.show({
    title: intl.formatMessage(
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
      <ProtocolListContent
        symbol={symbol}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        filterNetworkId={filterNetworkId}
        selectedProtocol={selectedProtocol}
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
                btcOnlyTaproot: true,
              });

            await onProtocolSelect({
              networkId: protocol.network.networkId,
              accountId: earnAccount?.accountId || accountId,
              indexedAccountId:
                earnAccount?.account.indexedAccountId || indexedAccountId,
              symbol,
              provider: protocol.provider.name,
              vault: earnUtils.isVaultBasedProvider({
                providerName: protocol.provider.name,
              })
                ? protocol.provider.vault
                : undefined,
            });
          } catch (_error) {
            // Handle error silently
          } finally {
            void dialog.close();
          }
        }}
      />
    ),
  });

  return dialog;
}
