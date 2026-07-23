// cspell: words unifold Unifold
import { useState } from 'react';

import {
  Button,
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

const SELECTOR_POPOVER_WIDTH = 400;
const SELECTOR_POPOVER_MAX_HEIGHT = 360;

function SelectorTrigger({
  testID,
  iconUri,
  label,
  loading,
  disabled,
  onPress,
}: {
  testID: string;
  iconUri?: string;
  label?: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      role="button"
      height="$10"
      px="$2.5"
      alignItems="center"
      gap="$2"
      bg="$bgSubdued"
      borderRadius="$2"
      borderWidth="$px"
      borderColor="$borderSubdued"
      opacity={disabled ? 0.6 : 1}
      disabled={disabled}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={
        disabled
          ? undefined
          : {
              bg: '$bgStrongHover',
            }
      }
      pressStyle={
        disabled
          ? undefined
          : {
              bg: '$bgStrongActive',
            }
      }
      onPress={onPress}
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
  testID,
  iconUri,
  label,
  description,
  selected,
  onPress,
}: {
  testID: string;
  iconUri?: string;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      testID={testID}
      variant="tertiary"
      childrenAsText={false}
      width="100%"
      height="auto"
      minHeight="$13"
      px="$2.5"
      py="$1.5"
      m="$0"
      alignItems="center"
      justifyContent="flex-start"
      gap="$2.5"
      borderRadius="$2"
      onPress={onPress}
    >
      <Token size="md" tokenImageUri={normalizeUnifoldIconUrl(iconUri)} />
      <YStack flex={1} minWidth={0} alignItems="flex-start" gap="$0.5">
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
          {label}
        </SizableText>
        {description ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {description}
          </SizableText>
        ) : null}
      </YStack>
      {selected ? (
        <Icon name="CheckRadioSolid" size="$5" color="$iconActive" />
      ) : (
        <Stack width="$5" />
      )}
    </Button>
  );
}

function SelectorOptions({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      maxHeight={SELECTOR_POPOVER_MAX_HEIGHT}
      showsVerticalScrollIndicator={false}
    >
      <YStack p="$2" gap="$1">
        {children}
      </YStack>
    </ScrollView>
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
  const chainOptions = selection?.asset.chains ?? [];
  const minUsd = selection?.chain.minimum_deposit_amount_usd ?? 3;
  // Popover has no disabled state of its own, so an empty catalog would open a
  // blank sheet (and, on desktop, an invisible overlay that swallows a click).
  const canSelectToken = usableAssets.length > 0;
  const canSelectChain = chainOptions.length > 0;

  return (
    <XStack gap="$2.5">
      <YStack flex={1} flexBasis={0} minWidth={0}>
        <SizableText size="$bodySm" color="$textSubdued" mb="$2">
          Selected token
        </SizableText>
        <Popover
          title="Select token"
          placement="bottom-start"
          open={tokenOpen}
          onOpenChange={(next) => setTokenOpen(next && canSelectToken)}
          floatingPanelProps={{ width: SELECTOR_POPOVER_WIDTH }}
          renderTrigger={
            <SelectorTrigger
              testID="perps-unifold-token-selector"
              iconUri={selection?.asset.icon_url}
              label={selection?.asset.symbol}
              loading={loading || !selection}
              disabled={!canSelectToken}
              onPress={() => setTokenOpen(true)}
            />
          }
          renderContent={
            <SelectorOptions>
              {usableAssets.map((asset) => (
                <OptionRow
                  key={asset.symbol}
                  testID={`perps-unifold-token-option-${asset.symbol}`}
                  iconUri={asset.icon_url}
                  label={asset.symbol}
                  description={`${asset.chains.length} ${
                    asset.chains.length === 1 ? 'network' : 'networks'
                  }`}
                  selected={asset.symbol === selection?.asset.symbol}
                  onPress={() => {
                    onSelectToken(asset);
                    setTokenOpen(false);
                  }}
                />
              ))}
            </SelectorOptions>
          }
        />
      </YStack>
      <YStack flex={1} flexBasis={0} minWidth={0}>
        <XStack
          width="100%"
          mb="$2"
          gap="$2"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            Selected chain
          </SizableText>
          <SizableText
            size="$bodySmMedium"
            color="$textCaution"
            textAlign="right"
            flexShrink={0}
          >
            {`$${minUsd} min`}
          </SizableText>
        </XStack>
        <Popover
          title="Select network"
          placement="bottom-end"
          open={chainOpen}
          onOpenChange={(next) => setChainOpen(next && canSelectChain)}
          floatingPanelProps={{ width: SELECTOR_POPOVER_WIDTH }}
          renderTrigger={
            <SelectorTrigger
              testID="perps-unifold-network-selector"
              iconUri={selection?.chain.icon_url}
              label={selection?.chain.chain_name}
              loading={loading || !selection}
              disabled={!canSelectChain}
              onPress={() => setChainOpen(true)}
            />
          }
          renderContent={
            <SelectorOptions>
              {chainOptions.map((chain) => (
                <OptionRow
                  key={`${chain.chain_type}-${chain.chain_id}`}
                  testID={`perps-unifold-network-option-${chain.chain_type}-${chain.chain_id}`}
                  iconUri={chain.icon_url}
                  label={chain.chain_name}
                  selected={chain.chain_id === selection?.chain.chain_id}
                  description={`Minimum deposit $${
                    chain.minimum_deposit_amount_usd ?? 3
                  }`}
                  onPress={() => {
                    onSelectChain(chain);
                    setChainOpen(false);
                  }}
                />
              ))}
            </SelectorOptions>
          }
        />
      </YStack>
    </XStack>
  );
}
