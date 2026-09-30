import type { ReactElement } from 'react';
import { useMemo } from 'react';

import {
  Badge,
  ESwitchSize,
  Icon,
  Image,
  Input,
  ListView,
  NumberSizeableText,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapPopularTokenGroup from '../SwapPopularTokenGroup';

import { buildSwapTokenSelectorNetworkGroups } from './SwapTokenSelectorDesktop.utils';

import type { ISwapNetworkAsset } from './SwapTokenSelectorDesktop.utils';

type ISwapTokenItem = ISwapToken | IFuseResult<ISwapToken>;

type ISwapTokenSelectorDesktopProps = {
  allNetwork: ISwapNetwork;
  networks: ISwapNetwork[];
  sameChainNetwork?: ISwapNetwork;
  selectedNetwork?: ISwapNetwork;
  assetNetworks: ISwapNetworkAsset[];
  disableNetworks: string[];
  networkSearchValue: string;
  tokenSearchValue: string;
  tokenSearchPlaceholder: string;
  allNetworksLabel: string;
  sameChainLabel: string;
  onNetworkSearchChange: (value: string) => void;
  onTokenSearchChange: (value: string) => void;
  onSelectNetwork: (network: ISwapNetwork) => void;
  onDisableNetworksClick: () => void;
  onSelectToken: (token: ISwapToken) => void;
  onPaste?: () => void;
  popularTokens: ISwapToken[];
  showPopularTokens: boolean;
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
  onLpTokenFilterChange: (value: boolean) => void;
  tokens: ISwapTokenItem[];
  tokenListLoading: boolean;
  renderToken: (params: {
    item: ISwapTokenItem;
    index: number;
  }) => ReactElement | null;
  currencySymbol: string;
  tokenListEmptyComponent?: ReactElement | null;
};

function NetworkLogo({ network }: { network: ISwapNetwork }) {
  if (network.isAllNetworks) {
    return <Icon name="AllNetworksSolid" size="$6" color="$iconActive" />;
  }
  if (network.logoURI) {
    return (
      <Image size="$6" borderRadius="$full" source={{ uri: network.logoURI }} />
    );
  }
  return <Icon name="GlobusOutline" size="$6" color="$iconSubdued" />;
}

function NetworkRow({
  network,
  selected,
  disabled,
  indented,
  badgeText,
  fiatValue,
  currencySymbol,
  onPress,
}: {
  network: ISwapNetwork;
  selected: boolean;
  disabled: boolean;
  indented?: boolean;
  badgeText?: string;
  fiatValue?: string;
  currencySymbol: string;
  onPress: () => void;
}) {
  return (
    <XStack
      role="button"
      focusable
      userSelect="none"
      alignItems="center"
      height={44}
      px={9}
      pl={indented ? 29 : 9}
      gap="$2"
      borderWidth={1}
      borderColor={selected ? '$borderActive' : '$transparent'}
      borderRadius="$3"
      bg={selected ? '$bgSubdued' : undefined}
      opacity={disabled ? 0.5 : 1}
      hoverStyle={disabled ? undefined : { bg: '$bgHover' }}
      pressStyle={disabled ? undefined : { bg: '$bgActive' }}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      onPress={onPress}
    >
      {indented ? (
        <Stack
          position="absolute"
          left={20}
          top="$0"
          bottom="$0"
          width={1.5}
          bg="$borderSubdued"
        />
      ) : null}
      <NetworkLogo network={network} />
      <SizableText size="$bodyMdMedium" flex={1} numberOfLines={1}>
        {network.name}
      </SizableText>
      {badgeText ? (
        <Badge badgeType="default" badgeSize="sm" borderRadius="$1.5">
          <Badge.Text>{badgeText}</Badge.Text>
        </Badge>
      ) : null}
      {fiatValue ? (
        <NumberSizeableText
          size="$bodySm"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
        >
          {fiatValue}
        </NumberSizeableText>
      ) : null}
    </XStack>
  );
}

function NetworkSearchEmpty() {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      px="$5"
      gap="$2"
    >
      <Icon name="SearchOutline" size="$6" color="$iconSubdued" />
      <SizableText size="$bodyMd" color="$textSubdued">
        No networks found
      </SizableText>
      <SizableText size="$bodySm" color="$textDisabled">
        Try a different name
      </SizableText>
    </YStack>
  );
}

function TokenSearchEmpty() {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      px="$5"
      gap="$2"
    >
      <Icon name="SearchOutline" size="$6" color="$iconSubdued" />
      <SizableText size="$bodyMd" color="$textSubdued">
        No tokens found
      </SizableText>
      <SizableText size="$bodySm" color="$textDisabled">
        Check the spelling or paste a contract address
      </SizableText>
    </YStack>
  );
}

function NetworkSectionLabel({
  children,
  paddingTop,
  paddingBottom,
}: {
  children: string;
  paddingTop: number;
  paddingBottom: number;
}) {
  return (
    <SizableText
      size="$bodySmMedium"
      color="$textSubdued"
      pl={10}
      pt={paddingTop}
      pb={paddingBottom}
    >
      {children}
    </SizableText>
  );
}

export function SwapTokenSelectorDesktop({
  allNetwork,
  networks,
  sameChainNetwork,
  selectedNetwork,
  assetNetworks,
  disableNetworks,
  networkSearchValue,
  tokenSearchValue,
  tokenSearchPlaceholder,
  allNetworksLabel,
  sameChainLabel,
  onNetworkSearchChange,
  onTokenSearchChange,
  onSelectNetwork,
  onDisableNetworksClick,
  onSelectToken,
  onPaste,
  popularTokens,
  showPopularTokens,
  showLpTokenFilterSwitch,
  showLpTokensOnly,
  onLpTokenFilterChange,
  tokens,
  tokenListLoading,
  renderToken,
  currencySymbol,
  tokenListEmptyComponent,
}: ISwapTokenSelectorDesktopProps) {
  const networkGroups = useMemo(
    () =>
      buildSwapTokenSelectorNetworkGroups({
        networks: [
          allNetwork,
          ...networks,
          ...(sameChainNetwork ? [sameChainNetwork] : []),
        ],
        searchValue: networkSearchValue,
      }),
    [allNetwork, networkSearchValue, networks, sameChainNetwork],
  );
  const hasNetworkSearch = networkSearchValue.trim().length > 0;
  const showNetworkSearchEmpty = hasNetworkSearch && networkGroups.length === 0;
  const selectedNetworkId = selectedNetwork?.networkId;
  const selectedIsAllNetworks = selectedNetwork?.isAllNetworks;

  return (
    <XStack testID="swap-token-selector-desktop" flex={1} minHeight={0}>
      <YStack
        width={264}
        minHeight={0}
        borderRightWidth={1}
        borderColor="$borderSubdued"
      >
        <YStack p="$3" pb="$2">
          <Input
            testID="swap-token-selector-network-search"
            size="medium"
            height={38}
            pl={34}
            containerProps={{
              height: 38,
              bg: '$bgStrong',
              borderWidth: 0,
              borderRadius: '$3',
            }}
            leftIconName="SearchOutline"
            allowClear
            value={networkSearchValue}
            placeholder="Search networks"
            onChangeText={onNetworkSearchChange}
          />
        </YStack>
        {showNetworkSearchEmpty ? (
          <NetworkSearchEmpty />
        ) : (
          <ScrollView
            flex={1}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 4 }}
          >
            {!hasNetworkSearch ? (
              <NetworkRow
                network={allNetwork}
                selected={selectedIsAllNetworks === true}
                disabled={disableNetworks.includes(allNetwork.networkId)}
                currencySymbol={currencySymbol}
                onPress={() => {
                  if (disableNetworks.includes(allNetwork.networkId)) {
                    onDisableNetworksClick();
                  } else {
                    onSelectNetwork(allNetwork);
                  }
                }}
              />
            ) : null}
            {!hasNetworkSearch && sameChainNetwork ? (
              <>
                <NetworkSectionLabel paddingTop={6} paddingBottom={6}>
                  SAME NETWORK
                </NetworkSectionLabel>
                <NetworkRow
                  network={sameChainNetwork}
                  selected={selectedNetworkId === sameChainNetwork.networkId}
                  disabled={disableNetworks.includes(
                    sameChainNetwork.networkId,
                  )}
                  badgeText={sameChainLabel}
                  currencySymbol={currencySymbol}
                  onPress={() => {
                    if (disableNetworks.includes(sameChainNetwork.networkId)) {
                      onDisableNetworksClick();
                    } else {
                      onSelectNetwork(sameChainNetwork);
                    }
                  }}
                />
              </>
            ) : null}
            {!hasNetworkSearch && assetNetworks.length > 0 ? (
              <>
                <NetworkSectionLabel paddingTop={22} paddingBottom={6}>
                  NETWORKS WITH ASSETS
                </NetworkSectionLabel>
                {assetNetworks.map(({ network, fiatValue }) => (
                  <NetworkRow
                    key={`asset-${network.networkId}`}
                    network={network}
                    selected={selectedNetworkId === network.networkId}
                    disabled={disableNetworks.includes(network.networkId)}
                    fiatValue={fiatValue}
                    currencySymbol={currencySymbol}
                    onPress={() => {
                      if (disableNetworks.includes(network.networkId)) {
                        onDisableNetworksClick();
                      } else {
                        onSelectNetwork(network);
                      }
                    }}
                  />
                ))}
              </>
            ) : null}
            {!hasNetworkSearch ? (
              <NetworkSectionLabel paddingTop={4} paddingBottom={8}>
                ALL NETWORKS · A–Z
              </NetworkSectionLabel>
            ) : null}
            {networkGroups.map(({ network, children }) => (
              <YStack key={network.networkId}>
                <NetworkRow
                  network={network}
                  selected={selectedNetworkId === network.networkId}
                  disabled={disableNetworks.includes(network.networkId)}
                  currencySymbol={currencySymbol}
                  onPress={() => {
                    if (disableNetworks.includes(network.networkId)) {
                      onDisableNetworksClick();
                    } else {
                      onSelectNetwork(network);
                    }
                  }}
                />
                {children.map((child) => (
                  <NetworkRow
                    key={child.networkId}
                    network={child}
                    selected={selectedNetworkId === child.networkId}
                    disabled={disableNetworks.includes(child.networkId)}
                    indented
                    currencySymbol={currencySymbol}
                    onPress={() => {
                      if (disableNetworks.includes(child.networkId)) {
                        onDisableNetworksClick();
                      } else {
                        onSelectNetwork(child);
                      }
                    }}
                  />
                ))}
              </YStack>
            ))}
          </ScrollView>
        )}
      </YStack>
      <YStack flex={1} minWidth={0} minHeight={0}>
        <YStack px="$4" pt="$3" pb="$2">
          <Input
            testID="swap-token-selector-token-search"
            size="medium"
            height={38}
            pl={34}
            containerProps={{
              height: 38,
              bg: '$bgStrong',
              borderWidth: 0,
              borderRadius: '$3',
            }}
            leftIconName="SearchOutline"
            allowPaste={tokenSearchValue.length === 0}
            allowClear
            value={tokenSearchValue}
            placeholder={tokenSearchPlaceholder}
            onChangeText={onTokenSearchChange}
            onPaste={onPaste ? () => onPaste() : undefined}
          />
        </YStack>
        {showPopularTokens ? (
          <YStack px="$5" pt="$1">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              Popular tokens
            </SizableText>
            <SwapPopularTokenGroup
              tokens={popularTokens}
              onSelectToken={onSelectToken}
              variant="desktop"
            />
          </YStack>
        ) : null}
        {!tokenSearchValue.trim() ? (
          <XStack
            height={38}
            alignItems="center"
            justifyContent="space-between"
            pl="$5"
            pr="$4"
          >
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {selectedNetwork?.isAllNetworks
                ? allNetworksLabel
                : `Tokens on ${selectedNetwork?.name ?? ''}`}
            </SizableText>
            {showLpTokenFilterSwitch ? (
              <TokenSelectorLpTokenSwitch
                value={showLpTokensOnly}
                onChange={onLpTokenFilterChange}
                size={ESwitchSize.small}
              />
            ) : null}
          </XStack>
        ) : null}
        <YStack flex={1} minHeight={0}>
          <ListView
            data={tokens}
            renderItem={renderToken}
            estimatedItemSize={60}
            ListEmptyComponent={
              tokenListLoading ? tokenListEmptyComponent : <TokenSearchEmpty />
            }
          />
        </YStack>
      </YStack>
    </XStack>
  );
}
