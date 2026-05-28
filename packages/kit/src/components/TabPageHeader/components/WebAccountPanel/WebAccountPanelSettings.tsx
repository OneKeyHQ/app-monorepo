import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  ESwitchSize,
  Icon,
  SegmentControl,
  Select,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrencySections } from '@onekeyhq/kit/src/hooks/useCurrencySections';
import { useLanguageSelector } from '@onekeyhq/kit/src/views/Setting/hooks';
import { PerpsAccountSelectorProviderMirror } from '@onekeyhq/kit/src/views/Perp/PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '@onekeyhq/kit/src/views/Perp/PerpsProviderMirror';
import {
  usePerpsCustomSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';

import { WebAccountPanelListItem } from './atoms/WebAccountPanelListItem';
import { WebAccountPanelSectionTitle } from './atoms/WebAccountPanelSectionTitle';

// TODO(i18n): once Lokalise has these keys, replace the hardcoded fallbacks:
//   - `settings.data` (section title)
//   - `settings.clear_pending_transactions`
const dataSectionLabel = 'Data';
const clearPendingTransactionsLabel = 'Clear pending transactions';

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
        />
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
  const title = intl.formatMessage({ id: ETranslations.global_language });
  return (
    <Select
      testID="web-account-panel-settings-language"
      title={title}
      items={options}
      value={value}
      open={open}
      onChange={onChange}
      onOpenChange={setOpen}
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{
        disableDrag: true,
        snapPoints: [80],
        snapPointsMode: 'percent',
      }}
      placement="bottom-end"
      renderTrigger={() => (
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
      )}
    />
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
      if (!currencyId) return;
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
    [sections],
  );
  return (
    <Select
      testID="web-account-panel-settings-currency"
      title={title}
      sections={formatSections}
      value={settings.currencyInfo.id}
      open={open}
      onChange={handleChange}
      onOpenChange={setOpen}
      floatingPanelProps={{ maxHeight: 280 }}
      sheetProps={{
        disableDrag: true,
        snapPoints: [80],
        snapPointsMode: 'percent',
      }}
      placement="bottom-end"
      renderTrigger={() => (
        <WebAccountPanelListItem
          renderLeft={title}
          renderRight={
            <XStack ai="center" gap="$1">
              <SizableText size="$bodyMd" color="$textSubdued">
                {settings.currencyInfo.id.toUpperCase()}
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                size="$4.5"
                color="$iconSubdued"
              />
            </XStack>
          }
        />
      )}
    />
  );
}

function PerpsSwitchSectionInner() {
  const intl = useIntl();
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  return (
    <YStack w="100%">
      <WebAccountPanelSectionTitle>
        {intl.formatMessage({ id: ETranslations.global_perp })}
      </WebAccountPanelSectionTitle>
      <WebAccountPanelListItem
        renderLeft={intl.formatMessage({
          id: ETranslations.perp_setting_title,
        })}
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

function PerpsSwitchSection() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <PerpsSwitchSectionInner />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

function DataSection() {
  const intl = useIntl();

  const handleClearSwapOrders = useCallback(async () => {
    await backgroundApiProxy.serviceSetting.clearCacheOnApp({
      ...CLEAR_CACHE_BASE,
      swapHistory: true,
    });
    Toast.success({
      title: intl.formatMessage({ id: ETranslations.global_success }),
    });
  }, [intl]);

  const handleClearPendingTransactions = useCallback(async () => {
    await backgroundApiProxy.serviceSetting.clearCacheOnApp({
      ...CLEAR_CACHE_BASE,
      transactionHistory: true,
    });
    Toast.success({
      title: intl.formatMessage({ id: ETranslations.global_success }),
    });
  }, [intl]);

  return (
    <YStack w="100%">
      <WebAccountPanelSectionTitle>
        {dataSectionLabel}
      </WebAccountPanelSectionTitle>
      <WebAccountPanelListItem
        renderLeft={intl.formatMessage({
          id: ETranslations.settings_swap_history,
        })}
        onPress={handleClearSwapOrders}
      />
      <WebAccountPanelListItem
        renderLeft={clearPendingTransactionsLabel}
        onPress={handleClearPendingTransactions}
      />
    </YStack>
  );
}

export function WebAccountPanelSettings() {
  const intl = useIntl();
  return (
    <YStack w="100%">
      <YStack py="$5" w="100%">
        <WebAccountPanelSectionTitle>
          {intl.formatMessage({ id: ETranslations.global_general })}
        </WebAccountPanelSectionTitle>
        <ThemeRow />
        <LanguageRow />
        <CurrencyRow />
      </YStack>
      <Divider />
      <YStack py="$5" w="100%">
        <PerpsSwitchSection />
      </YStack>
      <Divider />
      <YStack py="$5" w="100%">
        <DataSection />
      </YStack>
    </YStack>
  );
}
