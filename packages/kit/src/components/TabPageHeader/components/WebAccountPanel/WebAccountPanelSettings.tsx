import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  ESwitchSize,
  Icon,
  SegmentControl,
  Select,
  SizableText,
  Stack,
  Switch,
  Toast,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCurrencySections } from '@onekeyhq/kit/src/hooks/useCurrencySections';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useLanguageSelector } from '@onekeyhq/kit/src/views/Setting/hooks';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsCustomSettingsAtom,
  usePerpsSpotDustingAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';

import { WebAccountPanelListItem } from './atoms/WebAccountPanelListItem';
import { WebAccountPanelSectionTitle } from './atoms/WebAccountPanelSectionTitle';

// Nudge the dropdown 10px left of its bottom-end anchor, and 12px up from the
// default 8px gap (8 - 12 = -4, so it slightly overlaps toward the trigger).
const SELECT_OFFSET = { mainAxis: -4, crossAxis: -10 } as const;

const CLEAR_CACHE_BASE: IClearCacheOnAppState = {
  tokenAndNFT: false,
  transactionHistory: false,
  swapHistory: false,
  browserCache: false,
  appUpdateCache: false,
  browserHistory: false,
  connectSites: false,
  signatureRecord: false,
  customToken: false,
  customRpc: false,
  customNetworkFee: false,
  serverNetworks: false,
};

function ThemeRow() {
  const intl = useIntl();
  const [{ theme }] = useSettingsPersistAtom();
  const options = useMemo(
    () => [
      {
        label: (
          <Icon
            my="$0.5"
            name="LaptopOutline"
            size="$4"
            color={theme === 'system' ? '$iconInverse' : '$icon'}
          />
        ),
        value: 'system' as const,
      },
      {
        label: (
          <Icon
            my="$0.5"
            name="SunOutline"
            size="$4"
            color={theme === 'light' ? '$iconInverse' : '$icon'}
          />
        ),
        value: 'light' as const,
      },
      {
        label: (
          <Icon
            my="$0.5"
            name="MoonOutline"
            size="$4"
            color={theme === 'dark' ? '$iconInverse' : '$icon'}
          />
        ),
        value: 'dark' as const,
      },
    ],
    [theme],
  );
  const handleChange = useCallback(async (value: unknown) => {
    await backgroundApiProxy.serviceSetting.setTheme(
      value as 'light' | 'dark' | 'system',
    );
  }, []);

  return (
    <WebAccountPanelListItem
      renderLeft={intl.formatMessage({ id: ETranslations.settings_theme })}
      renderRight={
        <SegmentControl
          options={options}
          value={theme}
          onChange={handleChange}
          segmentControlItemStyleProps={{ px: '$2.5', py: '$1' }}
          h={26}
        />
      }
    />
  );
}

// Shared dropdown chrome for the Language / Default currency rows — identical
// across both, so kept in one place.
const SELECT_FLOATING_PANEL_PROPS = { maxHeight: 280 };
const SELECT_SHEET_PROPS = {
  disableDrag: true,
  snapPoints: [80],
  snapPointsMode: 'percent' as const,
};

// Transparent full-panel overlay that dismisses an open dropdown on press.
// The nested Select popover doesn't fire outside-press dismiss while inside the
// panel popover (floating-ui treats it as a child of the panel's floating tree,
// so a click on the panel isn't "outside"). This catches those clicks and closes
// the Select via its controlled state. It lives inside the panel content, so it
// sits below the dropdown's higher overlay portal — the dropdown options stay
// clickable — while covering the panel rows beneath it.
function SelectDismissOverlay({ onPress }: { onPress: () => void }) {
  return (
    <Stack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={50}
      onPress={onPress}
    />
  );
}

function renderSettingsSelectTrigger(title: string, label: string) {
  return (
    <WebAccountPanelListItem
      renderLeft={title}
      renderRight={
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {label}
          </SizableText>
          <Icon
            name="ChevronDownSmallOutline"
            size="$4.5"
            color="$iconSubdued"
          />
        </XStack>
      }
    />
  );
}

function LanguageRow() {
  const intl = useIntl();
  const { options, value, onChange } = useLanguageSelector();
  const [open, setOpen] = useState(false);
  const label = useMemo(
    () => options.find((i) => i.value === value)?.label ?? '',
    [options, value],
  );
  // The Select fires onChange even when re-picking the current option;
  // useLanguageSelector.onChange always relaunches, so skip it when unchanged.
  const handleChange = useCallback(
    (next: string) => {
      if (next === value) {
        return;
      }
      void onChange(next);
    },
    [onChange, value],
  );
  const title = intl.formatMessage({ id: ETranslations.global_language });
  return (
    <>
      {open ? <SelectDismissOverlay onPress={() => setOpen(false)} /> : null}
      <Select
        testID="web-account-panel-settings-language"
        title={title}
        items={options}
        value={value}
        open={open}
        onChange={handleChange}
        onOpenChange={setOpen}
        floatingPanelProps={SELECT_FLOATING_PANEL_PROPS}
        sheetProps={SELECT_SHEET_PROPS}
        placement="bottom-end"
        offset={SELECT_OFFSET}
        renderTrigger={() => renderSettingsSelectTrigger(title, label)}
      />
    </>
  );
}

function CurrencyRow() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const sections = useCurrencySections();
  const [open, setOpen] = useState(false);
  const formatSections = useMemo(
    () =>
      sections.map((i) => ({
        title: i.title,
        data: i.data.map((item) => ({
          value: item.id,
          label: `${item.id.toUpperCase()} - ${item.unit}`,
        })),
      })),
    [sections],
  );
  const title = intl.formatMessage({
    id: ETranslations.settings_default_currency,
  });
  const handleChange = useCallback(
    async (currencyId: string) => {
      // The Select fires onChange even when re-picking the current option; skip
      // the setCurrency + app restart when nothing actually changed.
      if (!currencyId || currencyId === settings.currencyInfo.id) {
        return;
      }
      for (let i = 0; i < sections.length; i += 1) {
        const item = sections[i].data.find((idx) => idx.id === currencyId);
        if (item) {
          await backgroundApiProxy.serviceSetting.setCurrency({
            id: item.id,
            symbol: item.unit,
          });
          setTimeout(() => {
            void backgroundApiProxy.serviceApp.restartApp();
          });
          return;
        }
      }
    },
    [sections, settings.currencyInfo.id],
  );
  return (
    <>
      {open ? <SelectDismissOverlay onPress={() => setOpen(false)} /> : null}
      <Select
        testID="web-account-panel-settings-currency"
        title={title}
        sections={formatSections}
        value={settings.currencyInfo.id}
        open={open}
        onChange={handleChange}
        onOpenChange={setOpen}
        floatingPanelProps={SELECT_FLOATING_PANEL_PROPS}
        sheetProps={SELECT_SHEET_PROPS}
        placement="bottom-end"
        offset={SELECT_OFFSET}
        renderTrigger={() =>
          renderSettingsSelectTrigger(
            title,
            settings.currencyInfo.id.toUpperCase(),
          )
        }
      />
    </>
  );
}

function PerpsSwitchSection() {
  const intl = useIntl();
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  return (
    <YStack w="100%">
      <WebAccountPanelSectionTitle>
        {intl.formatMessage({ id: ETranslations.global_perp })}
      </WebAccountPanelSectionTitle>
      <WebAccountPanelListItem
        renderLeft={
          <XStack ai="center" gap="$2">
            <SizableText size="$bodyMd" color="$text">
              {intl.formatMessage({ id: ETranslations.perp_setting_title })}
            </SizableText>
            <Tooltip
              renderContent={intl.formatMessage({
                id: ETranslations.perp_setting_desc,
              })}
              renderTrigger={
                <Icon
                  name="QuestionmarkOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              }
            />
          </XStack>
        }
        renderRight={
          <Switch
            testID="web-account-panel-settings-skip-order-confirm"
            size={ESwitchSize.small}
            value={perpsCustomSettings.skipOrderConfirm}
            onChange={(value) => {
              setPerpsCustomSettings((prev) => ({
                ...prev,
                skipOrderConfirm: value,
              }));
            }}
          />
        }
      />
      <WebAccountPanelListItem
        renderLeft={intl.formatMessage({
          id: ETranslations.perps_settings_shows_buy_sell_title,
        })}
        renderRight={
          <Switch
            testID="web-account-panel-settings-show-trade-marks"
            size={ESwitchSize.small}
            value={perpsCustomSettings.showTradeMarks ?? true}
            onChange={(value) => {
              setPerpsCustomSettings((prev) => ({
                ...prev,
                showTradeMarks: value,
              }));
            }}
          />
        }
      />
      <WebAccountPanelListItem
        renderLeft={intl.formatMessage({
          id: ETranslations.perps_settings_shows_positions_title,
        })}
        renderRight={
          <Switch
            testID="web-account-panel-settings-show-chart-lines"
            size={ESwitchSize.small}
            value={perpsCustomSettings.showChartLines ?? true}
            onChange={(value) => {
              setPerpsCustomSettings((prev) => ({
                ...prev,
                showChartLines: value,
              }));
            }}
          />
        }
      />
      {/* eslint-disable-next-line @typescript-eslint/no-use-before-define */}
      <WebPerpsSpotDustingSetting />
    </YStack>
  );
}

function WebPerpsSpotDustingSetting() {
  const intl = useIntl();
  const {
    activeAccount: { account, indexedAccount, wallet },
  } = useActiveAccount({ num: 0 });
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [activeAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [spotDusting] = usePerpsSpotDustingAtom();
  const [pendingStatus, setPendingStatus] = useState<
    | {
        accountAddress: string;
        enabled: boolean;
      }
    | undefined
  >();

  const activeAccountAddress = activeAccount.accountAddress?.toLowerCase();
  const activeAccountAddressRef = useRef(activeAccountAddress);
  activeAccountAddressRef.current = activeAccountAddress;
  const panelAccountId = account?.id ?? indexedAccount?.id;
  const activePerpsAccountId =
    activeAccount.accountId ?? activeAccount.indexedAccountId;
  const isPerpsAccountAligned =
    Boolean(panelAccountId) && activePerpsAccountId === panelAccountId;

  const statusMatchesActiveAccount =
    Boolean(activeAccountAddress) &&
    spotDusting?.accountAddress?.toLowerCase() === activeAccountAddress;
  const serverEnabled = statusMatchesActiveAccount
    ? spotDusting?.optOut !== true
    : false;
  const pendingEnabled =
    pendingStatus && pendingStatus.accountAddress === activeAccountAddress
      ? pendingStatus.enabled
      : undefined;
  const enabled = pendingEnabled ?? serverEnabled;
  const canToggle =
    activeAccountStatus.canTrade === true &&
    isPerpsAccountAligned &&
    statusMatchesActiveAccount &&
    pendingEnabled === undefined;

  useEffect(() => {
    setPendingStatus((prev) =>
      prev?.accountAddress === activeAccountAddress ? prev : undefined,
    );
  }, [activeAccountAddress]);

  const ensureActivePerpsAccount = useCallback(async () => {
    if (!panelAccountId) {
      return;
    }
    if (activePerpsAccountId === panelAccountId && activeAccountAddress) {
      return;
    }
    const deriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    await backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount({
      indexedAccountId: indexedAccount?.id ?? null,
      accountId: account?.id ?? null,
      walletId: wallet?.id ?? null,
      deriveType,
    });
  }, [
    account?.id,
    activeAccountAddress,
    activePerpsAccountId,
    indexedAccount?.id,
    panelAccountId,
    wallet?.id,
  ]);

  useEffect(() => {
    if (!panelAccountId || isPerpsAccountAligned) {
      return;
    }
    void ensureActivePerpsAccount();
  }, [ensureActivePerpsAccount, isPerpsAccountAligned, panelAccountId]);

  const copy = useMemo(
    () => ({
      title: intl.formatMessage({
        id: ETranslations.perp_spot_dusting__title,
      }),
      loadingSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_loading__desc,
      }),
      disabledSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_enable_trading_required__desc,
      }),
      enabledSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_on__desc,
      }),
      disabledStateSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_off__desc,
      }),
      loadingToast: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_loading__msg,
      }),
      disabledToast: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_enable_trading_required__msg,
      }),
      enabling: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turning_on__msg,
      }),
      disabling: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turning_off__msg,
      }),
      enabled: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turned_on__msg,
      }),
      disabled: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turned_off__msg,
      }),
      failed: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_update_failed__msg,
      }),
    }),
    [intl],
  );

  const subtitle = useMemo(() => {
    if (!statusMatchesActiveAccount) {
      return copy.loadingSubtitle;
    }
    if (activeAccountStatus.canTrade !== true) {
      return copy.disabledSubtitle;
    }
    return enabled ? copy.enabledSubtitle : copy.disabledStateSubtitle;
  }, [
    activeAccountStatus.canTrade,
    copy.disabledStateSubtitle,
    copy.disabledSubtitle,
    copy.enabledSubtitle,
    copy.loadingSubtitle,
    enabled,
    statusMatchesActiveAccount,
  ]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      const requestAccountAddress = activeAccountAddressRef.current;
      if (!requestAccountAddress) {
        return;
      }
      if (!statusMatchesActiveAccount) {
        Toast.error({ title: copy.loadingToast });
        return;
      }
      if (activeAccountStatus.canTrade !== true) {
        Toast.error({ title: copy.disabledToast });
        return;
      }
      await ensureActivePerpsAccount();

      setPendingStatus({
        accountAddress: requestAccountAddress,
        enabled: value,
      });
      const loadingToast = Toast.loading({
        title: value ? copy.enabling : copy.disabling,
        duration: Infinity,
      });
      try {
        await backgroundApiProxy.serviceHyperliquidExchange.setSpotDustingOptOut(
          { optOut: !value },
        );
        loadingToast?.close();
        if (activeAccountAddressRef.current === requestAccountAddress) {
          Toast.success({
            title: value ? copy.enabled : copy.disabled,
          });
        }
      } catch (error) {
        loadingToast?.close();
        if (activeAccountAddressRef.current === requestAccountAddress) {
          Toast.error({
            title: (error as Error)?.message || copy.failed,
          });
        }
      } finally {
        setPendingStatus((prev) =>
          prev?.accountAddress === requestAccountAddress ? undefined : prev,
        );
      }
    },
    [
      activeAccountStatus.canTrade,
      copy.disabledToast,
      copy.disabling,
      copy.disabled,
      copy.enabled,
      copy.enabling,
      ensureActivePerpsAccount,
      copy.failed,
      copy.loadingToast,
      statusMatchesActiveAccount,
    ],
  );

  return (
    <WebAccountPanelListItem
      renderLeft={
        <YStack gap="$1" ai="flex-start">
          <SizableText size="$bodyMd" color="$text">
            {copy.title}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {subtitle}
          </SizableText>
        </YStack>
      }
      renderRight={
        <Switch
          testID="web-account-panel-settings-spot-dusting"
          size={ESwitchSize.small}
          value={enabled}
          disabled={!canToggle}
          onChange={handleToggle}
        />
      }
      alignItems="flex-start"
      py="$2"
    />
  );
}

function DataSection({ onRequestClose }: { onRequestClose: () => void }) {
  const intl = useIntl();

  // Mirror the settings ClearAppCache "Swap history" option behind a destructive
  // confirm: clearCacheOnApp({ swapHistory }) → serviceSwap.cleanSwapHistoryItems().
  // Close the panel first, then surface the dialog.
  const handleClearSwapOrders = useCallback(() => {
    onRequestClose();
    setTimeout(() => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.settings_clear_swap_orders,
        }),
        description: intl.formatMessage({
          id: ETranslations.settings_clear_data_confirm,
        }),
        tone: 'destructive',
        onConfirmText: intl.formatMessage({ id: ETranslations.global_clear }),
        onConfirm: async () => {
          await backgroundApiProxy.serviceSetting.clearCacheOnApp({
            ...CLEAR_CACHE_BASE,
            swapHistory: true,
          });
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        },
      });
    }, 150);
  }, [intl, onRequestClose]);

  // Mirror the settings ClearPendingTransactionsListItem: a destructive confirm →
  // serviceSetting.clearPendingTransaction() (clears local pending history +
  // cancels pending/canceling swaps) → emit the same event so open views refresh.
  // Close the panel first, then surface the dialog.
  const handleClearPendingTransactions = useCallback(() => {
    onRequestClose();
    setTimeout(() => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.settings_clear_pending_transactions,
        }),
        description: intl.formatMessage({
          id: ETranslations.settings_clear_data_confirm,
        }),
        tone: 'destructive',
        onConfirmText: intl.formatMessage({ id: ETranslations.global_clear }),
        onConfirm: async () => {
          await backgroundApiProxy.serviceSetting.clearPendingTransaction();
          appEventBus.emit(
            EAppEventBusNames.ClearLocalHistoryPendingTxs,
            undefined,
          );
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        },
      });
    }, 150);
  }, [intl, onRequestClose]);

  return (
    <YStack w="100%">
      <WebAccountPanelSectionTitle>
        {intl.formatMessage({ id: ETranslations.settings_data })}
      </WebAccountPanelSectionTitle>
      <WebAccountPanelListItem
        renderLeft={intl.formatMessage({
          id: ETranslations.settings_clear_swap_orders,
        })}
        onPress={handleClearSwapOrders}
      />
      <WebAccountPanelListItem
        renderLeft={intl.formatMessage({
          id: ETranslations.settings_clear_pending_transactions,
        })}
        onPress={handleClearPendingTransactions}
      />
    </YStack>
  );
}

export function WebAccountPanelSettings({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleOpenFullSettings = useCallback(() => {
    onRequestClose();
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation, onRequestClose]);
  return (
    <YStack w="100%">
      <YStack py="$5" w="100%">
        <MultipleClickStack onPress={handleOpenFullSettings}>
          <WebAccountPanelSectionTitle>
            {intl.formatMessage({ id: ETranslations.global_general })}
          </WebAccountPanelSectionTitle>
        </MultipleClickStack>
        <ThemeRow />
        <LanguageRow />
        <CurrencyRow />
      </YStack>
      <Divider borderColor="$neutral3" />
      <YStack py="$5" w="100%">
        <PerpsSwitchSection />
      </YStack>
      <Divider borderColor="$neutral3" />
      <YStack py="$5" w="100%">
        <DataSection onRequestClose={onRequestClose} />
      </YStack>
    </YStack>
  );
}
