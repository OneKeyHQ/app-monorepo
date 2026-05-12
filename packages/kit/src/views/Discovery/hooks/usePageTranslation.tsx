import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  IconButton,
  Popover,
  SegmentControl,
  Select,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useWebViewTranslate } from '@onekeyhq/kit/src/components/WebView/useWebViewTranslate';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { DiscoveryTestIDs } from '@onekeyhq/kit/src/views/Discovery/testIDs';
import { useTranslateSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
// import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations, LOCALES_OPTION } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ETranslateDisplayMode, ETranslateEngine } from '../types';

import { useActiveTabId, useWebTabDataById } from './useWebTabs';

function TranslateSettings({
  onTestAITranslateError: _onTestAITranslateError,
}: {
  onTestAITranslateError?: (testFlag: string) => void;
}) {
  const intl = useIntl();
  const [settings, setSettings] = useTranslateSettingsPersistAtom();
  // const [devSettings] = useDevSettingsPersistAtom();

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
              const hasLocaleOption = customLanguageOptions.some(
                (o) => o.value === intl.locale,
              );
              updateSetting(
                'targetLanguage',
                hasLocaleOption
                  ? intl.locale
                  : (customLanguageOptions[0]?.value ?? intl.locale),
              );
            }
          }}
        />
        {isCustomMode ? (
          <Select
            testID="discovery-select"
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
      {/* {devSettings.enabled && onTestAITranslateError ? (
        <YStack gap="$2">
          <SizableText size="$headingSm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_test,
            })}
          </SizableText>
          <XStack gap="$2">
            <Button
              flex={1}
              size="small"
              variant="secondary"
              onPress={() => onTestAITranslateError('limit')}
            >
              90104 Rate limit
            </Button>
            <Button
              flex={1}
              size="small"
              variant="secondary"
              onPress={() => onTestAITranslateError('error')}
            >
              90105 Service error
            </Button>
          </XStack>
        </YStack>
      ) : null} */}
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
  onRetranslate,
  onTestAITranslateError,
  closePopover,
  showSettings,
  onShowSettingsChange,
}: {
  isTranslated: boolean;
  onTranslate: () => void;
  onRetranslate?: () => void;
  onTestAITranslateError?: (testFlag: string) => void;
  closePopover: () => void;
  showSettings: boolean;
  onShowSettingsChange: (show: boolean) => void;
}) {
  const intl = useIntl();
  const { user } = useOneKeyAuth();
  const navigation = useAppNavigation();
  const isPrimeUser = useMemo(
    () => !!(user?.primeSubscription?.isActive && user?.onekeyUserId),
    [user?.primeSubscription?.isActive, user?.onekeyUserId],
  );
  const themeVariant = useThemeVariant();
  const targetLanguageLabel = useTargetLanguageLabel();

  const handleAction = useCallback(async () => {
    if (!isTranslated && !isPrimeUser) {
      closePopover();
      await timerUtils.wait(150);
      defaultLogger.prime.subscription.primeEntryClick({
        featureName: EPrimeFeatures.DAppTranslate,
        entryPoint: 'browserTranslate',
      });
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
        params: {
          fromFeature: EPrimeFeatures.DAppTranslate,
        },
      });
      return;
    }
    onTranslate();
    closePopover();
  }, [onTranslate, closePopover, isTranslated, isPrimeUser, navigation]);

  const handleRetranslatePress = useCallback(() => {
    onRetranslate?.();
    closePopover();
  }, [onRetranslate, closePopover]);

  const handleTestAITranslateError = useCallback(
    (testFlag: string) => {
      onTestAITranslateError?.(testFlag);
      closePopover();
    },
    [closePopover, onTestAITranslateError],
  );

  if (showSettings) {
    return (
      <YStack
        gap="$5"
        px="$5"
        pb="$5"
        pt={platformEnv.isDesktop ? '$5' : undefined}
      >
        <Button
          testID="discovery-handle-action-btn"
          variant="tertiary"
          size="small"
          icon="ChevronLeftOutline"
          alignSelf="flex-start"
          onPress={() => onShowSettingsChange(false)}
        >
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_btn_back,
          })}
        </Button>
        <TranslateSettings
          onTestAITranslateError={handleTestAITranslateError}
        />
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
          testID="discovery-icon-btn"
          icon="SettingsOutline"
          variant="tertiary"
          size="small"
          onPress={() => onShowSettingsChange(true)}
        />
      </XStack>
      <Stack overflow="visible">
        <XStack gap="$2" alignItems="center">
          <Button
            flex={1}
            variant="primary"
            size="medium"
            onPress={handleAction}
            testID="discovery-btn"
          >
            {intl.formatMessage({
              id: isTranslated
                ? ETranslations.browser_restore_original
                : ETranslations.browser_translate_start,
            })}
          </Button>
          {isTranslated && onRetranslate ? (
            <IconButton
              testID={DiscoveryTestIDs.pageTranslationRetryBtn}
              icon="RotateClockwiseOutline"
              variant="secondary"
              size="medium"
              onPress={handleRetranslatePress}
              title={intl.formatMessage({ id: ETranslations.global_retry })}
            />
          ) : null}
        </XStack>
        {!isTranslated && !isPrimeUser ? (
          <Stack position="absolute" right={-4} top={-8}>
            <Badge
              badgeSize="sm"
              badgeType="default"
              bg={themeVariant === 'light' ? '#F1F1F1' : '#3A3A3A'}
              borderRadius="$full"
              borderWidth="$px"
              borderColor="$bgApp"
            >
              <Badge.Text size="$bodySmMedium">
                {intl.formatMessage({
                  id: ETranslations.prime_status_prime,
                })}
              </Badge.Text>
            </Badge>
          </Stack>
        ) : null}
      </Stack>
    </YStack>
  );
}

export function TranslatePopoverTrigger({
  isTranslated,
  onTranslate,
  onRetranslate,
  onTestAITranslateError,
  placement = 'top',
  open,
  onOpenChange,
}: {
  isTranslated: boolean;
  onTranslate: () => void;
  onRetranslate?: () => void;
  onTestAITranslateError?: (testFlag: string) => void;
  placement?: 'top' | 'bottom-end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const intl = useIntl();
  const [showSettings, setShowSettings] = useState(false);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setShowSettings(false);
      }
      onOpenChange?.(isOpen);
    },
    [onOpenChange],
  );

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.browser_translate_settings_title,
      })}
      placement={placement}
      open={open}
      onOpenChange={handleOpenChange}
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
          onRetranslate={onRetranslate}
          onTestAITranslateError={onTestAITranslateError}
          closePopover={closePopover}
          showSettings={showSettings}
          onShowSettingsChange={setShowSettings}
        />
      )}
    />
  );
}

export function usePageTranslation(tabId: string) {
  const intl = useIntl();
  const [settings, setSettings] = useTranslateSettingsPersistAtom();
  const [isTranslated, setIsTranslated] = useState(false);
  const resolvedTargetLang = useResolvedTargetLang();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(tabId);
  const activeTabIdRef = useRef(activeTabId);
  const currentTabUrlRef = useRef(tab?.url);
  const pageContextVersionRef = useRef(0);
  activeTabIdRef.current = activeTabId;
  currentTabUrlRef.current = tab?.url;

  const onNavigate = useCallback((stillTranslating: boolean) => {
    pageContextVersionRef.current += 1;
    if (!stillTranslating) {
      setIsTranslated(false);
    }
  }, []);

  const { startTranslate, restoreOriginal, toggleTranslate, translatingRef } =
    useWebViewTranslate({
      tabId,
      onNavigate,
      engine: settings.engine,
      displayMode: settings.displayMode,
      dappUrl: tab?.url,
      currentTargetLang: resolvedTargetLang,
      onAITranslateUnavailable: ({ targetLang }) => {
        setIsTranslated(false);

        const failedPageUrl = tab?.url;
        const failedPageContextVersion = pageContextVersionRef.current;
        const toast = Toast.message({
          toastId: 'discovery-ai-translate-unavailable',
          duration: 10_000,
          title: intl.formatMessage({
            id: ETranslations.prime_ai_translate_unavailable_toast_title,
          }),
          message: intl.formatMessage({
            id: ETranslations.prime_ai_translate_unavailable_toast_desc,
          }),
          actionsAlign: 'left',
          actions: [
            <Button
              key="switch"
              testID={DiscoveryTestIDs.pageTranslationSwitchEngineBtn}
              variant="primary"
              size="small"
              onPressIn={() => {
                const isOriginalPageStillActive =
                  pageContextVersionRef.current === failedPageContextVersion &&
                  activeTabIdRef.current === tabId &&
                  currentTabUrlRef.current === failedPageUrl;

                void toast?.close();
                if (!isOriginalPageStillActive) {
                  return;
                }

                setSettings((prev) => ({
                  ...prev,
                  engine: ETranslateEngine.standard,
                }));
                startTranslate(targetLang, ETranslateEngine.standard);
                setIsTranslated(true);

                defaultLogger.discovery.translation.dappTranslateToggle({
                  action: 'enable',
                  engine: ETranslateEngine.standard,
                  targetLang,
                  displayMode: settings.displayMode,
                  dappDomain: tab?.url ?? '',
                });
              }}
            >
              {intl.formatMessage({
                id: ETranslations.prime_ai_translate_unavailable_toast_action,
              })}
            </Button>,
          ],
        });
      },
    });

  const logToggle = useCallback(
    (action: 'enable' | 'disable') => {
      defaultLogger.discovery.translation.dappTranslateToggle({
        action,
        engine: settings.engine,
        targetLang: resolvedTargetLang,
        displayMode: settings.displayMode,
        dappDomain: tab?.url ?? '',
      });
    },
    [settings.engine, settings.displayMode, resolvedTargetLang, tab?.url],
  );

  const handleTranslate = useCallback(() => {
    const willTranslate = !translatingRef.current;
    toggleTranslate(resolvedTargetLang);
    setIsTranslated(willTranslate);
    logToggle(willTranslate ? 'enable' : 'disable');
  }, [toggleTranslate, translatingRef, resolvedTargetLang, logToggle]);

  const handleRetranslate = useCallback(() => {
    restoreOriginal();
    startTranslate(resolvedTargetLang, settings.engine);
    setIsTranslated(true);
    logToggle('enable');
  }, [
    restoreOriginal,
    startTranslate,
    resolvedTargetLang,
    settings.engine,
    logToggle,
  ]);

  const handleTranslateTestAIError = useCallback(
    (testFlag: string) => {
      startTranslate(resolvedTargetLang, ETranslateEngine.ai, testFlag);
      setIsTranslated(true);
    },
    [resolvedTargetLang, startTranslate],
  );

  return {
    isTranslated,
    handleTranslate,
    handleRetranslate,
    handleTranslateTestAIError,
  };
}
