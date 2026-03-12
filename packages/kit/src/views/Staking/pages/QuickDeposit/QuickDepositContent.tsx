import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { AprText } from '../../../Earn/components/AprText';
import { capitalizeString } from '../../utils/utils';
import { ManagePositionContent } from '../ManagePosition/components/ManagePositionContent';

interface IProtocol {
  networkId: string;
  provider: string;
  vault: string;
}

interface IQuickDepositContentProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  accountId: string;
  indexedAccountId?: string;
  tokenImageUri?: string;
  protocols: IProtocol[];
}

function formatTvl(tvl: string | undefined): string | undefined {
  if (!tvl) return undefined;
  const bn = new BigNumber(tvl);
  if (bn.isNaN()) return tvl;
  if (bn.gte(1e9)) return `$${bn.div(1e9).toFixed(2)}B`;
  if (bn.gte(1e6)) return `$${bn.div(1e6).toFixed(2)}M`;
  if (bn.gte(1e3)) return `$${bn.div(1e3).toFixed(2)}K`;
  return `$${bn.toFixed(2)}`;
}

function getAprDisplayText(item: IStakeProtocolListItem): string {
  const { aprInfo } = item;
  if (aprInfo?.highlight) return aprInfo.highlight.text;
  if (aprInfo?.normal) return aprInfo.normal.text;
  if (aprInfo?.deprecated) return aprInfo.deprecated.text;
  return `${item.provider.aprWithoutFee || '0'} APR`;
}

function findMatchingItem(
  protocolList: IStakeProtocolListItem[],
  protocol: IProtocol,
) {
  return protocolList.find(
    (item) =>
      item.provider.name.toLowerCase() === protocol.provider.toLowerCase() &&
      item.network.networkId === protocol.networkId &&
      (!protocol.vault || item.provider.vault === protocol.vault),
  );
}

// Fetch protocol list for the switcher
function useProtocolList({
  symbol,
  accountId,
  indexedAccountId,
  filterNetworkId,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  filterNetworkId?: string;
}) {
  const [protocolList, setProtocolList] = useState<IStakeProtocolListItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          accountId,
          indexedAccountId,
          filterNetworkId,
        });
        if (!cancelled) {
          setProtocolList(data);
        }
      } catch (_error) {
        if (!cancelled) {
          setProtocolList([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [symbol, accountId, indexedAccountId, filterNetworkId]);

  return { protocolList, isLoading };
}

function ProtocolSwitcher({
  selectedProtocol,
  protocols,
  protocolList,
  onSelectProtocol,
  aprDisplayText,
}: {
  selectedProtocol: IProtocol;
  protocols: IProtocol[];
  protocolList: IStakeProtocolListItem[];
  onSelectProtocol: (protocol: IProtocol) => void;
  aprDisplayText?: string;
}) {
  const matchedProtocols = useMemo(() => {
    const matched: Array<{
      protocol: IProtocol;
      item?: IStakeProtocolListItem;
    }> = [];
    for (const p of protocols) {
      const item = findMatchingItem(protocolList, p);
      matched.push({ protocol: p, item });
    }
    return matched;
  }, [protocols, protocolList]);

  const renderContent = useCallback(
    () => (
      <YStack p="$1">
        <XStack px="$2" py="$1.5">
          <SizableText
            size="$bodySmMedium"
            color="$textSubdued"
            flex={1}
            maxWidth={160}
          >
            Protocol
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued" flex={1} textAlign="right">
            APR/APY
          </SizableText>
        </XStack>
        {matchedProtocols.map(({ protocol, item }) => {
          const isSelected =
            protocol.provider === selectedProtocol.provider &&
            protocol.networkId === selectedProtocol.networkId &&
            protocol.vault === selectedProtocol.vault;

          const tvlFormatted = formatTvl(item?.provider.tvl);
          const subtitle = [tvlFormatted, item?.provider.vaultName]
            .filter(Boolean)
            .join(' · ');

          const itemApr = item ? getAprDisplayText(item) : '--';
          // Strip unit suffix (APY/APR) for the popover list
          const aprValueOnly = itemApr
            .replace(/\s*(APY|APR)\s*$/i, '')
            .trim();

          return (
            <ListItem
              key={`${protocol.provider}-${protocol.networkId}-${protocol.vault}`}
              onPress={() => onSelectProtocol(protocol)}
              borderRadius="$2"
              borderCurve="continuous"
              px="$2"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <Token
                size="md"
                borderRadius="$2"
                tokenImageUri={item?.provider.logoURI}
              />
              <ListItem.Text
                flex={1}
                primary={capitalizeString(
                  item?.provider.name || protocol.provider,
                )}
                primaryTextProps={{ size: '$bodyLgMedium' }}
                secondary={subtitle || undefined}
                secondaryTextProps={{ size: '$bodySm', mt: '$0.5' }}
              />
              <SizableText size="$bodyLgMedium" textAlign="right">
                {aprValueOnly}
              </SizableText>
            </ListItem>
          );
        })}
      </YStack>
    ),
    [matchedProtocols, selectedProtocol, onSelectProtocol],
  );

  const renderTrigger = useMemo(
    () => (
      <XStack
        ai="center"
        gap="$1"
        hoverStyle={{ opacity: 0.7 }}
        pressStyle={{ opacity: 0.5 }}
        role="button"
        userSelect="none"
        cursor="pointer"
      >
        <SizableText size="$headingLg" color="$textSuccess">
          {aprDisplayText || '--'}
        </SizableText>
        <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    ),
    [aprDisplayText],
  );

  return (
    <Popover
      title="Protocol"
      placement="bottom-end"
      renderTrigger={renderTrigger}
      renderContent={renderContent}
      floatingPanelProps={{
        width: 360,
      }}
    />
  );
}

function ProtocolInfoCard({
  selectedProtocol,
  protocols,
  protocolList,
  isLoadingProtocols,
  onSelectProtocol,
}: {
  selectedProtocol: IProtocol;
  protocols: IProtocol[];
  protocolList: IStakeProtocolListItem[];
  isLoadingProtocols: boolean;
  onSelectProtocol: (protocol: IProtocol) => void;
}) {
  const hasMultipleProtocols = protocols.length > 1;

  const matchingItem = useMemo(
    () => findMatchingItem(protocolList, selectedProtocol),
    [protocolList, selectedProtocol],
  );

  const providerName = matchingItem
    ? capitalizeString(matchingItem.provider.name)
    : capitalizeString(selectedProtocol.provider);

  const tvlText = formatTvl(matchingItem?.provider.tvl);
  const vaultName = matchingItem?.provider.vaultName;

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (tvlText) parts.push(tvlText);
    if (vaultName) parts.push(vaultName);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [tvlText, vaultName]);

  if (isLoadingProtocols) {
    return (
      <XStack ai="center" gap="$3">
        <Skeleton w="$9" h="$9" borderRadius="$2" />
        <YStack flex={1} gap="$1">
          <Skeleton w={100} h="$4" borderRadius="$2" />
          <Skeleton w={150} h="$3" borderRadius="$2" />
        </YStack>
        <Skeleton w={70} h="$4" borderRadius="$2" />
      </XStack>
    );
  }

  const aprDisplayText = matchingItem
    ? getAprDisplayText(matchingItem)
    : undefined;

  return (
    <XStack ai="center" gap="$3">
      <Image
        w="$9"
        h="$9"
        borderRadius="$2"
        flexShrink={0}
        source={
          matchingItem?.provider.logoURI
            ? { uri: matchingItem.provider.logoURI }
            : undefined
        }
      />
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyLgMedium">{providerName}</SizableText>
        {subtitle ? (
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      {hasMultipleProtocols ? (
        <ProtocolSwitcher
          selectedProtocol={selectedProtocol}
          protocols={protocols}
          protocolList={protocolList}
          onSelectProtocol={onSelectProtocol}
          aprDisplayText={aprDisplayText}
        />
      ) : null}
      {!hasMultipleProtocols && aprDisplayText ? (
        <SizableText size="$headingLg" color="$textSuccess">
          {aprDisplayText}
        </SizableText>
      ) : null}
    </XStack>
  );
}

export function QuickDepositContent({
  networkId,
  symbol,
  provider,
  accountId,
  indexedAccountId,
  tokenImageUri,
  protocols,
}: IQuickDepositContentProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<IProtocol>(
    () =>
      protocols.find(
        (p) => p.provider === provider && p.networkId === networkId,
      ) || protocols[0],
  );

  const { protocolList, isLoading: isLoadingProtocols } = useProtocolList({
    symbol,
    accountId,
    indexedAccountId,
    filterNetworkId: selectedProtocol.networkId,
  });

  const handleSelectProtocol = useCallback((protocol: IProtocol) => {
    setSelectedProtocol(protocol);
  }, []);

  // Use key to force re-mount ManagePositionContent when protocol changes
  const contentKey = `${selectedProtocol.provider}-${selectedProtocol.networkId}-${selectedProtocol.vault}`;

  const renderProtocolInfo = useCallback(
    () => (
      <ProtocolInfoCard
        selectedProtocol={selectedProtocol}
        protocols={protocols}
        protocolList={protocolList}
        isLoadingProtocols={isLoadingProtocols}
        onSelectProtocol={handleSelectProtocol}
      />
    ),
    [
      selectedProtocol,
      protocols,
      protocolList,
      isLoadingProtocols,
      handleSelectProtocol,
    ],
  );

  return (
    <ManagePositionContent
      key={contentKey}
      isInModalContext
      networkId={selectedProtocol.networkId}
      symbol={symbol as ISupportedSymbol}
      provider={selectedProtocol.provider}
      vault={selectedProtocol.vault}
      accountId={accountId}
      indexedAccountId={indexedAccountId}
      fallbackTokenImageUri={tokenImageUri}
      defaultTab="deposit"
      renderProtocolInfo={renderProtocolInfo}
    />
  );
}
