import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  ESwitchSize,
  IconButton,
  Popover,
  SizableText,
  Stack,
  Switch,
  XStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsDeFiEnabled } from '@onekeyhq/kit/src/hooks/useIsDeFiEnabled';
import {
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isTokenSelectorDappTokenFilterSupportedNetwork } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';

import { ListItem } from '../../../components/ListItem';
import { useManageToken } from '../../../hooks/useManageToken';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function TokenListSettingsContent({
  handleOnManageToken,
  manageTokenEnabled,
  onLpTokenFilterChange,
  showLpTokenFilterSwitch,
  showLpTokensOnly,
}: {
  handleOnManageToken: () => void;
  manageTokenEnabled: boolean;
  onLpTokenFilterChange: (value: boolean) => void;
  showLpTokenFilterSwitch: boolean;
  showLpTokensOnly: boolean;
}) {
  const intl = useIntl();
  const { closePopover } = usePopoverContext();

  const handleManageTokenPress = useCallback(async () => {
    await closePopover?.();
    await timerUtils.wait(150);
    handleOnManageToken();
  }, [closePopover, handleOnManageToken]);

  return (
    <Stack py="$2">
      {showLpTokenFilterSwitch ? (
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.wallet_defi_tokens__action,
          })}
        >
          <Switch
            testID="home-defi-token-switch"
            size={ESwitchSize.small}
            value={showLpTokensOnly}
            onChange={onLpTokenFilterChange}
          />
        </ListItem>
      ) : null}
      {manageTokenEnabled ? (
        <ListItem
          testID="home-manage-token"
          title={intl.formatMessage({
            id: ETranslations.manage_token_title,
          })}
          onPress={handleManageTokenPress}
          disabled={showLpTokensOnly}
          drillIn
        />
      ) : null}
    </Stack>
  );
}

function TokenListSettings() {
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const isDeFiEnabled = useIsDeFiEnabled(network?.id);
  const showLpTokenFilterSwitch =
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network,
      isDeFiEnabled,
    });
  const showLpTokensOnly = showLpTokenFilterSwitch
    ? tokenSelectorFilter.homeShowLpTokensOnly
    : false;
  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });

  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      setTokenSelectorFilter((prev) => ({
        ...prev,
        homeShowLpTokensOnly: value,
      }));
    },
    [setTokenSelectorFilter],
  );

  if (!showLpTokenFilterSwitch && !manageTokenEnabled) {
    return null;
  }

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.global_filter })}
      renderTrigger={
        <IconButton
          testID="home-media-icon-btn"
          title={intl.formatMessage({
            id: ETranslations.global_filter,
          })}
          variant="tertiary"
          icon="SliderHorOutline"
          bg={showLpTokensOnly ? '$bgStrong' : 'transparent'}
        />
      }
      renderContent={
        <TokenListSettingsContent
          handleOnManageToken={handleOnManageToken}
          manageTokenEnabled={manageTokenEnabled}
          onLpTokenFilterChange={handleLpTokenFilterChange}
          showLpTokenFilterSwitch={showLpTokenFilterSwitch}
          showLpTokensOnly={showLpTokensOnly}
        />
      }
    />
  );
}
const filterScamHistorySupportedNetworkIds = new Set(
  getNetworkIdsSupportFilterScamHistory(),
);

function TxHistorySettingsContent({
  filterScamHistorySupported,
  networkName,
  isFilterScamHistoryEnabled,
  isFilterLowValueHistoryEnabled,
  onFilterScamHistoryChange,
  onFilterLowValueHistoryChange,
  exportHistoryDescription,
  exportHistoryTitle,
  isPrimeSubscriptionActive,
  networkId,
}: {
  filterScamHistorySupported: boolean;
  networkName: string;
  isFilterScamHistoryEnabled: boolean;
  isFilterLowValueHistoryEnabled: boolean;
  onFilterScamHistoryChange: (value: boolean) => void;
  onFilterLowValueHistoryChange: (value: boolean) => void;
  exportHistoryDescription: string;
  exportHistoryTitle: ReactNode;
  isPrimeSubscriptionActive: boolean;
  networkId: string | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { closePopover } = usePopoverContext();

  const handleExportHistoryPress = useCallback(async () => {
    defaultLogger.prime.subscription.primeEntryClick({
      featureName: EPrimeFeatures.HistoryExport,
      entryPoint: 'historySettings',
      isPrimeActive: isPrimeSubscriptionActive,
    });
    await closePopover?.();
    await timerUtils.wait(150);

    if (isPrimeSubscriptionActive) {
      navigation.pushModal(EModalRoutes.BulkExportHistoryModal, {
        screen: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
        params: {
          networkId,
        },
      });
      return;
    }

    navigation.pushFullModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        fromFeature: EPrimeFeatures.HistoryExport,
      },
    });
  }, [closePopover, isPrimeSubscriptionActive, navigation, networkId]);

  return (
    <Stack py="$2">
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.wallet_history_settings_hide_risk_transaction_title,
        })}
        subtitle={
          filterScamHistorySupported
            ? intl.formatMessage({
                id: ETranslations.wallet_history_settings_hide_risk_transaction_desc,
              })
            : intl.formatMessage(
                {
                  id: ETranslations.wallet_history_settings_hide_risk_transaction_desc_unsupported,
                },
                {
                  networkName,
                },
              )
        }
      >
        <Switch
          testID="home-switch"
          isUncontrolled
          disabled={!filterScamHistorySupported}
          size={ESwitchSize.small}
          onChange={onFilterScamHistoryChange}
          defaultChecked={
            filterScamHistorySupported ? isFilterScamHistoryEnabled : false
          }
        />
      </ListItem>
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.wallet_history_settings_hide_small_transaction_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.wallet_history_settings_hide_small_transaction_desc,
        })}
      >
        <Switch
          testID="home-switch"
          isUncontrolled
          size={ESwitchSize.small}
          onChange={onFilterLowValueHistoryChange}
          defaultChecked={isFilterLowValueHistoryEnabled}
        />
      </ListItem>
      <ListItem
        testID="home-export-transaction-history"
        onPress={handleExportHistoryPress}
        drillIn
      >
        <ListItem.Text
          flex={1}
          primary={exportHistoryTitle}
          secondary={exportHistoryDescription}
        />
      </ListItem>
    </Stack>
  );
}

function TxHistorySettings() {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();
  const { isPrimeSubscriptionActive } = useOneKeyAuth();
  const exportHistoryTitleText = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_export_transaction_history,
      }),
    [intl],
  );
  const exportHistoryDescription = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.export_transaction_history__desc,
      }),
    [intl],
  );
  const exportHistoryTitle = useMemo(
    () => (
      <XStack alignItems="center" gap="$2">
        <SizableText size="$bodyLgMedium">{exportHistoryTitleText}</SizableText>
        {isPrimeSubscriptionActive ? null : (
          <Badge badgeSize="sm" badgeType="default">
            <Badge.Text size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.prime_status_prime,
              })}
            </Badge.Text>
          </Badge>
        )}
      </XStack>
    ),
    [exportHistoryTitleText, intl, isPrimeSubscriptionActive],
  );

  const handleFilterScamHistoryOnChange = useCallback(
    (value: boolean) => {
      setSettings((v) => ({
        ...v,
        isFilterScamHistoryEnabled: !!value,
      }));
      appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
    },
    [setSettings],
  );

  const handleFilterLowValueHistoryOnChange = useCallback(
    (value: boolean) => {
      setSettings((v) => ({
        ...v,
        isFilterLowValueHistoryEnabled: !!value,
      }));
      appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
    },
    [setSettings],
  );

  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const filterScamHistorySupported = useMemo(
    () =>
      network?.isAllNetworks ||
      filterScamHistorySupportedNetworkIds.has(network?.id ?? ''),
    [network],
  );

  return (
    <Stack>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_filter })}
        renderTrigger={
          <IconButton
            testID="home-filter-scam-history-supported-icon-btn"
            title={intl.formatMessage({
              id: ETranslations.global_filter,
            })}
            variant="tertiary"
            icon="SliderHorOutline"
          />
        }
        renderContent={
          <TxHistorySettingsContent
            filterScamHistorySupported={!!filterScamHistorySupported}
            networkName={network?.name ?? ''}
            isFilterScamHistoryEnabled={!!settings.isFilterScamHistoryEnabled}
            isFilterLowValueHistoryEnabled={
              !!settings.isFilterLowValueHistoryEnabled
            }
            onFilterScamHistoryChange={handleFilterScamHistoryOnChange}
            onFilterLowValueHistoryChange={handleFilterLowValueHistoryOnChange}
            exportHistoryDescription={exportHistoryDescription}
            exportHistoryTitle={exportHistoryTitle}
            isPrimeSubscriptionActive={!!isPrimeSubscriptionActive}
            networkId={network?.id}
          />
        }
      />
    </Stack>
  );
}

function BasicTabHeaderSettings({ focusedTab }: { focusedTab: string }) {
  const intl = useIntl();
  const historyName = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_history,
      }),
    [intl],
  );
  const portfolioName = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.dexmarket_spot,
      }),
    [intl],
  );

  const content = useMemo(() => {
    switch (focusedTab) {
      case portfolioName:
        return <TokenListSettings />;
      case historyName:
        return <TxHistorySettings />;
      default:
        return null;
    }
  }, [portfolioName, focusedTab, historyName]);
  return <XStack pr="$pagePadding">{content}</XStack>;
}

export const TabHeaderSettings = memo(BasicTabHeaderSettings);
