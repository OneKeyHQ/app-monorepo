import { memo, useCallback, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

import ChainSelectorTooltip from '../ChainSelectorTooltip';
import DottedLine from '../DottedLine';

function NetworkListHeader() {
  const intl = useIntl();
  const {
    walletId,
    indexedAccountId,
    networks,
    enabledNetworks,
    setNetworksState,
    searchKey,
    isCreatingEnabledAddresses,
    isCreatingMissingAddresses,
    setIsCreatingMissingAddresses,
  } = useContext(AllNetworksManagerContext);

  const {
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    run,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
    walletId: walletId ?? '',
    indexedAccountId,
    filterNetworksWithoutAccount: true,
  });

  const { createAddress } = useAccountSelectorCreateAddress();

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

  const handleCreateMissingAddresses = useCallback(async () => {
    setIsCreatingMissingAddresses(true);

    const enabledNetworksWithoutAccountTemp = await Promise.all(
      enabledNetworksWithoutAccount.map(async (network) => ({
        networkId: network.id,
        deriveType:
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network.id,
          }),
      })),
    );

    try {
      await createAddress({
        num: 0,
        account: {
          walletId,
          indexedAccountId,
          networkId: getNetworkIdsMap().onekeyall,
          deriveType: 'default',
        },
        customNetworks: enabledNetworksWithoutAccountTemp,
      });
    } catch (_error) {
      setIsCreatingMissingAddresses(false);
      return;
    }

    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.swap_page_toast_address_generated,
      }),
    });
    void run();
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    setIsCreatingMissingAddresses(false);
  }, [
    createAddress,
    enabledNetworksWithoutAccount,
    indexedAccountId,
    intl,
    run,
    setIsCreatingMissingAddresses,
    walletId,
  ]);

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
      {enabledNetworksWithoutAccount.length > 0 ? (
        <Stack px="$5" pb="$5">
          <Alert
            type="warning"
            title={intl.formatMessage(
              {
                id: ETranslations.network_enabled_but_no_address_notice,
              },
              {
                count: enabledNetworksCompatibleWithWalletId.length,
              },
            )}
            action={{
              primary: intl.formatMessage({
                id: isCreatingMissingAddresses
                  ? ETranslations.global_creating_address
                  : ETranslations.global_create,
              }),
              isPrimaryLoading: isCreatingMissingAddresses,
              isPrimaryDisabled:
                isCreatingMissingAddresses || isCreatingEnabledAddresses,
              onPrimaryPress: handleCreateMissingAddresses,
            }}
          />
        </Stack>
      ) : null}
      {searchKey?.trim() ? null : (
        <XStack
          px="$5"
          py="$2"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack flex={1} mr="$2">
            <ChainSelectorTooltip
              renderContent={intl.formatMessage({
                id: ETranslations.network_selection_performance_tip,
              })}
              renderTrigger={
                <Stack alignSelf="flex-start">
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
