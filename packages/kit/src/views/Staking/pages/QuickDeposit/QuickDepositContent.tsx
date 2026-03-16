import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

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
  let text = '';
  if (aprInfo?.highlight) {
    text = aprInfo.highlight.text;
  } else if (aprInfo?.normal) {
    text = aprInfo.normal.text;
  } else if (aprInfo?.deprecated) {
    text = aprInfo.deprecated.text;
  } else {
    return `${item.provider.aprWithoutFee || '0'} APR`;
  }
  // Ensure text always includes APY/APR suffix
  if (!/\s*(APY|APR)\s*$/i.test(text)) {
    return `${text} APR`;
  }
  return text;
}

function ProtocolImage({
  logoURI,
  networkLogoURI,
}: {
  logoURI?: string;
  networkLogoURI?: string;
}) {
  return (
    <Stack position="relative" w="$9" h="$9" flexShrink={0}>
      <Image
        w="$9"
        h="$9"
        borderRadius="$2"
        source={logoURI ? { uri: logoURI } : undefined}
      />
      {networkLogoURI ? (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          bg="$bgApp"
          borderRadius="$full"
        >
          <NetworkAvatarBase size="$4" logoURI={networkLogoURI} />
        </Stack>
      ) : null}
    </Stack>
  );
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
    // Find first real item to use as fallback image for mock protocols
    let firstRealItem: IStakeProtocolListItem | undefined;
    for (const p of protocols) {
      const item = findMatchingItem(protocolList, p);
      if (item && !firstRealItem) {
        firstRealItem = item;
      }
      matched.push({ protocol: p, item });
    }
    // TODO: remove mock - inject fake data for unmatched protocols
    for (const m of matched) {
      if (!m.item && firstRealItem) {
        m.item = {
          ...firstRealItem,
          provider: {
            ...firstRealItem.provider,
            name: m.protocol.provider,
            logoURI: firstRealItem.provider.logoURI,
            tvl: '8520000',
            aprWithoutFee: '4.12',
            vault: m.protocol.vault,
          },
          aprInfo: {
            normal: { text: '4.12% APY' },
          },
        } as IStakeProtocolListItem;
      }
    }
    return matched;
  }, [protocols, protocolList]);

  const renderContent = useCallback(
    () => (
      <YStack pb="$5" px="$3" $gtMd={{ p: '$1' }}>
        <XStack px="$2" py="$1.5" gap="$2">
          <SizableText
            size="$bodySmMedium"
            color="$textSubdued"
            flex={1}
          >
            Protocol
          </SizableText>
          <SizableText
            size="$bodySmMedium"
            color="$textSubdued"
            textAlign="right"
          >
            APR/APY
          </SizableText>
        </XStack>
        {matchedProtocols.map(({ protocol, item }) => {
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
            <XStack
              key={`${protocol.provider}-${protocol.networkId}-${protocol.vault}`}
              onPress={() => onSelectProtocol(protocol)}
              ai="center"
              gap="$3"
              p="$2"
              borderRadius="$2"
              borderCurve="continuous"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor="pointer"
              role="button"
            >
              <ProtocolImage
                logoURI={item?.provider.logoURI}
                networkLogoURI={item?.network.logoURI}
              />
              <YStack flex={1} gap="$0.5">
                <SizableText size="$bodyLgMedium">
                  {capitalizeString(
                    item?.provider.name || protocol.provider,
                  )}
                </SizableText>
                {subtitle ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {subtitle}
                  </SizableText>
                ) : null}
              </YStack>
              <SizableText size="$bodyLgMedium" textAlign="right">
                {aprValueOnly}
              </SizableText>
            </XStack>
          );
        })}
      </YStack>
    ),
    [matchedProtocols, onSelectProtocol],
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
      <ProtocolImage
        logoURI={matchingItem?.provider.logoURI}
        networkLogoURI={matchingItem?.network.logoURI}
      />
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyLgMedium">{providerName}</SizableText>
        {subtitle ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1} $gtMd={{ size: '$bodyMd' }}>
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
