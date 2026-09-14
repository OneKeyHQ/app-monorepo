import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Checkbox,
  Divider,
  Empty,
  type IPageScreenProps,
  Page,
  SizableText,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
  IMultiNetworkSelectorRouteParams,
} from '@onekeyhq/shared/src/routes';

import { useFuseSearch } from '../../hooks/useFuseSearch';
import { useNetworkOptions } from '../../hooks/useNetworkOptions';

export type IMultiNetworkSelectorProps = IMultiNetworkSelectorRouteParams;

export function MultiNetworkSelector({
  title,
  searchPlaceholder,
  selectAllLabel,
  networkIds,
  selectedNetworkIds: initialSelectedNetworkIds,
  networkSubtitleMap,
  topAlert,
  onSelectedNetworkIdsChange,
  confirmButtonText,
  cancelButtonText,
  emptyText,
}: IMultiNetworkSelectorProps) {
  const intl = useIntl();
  const [selectedNetworkIds, setSelectedNetworkIds] = useState(
    initialSelectedNetworkIds,
  );
  const [searchText, setSearchText] = useState('');
  const { networks, isLoading, hasError, retry } =
    useNetworkOptions(networkIds);
  const fuseSearch = useFuseSearch(networks);

  const resolvedTitle =
    title ??
    intl.formatMessage({
      id: ETranslations.global_select_network,
    });
  const resolvedSearchPlaceholder =
    searchPlaceholder ??
    intl.formatMessage({
      id: ETranslations.form_search_network_placeholder,
    });
  const resolvedSelectAllLabel =
    selectAllLabel ??
    intl.formatMessage({
      id: ETranslations.global_select_all,
    });
  const resolvedCancelButtonText =
    cancelButtonText ??
    intl.formatMessage({
      id: ETranslations.global_cancel,
    });
  const resolvedConfirmButtonText =
    confirmButtonText ??
    intl.formatMessage({
      id: ETranslations.global_confirm,
    });
  const resolvedEmptyText =
    emptyText ??
    intl.formatMessage({
      id: ETranslations.global_no_results,
    });

  const networkOrderMap = useMemo(
    () => new Map(networkIds.map((networkId, index) => [networkId, index])),
    [networkIds],
  );

  const sortSelectedNetworkIds = useCallback(
    (nextSelectedNetworkIds: string[]) =>
      Array.from(new Set(nextSelectedNetworkIds)).sort(
        (a, b) => (networkOrderMap.get(a) ?? 0) - (networkOrderMap.get(b) ?? 0),
      ),
    [networkOrderMap],
  );

  const visibleNetworks = useMemo(() => {
    const keyword = searchText.trim();

    if (!keyword) {
      return networks;
    }

    return fuseSearch(keyword);
  }, [fuseSearch, networks, searchText]);

  const visibleNetworkIds = useMemo(
    () => visibleNetworks.map((network) => network.id),
    [visibleNetworks],
  );

  const selectedVisibleNetworkCount = useMemo(
    () =>
      visibleNetworkIds.filter((networkId) =>
        selectedNetworkIds.includes(networkId),
      ).length,
    [selectedNetworkIds, visibleNetworkIds],
  );

  const selectAllValue = useMemo(() => {
    if (!visibleNetworkIds.length || selectedVisibleNetworkCount === 0) {
      return false;
    }

    if (selectedVisibleNetworkCount === visibleNetworkIds.length) {
      return true;
    }

    return 'indeterminate';
  }, [selectedVisibleNetworkCount, visibleNetworkIds.length]);

  const handleToggle = useCallback(
    (networkId: string) => {
      setSelectedNetworkIds((prev) => {
        if (prev.includes(networkId)) {
          return prev.filter((item) => item !== networkId);
        }

        return sortSelectedNetworkIds([...prev, networkId]);
      });
    },
    [sortSelectedNetworkIds],
  );

  const handleToggleAll = useCallback(() => {
    setSelectedNetworkIds((prev) => {
      if (!visibleNetworkIds.length) {
        return prev;
      }

      const isAllVisibleSelected = visibleNetworkIds.every((networkId) =>
        prev.includes(networkId),
      );

      if (isAllVisibleSelected) {
        return prev.filter(
          (networkId) => !visibleNetworkIds.includes(networkId),
        );
      }

      return sortSelectedNetworkIds([...prev, ...visibleNetworkIds]);
    });
  }, [sortSelectedNetworkIds, visibleNetworkIds]);

  const handleClose = useCallback((close: () => void) => {
    close();
  }, []);

  const handleRetry = useCallback(() => {
    void retry();
  }, [retry]);

  const handleConfirm = useCallback(
    (close: () => void) => {
      const nextSelectedNetworkIds = sortSelectedNetworkIds(selectedNetworkIds);
      const isSelectionChanged =
        nextSelectedNetworkIds.length !== initialSelectedNetworkIds.length ||
        nextSelectedNetworkIds.some(
          (networkId, index) => networkId !== initialSelectedNetworkIds[index],
        );

      if (isSelectionChanged) {
        onSelectedNetworkIdsChange?.(nextSelectedNetworkIds);
      }

      close();
    },
    [
      initialSelectedNetworkIds,
      onSelectedNetworkIdsChange,
      selectedNetworkIds,
      sortSelectedNetworkIds,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={resolvedTitle}
        headerSearchBarOptions={{
          placeholder: resolvedSearchPlaceholder,
          onSearchTextChange: setSearchText,
          searchBarInputValue: searchText,
        }}
      />
      <Page.Body bg="$bgApp">
        <Stack flex={1} px="$5">
          {isLoading ? (
            <Stack flex={1} alignItems="center" justifyContent="center">
              <Spinner size="large" />
            </Stack>
          ) : null}
          {!isLoading && hasError ? (
            <Empty
              pt="$24"
              icon="ErrorOutline"
              title={intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              })}
              description={intl.formatMessage({
                id: ETranslations.global_an_error_occurred_desc,
              })}
              buttonProps={{
                onPress: handleRetry,
                children: intl.formatMessage({
                  id: ETranslations.global_retry,
                }),
              }}
            />
          ) : null}
          {!isLoading && !hasError ? (
            <Stack gap="$4">
              {topAlert ? (
                <Alert
                  icon={topAlert.icon as ComponentProps<typeof Alert>['icon']}
                  title={topAlert.title}
                  description={topAlert.description}
                />
              ) : null}
              {visibleNetworks.length ? (
                <Stack>
                  <ListItem
                    py="$2"
                    px="$3"
                    mx="$-3"
                    title={resolvedSelectAllLabel}
                    testID="multi-network-selector-select-all-item"
                    onPress={handleToggleAll}
                  >
                    <Checkbox
                      testID="multi-network-selector-select-all"
                      value={selectAllValue}
                      onChange={handleToggleAll}
                      shouldStopPropagation
                    />
                  </ListItem>

                  <Divider my="$5" />
                  {visibleNetworks.map((network) => {
                    const isSelected = selectedNetworkIds.includes(network.id);
                    const subtitle = networkSubtitleMap?.[network.id];

                    return (
                      <ListItem
                        key={network.id}
                        py="$2"
                        px="$3"
                        mx="$-3"
                        renderAvatar={
                          <NetworkAvatarBase
                            logoURI={network.logoURI}
                            size="$8"
                            networkName={network.name}
                            isCustomNetwork={network.isCustomNetwork}
                            isAllNetworks={network.isAllNetworks}
                            allNetworksIconProps={{
                              color: '$iconActive',
                            }}
                          />
                        }
                        title={network.name}
                        subtitle={subtitle}
                        testID={`multi-network-selector-item-${network.id}`}
                        onPress={() => handleToggle(network.id)}
                      >
                        <Checkbox
                          testID={`multi-network-selector-checkbox-${network.id}`}
                          value={isSelected}
                          onChange={() => handleToggle(network.id)}
                          shouldStopPropagation
                        />
                      </ListItem>
                    );
                  })}
                </Stack>
              ) : (
                <Stack py="$8" alignItems="center" justifyContent="center">
                  <SizableText color="$textSubdued">
                    {resolvedEmptyText}
                  </SizableText>
                </Stack>
              )}
            </Stack>
          ) : null}
        </Stack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancel={handleClose}
          onConfirm={handleConfirm}
          onCancelText={resolvedCancelButtonText}
          onConfirmText={resolvedConfirmButtonText}
          confirmButtonProps={{
            disabled: selectedNetworkIds.length === 0 || isLoading || hasError,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default function MultiNetworkSelectorPage({
  route,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.MultiNetworkSelector
>) {
  return <MultiNetworkSelector {...route.params} />;
}
