// cspell: words unifold Unifold
import { useState } from 'react';

import {
  Icon,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IUnifoldSourceSelection } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import type {
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { normalizeUnifoldIconUrl } from './unifoldFormat';

// Two side-by-side dropdowns replicating the SDK double_input variant:
// "Selected token" and "Selected chain $N min". Options render icon + name
// (+ right-aligned minimum on chain rows), so both dropdowns use Popover with
// self-drawn rows — the stock Select has no trailing-text slot.

function SelectorTrigger({
  iconUri,
  label,
  loading,
}: {
  iconUri?: string;
  label?: string;
  loading: boolean;
}) {
  return (
    <XStack
      h="$10"
      px="$2.5"
      alignItems="center"
      gap="$2"
      bg="$bgSubdued"
      borderRadius="$2"
      borderWidth="$px"
      borderColor="$borderSubdued"
    >
      {loading ? (
        <SizableText size="$bodySm" color="$textSubdued">
          Loading...
        </SizableText>
      ) : (
        <>
          <Token size="xs" tokenImageUri={normalizeUnifoldIconUrl(iconUri)} />
          <SizableText
            size="$bodySm"
            color="$text"
            numberOfLines={1}
            flex={1}
            minWidth={0}
          >
            {label}
          </SizableText>
        </>
      )}
      <Icon
        name="ChevronDownSmallOutline"
        size="$4"
        color="$iconSubdued"
        opacity={0.6}
      />
    </XStack>
  );
}

function OptionRow({
  iconUri,
  label,
  selected,
  trailing,
  onPress,
}: {
  iconUri?: string;
  label: string;
  selected: boolean;
  trailing?: string;
  onPress: () => void;
}) {
  return (
    <XStack
      px="$2"
      py="$1.5"
      alignItems="center"
      gap="$2"
      borderRadius="$2"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <Stack w="$4" alignItems="center">
        {selected ? (
          <Icon name="CheckLargeOutline" size="$4" color="$icon" />
        ) : null}
      </Stack>
      <Token size="xs" tokenImageUri={normalizeUnifoldIconUrl(iconUri)} />
      <SizableText size="$bodySm" color="$text" flex={1} numberOfLines={1}>
        {label}
      </SizableText>
      {trailing ? (
        <SizableText size="$bodySm" color="$textCaution">
          {trailing}
        </SizableText>
      ) : null}
    </XStack>
  );
}

export function UnifoldSourceSelector({
  assets,
  selection,
  loading,
  onSelectToken,
  onSelectChain,
}: {
  assets: IUnifoldSupportedAsset[] | undefined;
  selection: IUnifoldSourceSelection | null;
  loading: boolean;
  onSelectToken: (asset: IUnifoldSupportedAsset) => void;
  onSelectChain: (chain: IUnifoldSupportedAssetChain) => void;
}) {
  const [tokenOpen, setTokenOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);

  const usableAssets = (assets ?? []).filter((a) => (a.chains ?? []).length);
  const minUsd = selection?.chain.minimum_deposit_amount_usd ?? 3;

  return (
    <XStack gap="$2.5">
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodySm" color="$textSubdued" mb="$2">
          Selected token
        </SizableText>
        <Popover
          title="Select token"
          open={tokenOpen}
          onOpenChange={setTokenOpen}
          renderTrigger={
            <SelectorTrigger
              iconUri={selection?.asset.icon_url}
              label={selection?.asset.symbol}
              loading={loading || !selection}
            />
          }
          renderContent={
            <ScrollView maxHeight={300} p="$1">
              {usableAssets.map((asset) => (
                <OptionRow
                  key={asset.symbol}
                  iconUri={asset.icon_url}
                  label={asset.symbol}
                  selected={asset.symbol === selection?.asset.symbol}
                  onPress={() => {
                    onSelectToken(asset);
                    setTokenOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          }
        />
      </YStack>
      <YStack flex={1} minWidth={0}>
        <XStack mb="$2" gap="$1" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            Selected chain
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textCaution">
            {`$${minUsd} min`}
          </SizableText>
        </XStack>
        <Popover
          title="Select chain"
          open={chainOpen}
          onOpenChange={setChainOpen}
          renderTrigger={
            <SelectorTrigger
              iconUri={selection?.chain.icon_url}
              label={selection?.chain.chain_name}
              loading={loading || !selection}
            />
          }
          renderContent={
            <ScrollView maxHeight={300} p="$1">
              {(selection?.asset.chains ?? []).map((chain) => (
                <OptionRow
                  key={`${chain.chain_type}-${chain.chain_id}`}
                  iconUri={chain.icon_url}
                  label={chain.chain_name}
                  selected={chain.chain_id === selection?.chain.chain_id}
                  trailing={`$${chain.minimum_deposit_amount_usd ?? 3}`}
                  onPress={() => {
                    onSelectChain(chain);
                    setChainOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          }
        />
      </YStack>
    </XStack>
  );
}
