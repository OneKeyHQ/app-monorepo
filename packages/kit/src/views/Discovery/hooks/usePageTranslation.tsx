import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Popover,
  SegmentControl,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useWebViewTranslate } from '@onekeyhq/kit/src/components/WebView/useWebViewTranslate';
import { useTranslateSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations, LOCALES_OPTION } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ETranslateDisplayMode, ETranslateEngine } from '../types';

import { useWebTabDataById } from './useWebTabs';

function TranslateSettings() {
  const intl = useIntl();
  const [settings, setSettings] = useTranslateSettingsPersistAtom();

  const updateSetting = useCallback(
    <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setSettings],
  );

  const isCustomMode = settings.targetLanguage !== 'auto';

  const customLanguageOptions = useMemo(
    () =>
      LOCALES_OPTION.filter(
        (o) => o.value !== 'system' && o.value !== 'en-US',
      ).map((o) => ({ label: o.label, value: o.value })),
    [],
  );

  const engineOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.browser_translate_engine_ai,
        }),
        value: ETranslateEngine.ai,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.browser_translate_engine_traditional,
        }),
        value: ETranslateEngine.standard,
      },
    ],
    [intl],
  );

  const targetLanguageOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.browser_translate_lang_auto,
        }),
        value: 'auto' as string,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.browser_translate_lang_custom,
        }),
        value: 'custom' as string,
      },
    ],
    [intl],
  );

  const displayModeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.browser_translate_mode_bilingual,
        }),
        value: ETranslateDisplayMode.bilingual,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.browser_translate_mode_replace,
        }),
        value: ETranslateDisplayMode.replace,
      },
    ],
    [intl],
  );

  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.browser_translate_engine,
          })}
        </SizableText>
        <SegmentControl
          fullWidth
          value={settings.engine}
          options={engineOptions}
          onChange={(v) => updateSetting('engine', v as ETranslateEngine)}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.browser_translate_target_language,
          })}
        </SizableText>
        <SegmentControl
          fullWidth
          value={isCustomMode ? 'custom' : 'auto'}
          options={targetLanguageOptions}
          onChange={(v) => {
            if (v === 'auto') {
              updateSetting('targetLanguage', 'auto');
            } else {
              updateSetting('targetLanguage', intl.locale);
            }
          }}
        />
        {isCustomMode ? (
          <Select
            title={intl.formatMessage({
              id: ETranslations.browser_translate_target_language,
            })}
            items={customLanguageOptions}
            value={settings.targetLanguage}
            onChange={(v) => updateSetting('targetLanguage', v)}
          />
        ) : null}
      </YStack>
      <YStack gap="$2">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.browser_translate_display_mode,
          })}
        </SizableText>
        <SegmentControl
          fullWidth
          value={settings.displayMode}
          options={displayModeOptions}
          onChange={(v) =>
            updateSetting('displayMode', v as ETranslateDisplayMode)
          }
        />
      </YStack>
    </YStack>
  );
}

function useResolvedTargetLang() {
  const intl = useIntl();
  const [settings] = useTranslateSettingsPersistAtom();
  return settings.targetLanguage === 'auto'
    ? intl.locale
    : settings.targetLanguage;
}

function useTargetLanguageLabel() {
  const resolvedLang = useResolvedTargetLang();
  return (
    LOCALES_OPTION.find((o) => o.value === resolvedLang)?.label ?? resolvedLang
  );
}

export function TranslatePopoverContent({
  isTranslated,
  onTranslate,
  closePopover,
}: {
  isTranslated: boolean;
  onTranslate: () => void;
  closePopover: () => void;
}) {
  const intl = useIntl();
  const [showSettings, setShowSettings] = useState(false);
  const targetLanguageLabel = useTargetLanguageLabel();

  const handleAction = useCallback(() => {
    onTranslate();
    closePopover();
  }, [onTranslate, closePopover]);

  if (showSettings) {
    return (
      <YStack
        gap="$5"
        px="$5"
        pb="$5"
        pt={platformEnv.isDesktop ? '$5' : undefined}
      >
        <Button
          variant="tertiary"
          size="small"
          icon="ChevronLeftOutline"
          alignSelf="flex-start"
          onPress={() => setShowSettings(false)}
        >
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_btn_back,
          })}
        </Button>
        <TranslateSettings />
      </YStack>
    );
  }

  return (
    <YStack gap="$5" p="$5">
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.browser_translate_to,
          })}
          {': '}
          {targetLanguageLabel}
        </SizableText>
        <IconButton
          icon="SettingsOutline"
          variant="tertiary"
          size="small"
          onPress={() => setShowSettings(true)}
        />
      </XStack>
      <Button variant="primary" size="medium" onPress={handleAction}>
        {intl.formatMessage({
          id: isTranslated
            ? ETranslations.browser_restore_original
            : ETranslations.browser_translate_start,
        })}
      </Button>
    </YStack>
  );
}

export function TranslatePopoverTrigger({
  isTranslated,
  onTranslate,
  placement = 'top',
}: {
  isTranslated: boolean;
  onTranslate: () => void;
  placement?: 'top' | 'bottom-end';
}) {
  const intl = useIntl();
  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.browser_translate_settings_title,
      })}
      placement={placement}
      renderTrigger={
        <IconButton
          variant="tertiary"
          size="medium"
          icon={isTranslated ? 'TranslateSolid' : 'TranslateOutline'}
          testID="browser-bar-translate"
        />
      }
      renderContent={({ closePopover }) => (
        <TranslatePopoverContent
          isTranslated={isTranslated}
          onTranslate={onTranslate}
          closePopover={closePopover}
        />
      )}
    />
  );
}

export function usePageTranslation(tabId: string) {
  const [settings] = useTranslateSettingsPersistAtom();
  const [isTranslated, setIsTranslated] = useState(false);
  const resolvedTargetLang = useResolvedTargetLang();
  const { tab } = useWebTabDataById(tabId);

  const onNavigate = useCallback(() => {
    setIsTranslated(false);
  }, []);

  const { toggleTranslate, translatingRef } = useWebViewTranslate(
    tabId,
    onNavigate,
    settings.engine,
    settings.displayMode,
    tab?.url,
  );

  const handleTranslate = useCallback(() => {
    const willTranslate = !translatingRef.current;
    toggleTranslate(resolvedTargetLang);
    setIsTranslated(willTranslate);

    defaultLogger.discovery.translation.dappTranslateToggle({
      action: willTranslate ? 'enable' : 'disable',
      engine: settings.engine,
      targetLang: resolvedTargetLang,
      displayMode: settings.displayMode,
      dappDomain: tab?.url ?? '',
    });
  }, [
    toggleTranslate,
    translatingRef,
    resolvedTargetLang,
    settings.engine,
    settings.displayMode,
    tab?.url,
  ]);

  return {
    isTranslated,
    handleTranslate,
  };
}
