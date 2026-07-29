import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  StackActions,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Empty,
  type IPageNavigationProp,
  Icon,
  Page,
  ScrollView,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  type IUnifoldDepositErrorType,
  getUnifoldDepositErrorType,
} from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
  type IUnifoldSourceSelectorResult,
} from '@onekeyhq/shared/src/routes/perp';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { normalizeUnifoldIconUrl } from './unifoldFormat';

import type { RouteProp } from '@react-navigation/native';

function MobileSourceSelectorRow({
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
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      mx="$-2"
      px="$2"
      borderRadius="$4"
      cursor="pointer"
      userSelect="none"
      hoverStyle={platformEnv.isNative ? undefined : { bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <XStack width="100%" alignItems="center" gap="$3" py="$2.5">
        <Token tokenImageUri={normalizeUnifoldIconUrl(iconUri)} size="md" />
        <YStack flex={1} minWidth={0}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {label}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {description}
          </SizableText>
        </YStack>
        {selected ? (
          <Icon name="CheckRadioSolid" size="$5" color="$iconActive" />
        ) : (
          <Stack width="$5" />
        )}
      </XStack>
    </XStack>
  );
}

function MobileSourceSelectorSkeleton() {
  return (
    <YStack>
      {Array.from({ length: 6 }).map((_, index) => (
        <XStack key={index} width="100%" alignItems="center" gap="$3" py="$2.5">
          <Skeleton width="$10" height="$10" radius="round" />
          <YStack gap="$1.5">
            <Skeleton width="$16" height="$4" />
            <Skeleton width="$24" height="$3" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

export default function MobileUnifoldSourceSelectorModal() {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldSourceSelector
      >
    >();
  const {
    requestId,
    mode,
    assets,
    selectedAssetSymbol,
    selectedChainType,
    selectedChainId,
    entryFlow,
  } = route.params;
  const [loadedAssets, setLoadedAssets] = useState(assets);
  const [isLoading, setIsLoading] = useState(!assets && Boolean(entryFlow));
  const [loadError, setLoadError] = useState<IUnifoldDepositErrorType | null>(
    null,
  );
  const [retryNonce, setRetryNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (assets) {
        setLoadedAssets(assets);
        setLoadError(null);
        setIsLoading(false);
        return;
      }
      if (!entryFlow) {
        setLoadedAssets([]);
        setLoadError(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const nextAssets =
          await backgroundApiProxy.serviceUnifoldDeposit.getSupportedAssets(
            entryFlow.destination,
          );
        if (!cancelled) {
          setLoadedAssets(nextAssets);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadedAssets(undefined);
          setLoadError(getUnifoldDepositErrorType(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assets, entryFlow, retryNonce]);
  const usableAssets = useMemo(
    () => (loadedAssets ?? []).filter((asset) => asset.chains.length > 0),
    [loadedAssets],
  );
  const filteredAssets = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return usableAssets;
    }
    return usableAssets.filter((asset) =>
      [asset.symbol, asset.name].some((field) =>
        field.toLowerCase().includes(keyword),
      ),
    );
  }, [searchValue, usableAssets]);
  const selectedAsset = useMemo(
    () =>
      usableAssets.find((asset) => asset.symbol === selectedAssetSymbol) ??
      usableAssets[0],
    [selectedAssetSymbol, usableAssets],
  );
  const chainOptions = useMemo(
    () => selectedAsset?.chains ?? [],
    [selectedAsset],
  );
  const filteredChains = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return chainOptions;
    }
    return chainOptions.filter((chain) =>
      [chain.chain_name, chain.chain_type, chain.chain_id].some((field) =>
        field.toLowerCase().includes(keyword),
      ),
    );
  }, [chainOptions, searchValue]);
  const returnSelection = useCallback(
    (sourceSelectorResult: IUnifoldSourceSelectorResult) => {
      navigation.dispatch(
        StackActions.popTo(
          EModalPerpRoutes.MobileUnifoldDepositTransfer,
          { sourceSelectorResult },
          { merge: true },
        ),
      );
    },
    [navigation],
  );
  const selectEntryToken = useCallback(
    (assetSymbol: string) => {
      if (!entryFlow) {
        return;
      }
      navigation.push(EModalPerpRoutes.MobileUnifoldSourceSelector, {
        requestId: generateUUID(),
        mode: 'chain',
        assets: usableAssets,
        selectedAssetSymbol: assetSymbol,
        entryFlow,
      });
    },
    [entryFlow, navigation, usableAssets],
  );
  const selectEntryChain = useCallback(
    ({
      assetSymbol,
      chainType,
      chainId,
    }: {
      assetSymbol: string;
      chainType: string;
      chainId: string;
    }) => {
      if (!entryFlow) {
        return;
      }
      navigation.push(EModalPerpRoutes.MobileUnifoldDepositTransfer, {
        expectedRecipient: entryFlow.expectedRecipient,
        sourceSelectorResult: {
          requestId,
          mode: 'chain',
          assetSymbol,
          chainType,
          chainId,
        },
      });
    },
    [entryFlow, navigation, requestId],
  );
  let optionRows: ReactNode = null;
  if (mode === 'token') {
    optionRows = filteredAssets.map((asset) => (
      <MobileSourceSelectorRow
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
        selected={asset.symbol === selectedAssetSymbol}
        onPress={() => {
          if (entryFlow) {
            selectEntryToken(asset.symbol);
          } else {
            returnSelection({
              requestId,
              mode: 'token',
              assetSymbol: asset.symbol,
            });
          }
        }}
      />
    ));
  } else if (selectedAsset) {
    optionRows = filteredChains.map((chain) => (
      <MobileSourceSelectorRow
        key={`${chain.chain_type}-${chain.chain_id}`}
        testID={`perps-unifold-network-option-${chain.chain_type}-${chain.chain_id}`}
        iconUri={chain.icon_url}
        label={chain.chain_name}
        description={`${intl.formatMessage({
          id: ETranslations.perp_unifold_minimum_deposit__title,
        })} $${chain.minimum_deposit_amount_usd ?? 3}`}
        selected={
          chain.chain_type === selectedChainType &&
          chain.chain_id === selectedChainId
        }
        onPress={() => {
          const result = {
            assetSymbol: selectedAsset.symbol,
            chainType: chain.chain_type,
            chainId: chain.chain_id,
          };
          if (entryFlow) {
            selectEntryChain(result);
          } else {
            returnSelection({
              requestId,
              mode: 'chain',
              ...result,
            });
          }
        }}
      />
    ));
  }
  const hasResults =
    mode === 'token' ? filteredAssets.length > 0 : filteredChains.length > 0;
  let listContent: ReactNode = (
    <YStack py="$10">
      <Empty
        illustration="TwoBlocks"
        title={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
      />
    </YStack>
  );
  if (isLoading) {
    listContent = <MobileSourceSelectorSkeleton />;
  } else if (loadError) {
    const isNetworkError = loadError === 'network';
    listContent = (
      <YStack py="$10">
        <Empty
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: isNetworkError
              ? ETranslations.global_connet_error_try_again
              : ETranslations.provider_unavailable,
          })}
          description={
            isNetworkError
              ? undefined
              : intl.formatMessage({
                  id:
                    loadError === 'geoBlocked'
                      ? ETranslations.description_403
                      : ETranslations.global_unknown_error_retry_message,
                })
          }
          buttonProps={{
            children: intl.formatMessage({
              id: ETranslations.global_retry,
            }),
            onPress: () => setRetryNonce((value) => value + 1),
          }}
        />
      </YStack>
    );
  } else if (hasResults) {
    listContent = optionRows;
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id:
            mode === 'token'
              ? ETranslations.token_selector_title
              : ETranslations.global_select_network,
        })}
      />
      <Page.Body>
        <YStack px="$4" flex={1} minHeight={0}>
          <YStack pb="$3">
            <SearchBar
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder={intl.formatMessage({
                id:
                  mode === 'token'
                    ? ETranslations.global_search_tokens
                    : ETranslations.form_search_network_placeholder,
              })}
              containerProps={{
                bg: '$bgStrong',
                borderRadius: '$full',
              }}
            />
          </YStack>
          <Stack flex={1} minHeight={0} mx="$-2">
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack px="$2">{listContent}</YStack>
            </ScrollView>
          </Stack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
