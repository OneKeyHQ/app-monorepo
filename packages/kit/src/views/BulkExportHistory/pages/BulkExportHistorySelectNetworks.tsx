import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  type IPageScreenProps,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalBulkExportHistoryRoutes,
  IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes/bulkExportHistory';

import { useBulkExportHistoryNetworkOptions } from '../hooks/useBulkExportHistoryNetworkOptions';

function BulkExportHistorySelectNetworks({
  route,
}: IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistorySelectNetworks
>) {
  const intl = useIntl();
  const {
    supportedNetworkIds,
    selectedNetworkIds: initialSelectedNetworkIds,
    onSelectedNetworkIdsChange,
  } = route.params;

  const [selectedNetworkIds, setSelectedNetworkIds] = useState(
    initialSelectedNetworkIds,
  );

  const { networks, isLoading } =
    useBulkExportHistoryNetworkOptions(supportedNetworkIds);

  const supportedNetworkOrderMap = useMemo(
    () =>
      new Map(
        supportedNetworkIds.map(
          (networkId, index) => [networkId, index] as const,
        ),
      ),
    [supportedNetworkIds],
  );

  const sortSelectedNetworkIds = useCallback(
    (networkIds: string[]) =>
      Array.from(new Set(networkIds)).sort(
        (a, b) =>
          (supportedNetworkOrderMap.get(a) ?? 0) -
          (supportedNetworkOrderMap.get(b) ?? 0),
      ),
    [supportedNetworkOrderMap],
  );

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

  const handleDone = useCallback(
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

  const renderBody = useCallback(() => {
    if (isLoading) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    if (!networks.length) {
      return (
        <Stack flex={1} alignItems="center" justifyContent="center" px="$5">
          <SizableText color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_not_available })}
          </SizableText>
        </Stack>
      );
    }

    return (
      <ScrollView>
        <Stack py="$3">
          {networks.map((network) => {
            const isSelected = selectedNetworkIds.includes(network.id);

            return (
              <Stack key={network.id}>
                <ListItem
                  onPress={() => handleToggle(network.id)}
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
                  testID={`bulk-export-history-network-item-${network.id}`}
                >
                  <Checkbox
                    value={isSelected}
                    onChange={() => handleToggle(network.id)}
                  />
                </ListItem>
                <ListItem.Separator />
              </Stack>
            );
          })}
        </Stack>
      </ScrollView>
    );
  }, [handleToggle, intl, isLoading, networks, selectedNetworkIds]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_select_network })}
      />
      <Page.Body>{renderBody()}</Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleDone}
          onConfirmText={intl.formatMessage({ id: ETranslations.global_done })}
          confirmButtonProps={{
            disabled: selectedNetworkIds.length === 0,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BulkExportHistorySelectNetworks;
