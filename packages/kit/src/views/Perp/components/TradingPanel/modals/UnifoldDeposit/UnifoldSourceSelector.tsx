// cspell: words unifold Unifold
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  Icon,
  IconButton,
  Popover,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import type { IUnifoldSourceSelection } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';

import {
  isUnifoldNativeTokenAddress,
  normalizeUnifoldIconUrl,
} from './unifoldFormat';

const SELECTOR_POPOVER_WIDTH = 400;
const SELECTOR_POPOVER_MAX_HEIGHT = 360;
const SELECTOR_LABEL_BOTTOM_PADDING = platformEnv.isNative ? '$px' : '$0.5';

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
        <>
          <Skeleton w="$6" h="$6" radius="round" />
          <XStack flex={1} minWidth={0}>
            <Skeleton h="$3" w="$16" />
          </XStack>
        </>
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
      <Icon name="ChevronDownSmallOutline" size="$4" color="$icon" />
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
      px={platformEnv.isNative ? '$0' : '$2.5'}
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
      <YStack px={platformEnv.isNative ? '$0' : '$2'} py="$2" gap="$1">
        {children}
      </YStack>
    </ScrollView>
  );
}

function TokenContractContent({
  selection,
}: {
  selection: IUnifoldSourceSelection;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const isDarkTheme = useThemeVariant() === 'dark';
  const { chain } = selection;
  const isNativeToken = isUnifoldNativeTokenAddress(chain.token_address);

  return (
    <YStack gap="$4">
      <XStack
        bg={isDarkTheme ? '$bgStrong' : '$bgSubdued'}
        borderRadius="$3"
        p="$3"
        gap="$2"
        alignItems="flex-start"
      >
        <Icon
          name="InfoCircleOutline"
          size="$4"
          color="$iconSubdued"
          mt="$0.5"
          flexShrink={0}
        />
        <SizableText size="$bodySm" color="$text" flex={1}>
          {intl.formatMessage(
            {
              id: ETranslations.perp_unifold_token_contract_warning__desc,
            },
            { token: selection.asset.symbol },
          )}
        </SizableText>
      </XStack>
      <YStack gap="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {chain.chain_name}
        </SizableText>
        <XStack gap="$4" alignItems="center">
          <SizableText
            size="$bodyMdMedium"
            color="$text"
            fontFamily="$monoRegular"
            flex={1}
            minWidth={0}
            wordWrap="break-word"
            selectable
          >
            {isNativeToken
              ? intl.formatMessage({
                  id: ETranslations.perp_unifold_native_token__title,
                })
              : chain.token_address}
          </SizableText>
          {isNativeToken ? null : (
            <IconButton
              testID={`perps-unifold-copy-token-contract-${chain.chain_type}-${chain.chain_id}`}
              icon="Copy3Outline"
              variant="secondary"
              size="small"
              width="$8"
              height="$8"
              flexShrink={0}
              cursor="pointer"
              onPress={() => copyText(chain.token_address)}
            />
          )}
        </XStack>
      </YStack>
    </YStack>
  );
}

function SelectedTokenLabel({
  selection,
}: {
  selection: IUnifoldSourceSelection | null;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const label = intl.formatMessage({
    id: ETranslations.perp_unifold_selected_token__title,
  });
  if (!selection?.chain.token_address?.trim()) {
    return (
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        numberOfLines={1}
        flexShrink={1}
      >
        {label}
      </SizableText>
    );
  }
  const trigger = (
    <DashText
      testID="perps-unifold-selected-token-contract"
      size="$bodySm"
      color="$textSubdued"
      dashColor="$textDisabled"
      dashThickness={0.5}
      dashOverlay
      numberOfLines={1}
      cursor="pointer"
    >
      {label}
    </DashText>
  );
  if (!platformEnv.isNative && gtMd) {
    return (
      <Tooltip
        hovering
        placement="bottom-start"
        contentProps={{ width: 360, maxWidth: 360, px: 18, py: '$5' }}
        renderTrigger={<Stack cursor="help">{trigger}</Stack>}
        renderContent={<TokenContractContent selection={selection} />}
      />
    );
  }
  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.perp_unifold_token_contract__title,
      })}
      placement="bottom-start"
      floatingPanelProps={{ width: 360 }}
      renderTrigger={trigger}
      renderContent={
        <YStack px="$5" pb="$5">
          <TokenContractContent selection={selection} />
        </YStack>
      }
    />
  );
}

export function UnifoldSourceSelector({
  assets,
  selection,
  loading,
  onSelectToken,
  onSelectChain,
  onOpenMobileTokenSelector,
  onOpenMobileChainSelector,
}: {
  assets: IUnifoldSupportedAsset[] | undefined;
  selection: IUnifoldSourceSelection | null;
  loading: boolean;
  onSelectToken: (asset: IUnifoldSupportedAsset) => void;
  onSelectChain: (chain: IUnifoldSupportedAssetChain) => void;
  onOpenMobileTokenSelector?: () => void;
  onOpenMobileChainSelector?: () => void;
}) {
  const intl = useIntl();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const usableAssets = (assets ?? []).filter((a) => (a.chains ?? []).length);
  const chainOptions = selection?.asset.chains ?? [];
  // Popover has no disabled state of its own, so an empty catalog would open a
  // blank sheet (and, on desktop, an invisible overlay that swallows a click).
  const canSelectToken = usableAssets.length > 0;
  const canSelectChain = chainOptions.length > 0;

  const tokenTrigger = (
    <SelectorTrigger
      testID="perps-unifold-token-selector"
      iconUri={selection?.asset.icon_url}
      label={selection?.asset.symbol}
      loading={loading || !selection}
      disabled={!canSelectToken}
      onPress={() => {
        if (!canSelectToken) {
          return;
        }
        if (onOpenMobileTokenSelector) {
          onOpenMobileTokenSelector();
          return;
        }

        setTokenOpen(true);
      }}
    />
  );

  const chainTrigger = (
    <SelectorTrigger
      testID="perps-unifold-network-selector"
      iconUri={selection?.chain.icon_url}
      label={selection?.chain.chain_name}
      loading={loading || !selection}
      disabled={!canSelectChain}
      onPress={() => {
        if (!canSelectChain) {
          return;
        }
        if (onOpenMobileChainSelector) {
          onOpenMobileChainSelector();
          return;
        }

        setChainOpen(true);
      }}
    />
  );

  return (
    <XStack gap="$3">
      <YStack flex={1} flexBasis={0} minWidth={0}>
        <XStack
          width="100%"
          mb="$1.5"
          pb={SELECTOR_LABEL_BOTTOM_PADDING}
          gap="$2"
          alignItems="center"
          justifyContent="space-between"
        >
          <SelectedTokenLabel selection={selection} />
        </XStack>
        {onOpenMobileTokenSelector ? (
          tokenTrigger
        ) : (
          <Popover
            title={intl.formatMessage({
              id: ETranslations.token_selector_title,
            })}
            placement="bottom-start"
            open={tokenOpen}
            onOpenChange={(next) => setTokenOpen(next && canSelectToken)}
            floatingPanelProps={{ width: SELECTOR_POPOVER_WIDTH }}
            renderTrigger={tokenTrigger}
            renderContent={
              <SelectorOptions>
                {usableAssets.map((asset) => (
                  <OptionRow
                    key={asset.symbol}
                    testID={`perps-unifold-token-option-${asset.symbol}`}
                    iconUri={asset.icon_url}
                    label={asset.symbol}
                    description={
                      asset.chains.length === 1
                        ? `1 ${intl.formatMessage({
                            id: ETranslations.global_network,
                          })}`
                        : intl.formatMessage(
                            { id: ETranslations.global_count_networks },
                            { count: asset.chains.length },
                          )
                    }
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
        )}
      </YStack>
      <YStack flex={1} flexBasis={0} minWidth={0}>
        <XStack
          width="100%"
          mb="$1.5"
          pb={SELECTOR_LABEL_BOTTOM_PADDING}
          gap="$2"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_unifold_selected_chain__title,
            })}
          </SizableText>
        </XStack>
        {onOpenMobileChainSelector ? (
          chainTrigger
        ) : (
          <Popover
            title={intl.formatMessage({
              id: ETranslations.global_select_network,
            })}
            placement="bottom-end"
            open={chainOpen}
            onOpenChange={(next) => setChainOpen(next && canSelectChain)}
            floatingPanelProps={{ width: SELECTOR_POPOVER_WIDTH }}
            renderTrigger={chainTrigger}
            renderContent={
              <SelectorOptions>
                {chainOptions.map((chain) => (
                  <OptionRow
                    key={`${chain.chain_type}-${chain.chain_id}`}
                    testID={`perps-unifold-network-option-${chain.chain_type}-${chain.chain_id}`}
                    iconUri={chain.icon_url}
                    label={chain.chain_name}
                    selected={chain.chain_id === selection?.chain.chain_id}
                    description={`${intl.formatMessage({
                      id: ETranslations.perp_unifold_minimum_deposit__title,
                    })} $${chain.minimum_deposit_amount_usd ?? 3}`}
                    onPress={() => {
                      onSelectChain(chain);
                      setChainOpen(false);
                    }}
                  />
                ))}
              </SelectorOptions>
            }
          />
        )}
      </YStack>
    </XStack>
  );
}
