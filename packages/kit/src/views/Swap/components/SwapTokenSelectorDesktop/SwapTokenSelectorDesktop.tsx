import type { MutableRefObject, ReactElement } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  Icon,
  Input,
  ListView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapPopularTokenGroup from '../SwapPopularTokenGroup';

import { SwapTokenSelectorNetworkColumn } from './SwapTokenSelectorNetworkColumn';

import type { ISwapNetworkAsset } from './SwapTokenSelectorDesktop.utils';
import type { FlatList } from 'react-native';

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
  listViewRef?: MutableRefObject<FlatList<ISwapTokenItem> | null>;
  popularTokens: ISwapToken[];
  showPopularTokens: boolean;
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
  onLpTokenFilterChange: (value: boolean) => void;
  tokens: ISwapTokenItem[];
  renderToken: (params: {
    item: ISwapTokenItem;
    index: number;
  }) => ReactElement | null;
  currencySymbol: string;
  tokenListEmptyComponent?: ReactElement | null;
  // Kept to one network (Earn's Pay with): the token column alone
  hideNetworkColumn?: boolean;
};

function TokenSearchEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
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
        {title}
      </SizableText>
      <SizableText size="$bodySm" color="$textDisabled">
        {description}
      </SizableText>
    </YStack>
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
  listViewRef,
  popularTokens,
  showPopularTokens,
  showLpTokenFilterSwitch,
  showLpTokensOnly,
  onLpTokenFilterChange,
  tokens,
  renderToken,
  currencySymbol,
  tokenListEmptyComponent,
  hideNetworkColumn,
}: ISwapTokenSelectorDesktopProps) {
  const intl = useIntl();

  return (
    <XStack testID="swap-token-selector-desktop" flex={1} minHeight={0}>
      <SwapTokenSelectorNetworkColumn
        hidden={hideNetworkColumn}
        allNetwork={allNetwork}
        networks={networks}
        sameChainNetwork={sameChainNetwork}
        selectedNetwork={selectedNetwork}
        assetNetworks={assetNetworks}
        disableNetworks={disableNetworks}
        networkSearchValue={networkSearchValue}
        allNetworksLabel={allNetworksLabel}
        sameChainLabel={sameChainLabel}
        onNetworkSearchChange={onNetworkSearchChange}
        onSelectNetwork={onSelectNetwork}
        onDisableNetworksClick={onDisableNetworksClick}
        currencySymbol={currencySymbol}
      />
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
          />
        </YStack>
        {showPopularTokens ? (
          <YStack px="$5" pt="$1">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_token_selector_popular_token,
              })}
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
                : intl.formatMessage(
                    { id: ETranslations.title_tokens_on_network },
                    { network: selectedNetwork?.name ?? '' },
                  )}
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
            ref={listViewRef}
            data={tokens}
            renderItem={renderToken}
            estimatedItemSize={60}
            ListEmptyComponent={
              tokenListEmptyComponent ?? (
                <TokenSearchEmpty
                  title={intl.formatMessage({
                    id: ETranslations.empty_no_tokens_found,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.description_check_spelling_or_paste_contract_address,
                  })}
                />
              )
            }
          />
        </YStack>
      </YStack>
    </XStack>
  );
}
