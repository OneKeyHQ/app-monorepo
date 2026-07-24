// cspell: words unifold Unifold
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  Dialog,
  Icon,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useInPageDialog,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { deferHeavyWorkUntilUIIdle } from '@onekeyhq/kit/src/utils/deferHeavyWork';
import type { IUnifoldSourceSelection } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  const intl = useIntl();
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
          {intl.formatMessage({
            id: ETranslations.perp_token_selector_loading,
          })}
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

function showSelectorDialog({
  title,
  content,
  dialog,
}: {
  title: string;
  content: React.ReactNode;
  dialog: ReturnType<typeof useInPageDialog>;
}) {
  const DialogInstance = platformEnv.isNativeAndroid ? Dialog : dialog;

  return DialogInstance.show({
    title,
    renderContent: content,
    contentContainerProps: platformEnv.isNative ? { pb: 0 } : undefined,
    showFooter: false,
  });
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
  const intl = useIntl();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const dialog = useInPageDialog();

  const usableAssets = (assets ?? []).filter((a) => (a.chains ?? []).length);
  const chainOptions = selection?.asset.chains ?? [];
  const minUsd = selection?.chain.minimum_deposit_amount_usd ?? 3;
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
        if (!platformEnv.isNative) {
          setTokenOpen(true);
          return;
        }

        const dialogInstance = showSelectorDialog({
          title: intl.formatMessage({
            id: ETranslations.token_selector_title,
          }),
          dialog,
          content: (
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
                    void (async () => {
                      await dialogInstance.close();
                      await deferHeavyWorkUntilUIIdle({
                        minFrames: platformEnv.isNative ? 3 : 1,
                      });
                      onSelectToken(asset);
                    })();
                  }}
                />
              ))}
            </SelectorOptions>
          ),
        });
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
        if (!platformEnv.isNative) {
          setChainOpen(true);
          return;
        }

        const dialogInstance = showSelectorDialog({
          title: intl.formatMessage({
            id: ETranslations.global_select_network,
          }),
          dialog,
          content: (
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
                    void (async () => {
                      await dialogInstance.close();
                      await deferHeavyWorkUntilUIIdle({
                        minFrames: platformEnv.isNative ? 3 : 1,
                      });
                      onSelectChain(chain);
                    })();
                  }}
                />
              ))}
            </SelectorOptions>
          ),
        });
      }}
    />
  );

  return (
    <XStack gap="$2.5">
      <YStack flex={1} flexBasis={0} minWidth={0}>
        <SizableText size="$bodySm" color="$textSubdued" mb="$2">
          {intl.formatMessage({
            id: ETranslations.perp_unifold_selected_token__title,
          })}
        </SizableText>
        {platformEnv.isNative ? (
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
          mb="$2"
          gap="$2"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_unifold_selected_chain__title,
            })}
          </SizableText>
          <DashText
            size="$bodySmMedium"
            color="$textCaution"
            dashColor="$borderCaution"
            dashThickness={0.5}
            textAlign="right"
            flexShrink={0}
            tooltip={intl.formatMessage({
              id: ETranslations.perp_unifold_minimum_deposit_network__desc,
            })}
            tooltipTitle={intl.formatMessage({
              id: ETranslations.perp_unifold_minimum_deposit__title,
            })}
            tooltipPlacement="bottom-end"
          >
            {intl.formatMessage(
              {
                id: ETranslations.perp_unifold_minimum_deposit_short__value,
              },
              { amount: `$${minUsd}` },
            )}
          </DashText>
        </XStack>
        {platformEnv.isNative ? (
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
