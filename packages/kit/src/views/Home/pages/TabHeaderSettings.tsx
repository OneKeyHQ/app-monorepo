import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  ESwitchSize,
  IconButton,
  Popover,
  SizableText,
  Stack,
  Switch,
  XStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsDeFiEnabled } from '@onekeyhq/kit/src/hooks/useIsDeFiEnabled';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  DustSweepEntryCapabilitiesProvider,
  useActiveAccountDustSweep,
} from '@onekeyhq/kit/src/views/DustSweep/hooks/useNavigateToDustSweep';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
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

function TokenListSettings({
  flushCircle = false,
}: {
  // Wide desktop: drop the tertiary overhang so the circle ends at the page
  // edge, on one line with "More" in the balance row and the rows' swap.
  flushCircle?: boolean;
}) {
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveType,
      vaultSettings,
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
    vaultSettings,
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
          aria-label={intl.formatMessage({
            id: ETranslations.global_filter,
          })}
          variant="tertiary"
          icon="SliderHorOutline"
          bg={showLpTokensOnly ? '$bgStrong' : 'transparent'}
          {...(flushCircle ? { mx: '$0' } : undefined)}
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

    navigation.pushModal(EModalRoutes.BulkExportHistoryModal, {
      screen: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
      params: {
        networkId,
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

// Wide desktop / web: Dust sweep is a quiet text button in the Spot tab row
// (38 high like the filter, no fill until hovered) instead of a pill in the
// token title row, so it reads as an action rather than another tab.
function TokenListDustSweepTabAction() {
  const intl = useIntl();
  const { canDustSweep, openDustSweep } = useActiveAccountDustSweep();
  const handlePress = useCallback(() => {
    void openDustSweep('tokenListHeader');
  }, [openDustSweep]);
  if (!canDustSweep) {
    return null;
  }
  return (
    <>
      <Button
        testID="token-list-header-dust-sweep"
        variant="tertiary"
        size="small"
        icon="BroomOutline"
        h={38}
        my="$0"
        mx="$0"
        py="$0"
        px={10}
        onPress={handlePress}
      >
        {intl.formatMessage({ id: ETranslations.out_title_dust_sweep })}
      </Button>
      {/* 6 + 1 + 7 before the filter button: the label ends on the balance
          row's last action label, and the line sits midway between the label
          and the filter glyph (10px into its button). x 0 undoes Separator's
          -0.5px shift. */}
      <Divider vertical h="$4" x={0} ml={6} mr={7} />
    </>
  );
}

function TokenListTabActions() {
  const { gtMd } = useMedia();
  const isRouteFocused = useRouteIsFocused();
  if (platformEnv.isNative || !gtMd) {
    return <TokenListSettings />;
  }
  return (
    <XStack alignItems="center">
      <DustSweepEntryCapabilitiesProvider isFocused={isRouteFocused}>
        <TokenListDustSweepTabAction />
      </DustSweepEntryCapabilitiesProvider>
      <TokenListSettings flushCircle />
    </XStack>
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
        return <TokenListTabActions />;
      case historyName:
        return <TxHistorySettings />;
      default:
        return null;
    }
  }, [portfolioName, focusedTab, historyName]);
  return <XStack pr="$pagePadding">{content}</XStack>;
}

export const TabHeaderSettings = memo(BasicTabHeaderSettings);
