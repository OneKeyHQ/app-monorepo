import { memo, useCallback, useContext, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack, XStack } from '@onekeyhq/components';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import ChainSelectorTooltip from '../ChainSelectorTooltip';
import DottedLine from '../DottedLine';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

function NetworkListHeader() {
  const intl = useIntl();
  const {
    walletId,
    indexedAccountId,
    networks,
    enabledNetworks,
    setNetworksState,
    searchKey,
    setMissingAddressCount,
  } = useContext(AllNetworksManagerContext);

  const { enabledNetworksWithoutAccount, run } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId: walletId ?? '',
      indexedAccountId,
      filterNetworksWithoutAccount: true,
      enabledNetworks,
    });

  const isAllNetworksEnabled = useMemo(() => {
    if (enabledNetworks.length > 0) {
      if (enabledNetworks.length === networks.mainNetworks.length) {
        return true;
      }
      return 'indeterminate';
    }
    return false;
  }, [enabledNetworks, networks.mainNetworks]);

  const toggleAllNetworks = useMemo(() => {
    return Object.fromEntries(
      networks.mainNetworks.map((network) => [network.id, true]),
    );
  }, [networks.mainNetworks]);

  useEffect(() => {
    setMissingAddressCount(enabledNetworksWithoutAccount.length);
  }, [enabledNetworksWithoutAccount.length, setMissingAddressCount]);

  const enabledNetworkIds = useMemo(
    () => enabledNetworks.map((network) => network.id).join(','),
    [enabledNetworks],
  );

  useEffect(() => {
    void run();
  }, [enabledNetworkIds, run]);

  const handleToggleAll = useCallback(() => {
    if (isAllNetworksEnabled) {
      setNetworksState({
        enabledNetworks: {},
        disabledNetworks: toggleAllNetworks,
      });
    } else {
      setNetworksState({
        enabledNetworks: toggleAllNetworks,
        disabledNetworks: {},
      });
    }
  }, [isAllNetworksEnabled, setNetworksState, toggleAllNetworks]);

  return (
    <Stack mt="$4" pb="$3">
      {searchKey?.trim() ? null : (
        <XStack
          px="$5"
          py="$2"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack flex={1} mr="$2" alignItems="flex-start" overflow="hidden">
            <ChainSelectorTooltip
              renderContent={intl.formatMessage({
                id: ETranslations.network_selection_performance_tip,
              })}
              renderTrigger={
                <Stack maxWidth="100%">
                  <SizableText size="$bodyLgMedium">
                    {intl.formatMessage(
                      {
                        id: ETranslations.network_view_assets_from_n_networks,
                      },
                      { count: enabledNetworks.length },
                    )}
                  </SizableText>
                  <DottedLine mt={1} />
                </Stack>
              }
            />
          </Stack>
          <Button
            flexShrink={0}
            size="media"
            variant="tertiary"
            onPress={handleToggleAll}
          >
            {isAllNetworksEnabled
              ? intl.formatMessage({ id: ETranslations.global_deselect_all })
              : intl.formatMessage({ id: ETranslations.global_select_all })}
          </Button>
        </XStack>
      )}
    </Stack>
  );
}

export default memo(NetworkListHeader);
