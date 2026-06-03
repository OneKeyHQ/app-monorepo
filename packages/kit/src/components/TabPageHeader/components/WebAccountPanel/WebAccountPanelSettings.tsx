import { useCallback, useMemo, useState } from 'react';

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
import { useLanguageSelector } from '@onekeyhq/kit/src/views/Setting/hooks';
import {
  usePerpsCustomSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
    </YStack>
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
