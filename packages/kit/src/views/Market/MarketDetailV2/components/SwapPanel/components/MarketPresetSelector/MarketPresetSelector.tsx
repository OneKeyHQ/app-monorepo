import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Button,
  Dialog,
  Divider,
  Heading,
  Icon,
  Input,
  ScrollView,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
  useKeyboardHeight,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { SlippageInput } from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swapSlippageCustomDefaultList,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
  EMarketPresetSlippageWarningType,
  EMarketPresetTradeSide,
  type IMarketPresetDirectionSettings,
  getMarketPresetDefaultDirectionSettings,
  getMarketPresetDefaultEditableDirectionSettingsForPreset,
  getMarketPresetSlippageCustomStatus,
  isInvalidMarketPresetDirectionSettings,
  isInvalidMarketPresetPriorityFeeSettings,
  isInvalidMarketPresetSlippageSettings,
  isMarketPresetConfirmDisabled,
  normalizeMarketPresetDirectionSettings,
} from '../../hooks/marketPresetSettings';

import {
  type ITradingWidgetMainButtonPressEvent,
  type ITradingWidgetMainButtonVariant,
  TradingWidgetMainButton,
} from './TradingWidgetMainButton';

import type { IMarketPresetSettingsState } from '../../hooks/useMarketPresetSettings';

type IMarketPresetSelectorProps = {
  // Only `true` is surfaced because anti-MEV is read-only when supported.
  antiMEV?: boolean;
  presetSettings: IMarketPresetSettingsState;
  slippageIconName?: IIconProps['name'];
  showAutoSlippageLabel?: boolean;
  variant?: ITradingWidgetMainButtonVariant;
};

type IDraftPresetSettings = Partial<
  Record<
    EMarketPresetKey,
    Partial<Record<EMarketPresetTradeSide, IMarketPresetDirectionSettings>>
  >
>;

const MARKET_PRESET_DIALOG_TOP_SAFE_GAP = 16;
const MARKET_PRESET_DIALOG_CHROME_HEIGHT = 176;
const MARKET_PRESET_DIALOG_MIN_CONTENT_HEIGHT = 120;
const MARKET_PRESET_SLIPPAGE_INPUT_PROPS = { autoFocus: false } as const;

function getPriorityFeeTranslationId(type?: EMarketPresetPriorityFeeType) {
  if (type === EMarketPresetPriorityFeeType.AUTO) {
    return ETranslations.global_auto;
  }

  if (type === EMarketPresetPriorityFeeType.FAST) {
    return ETranslations.transaction_fast;
  }

  if (type === EMarketPresetPriorityFeeType.CUSTOM) {
    return ETranslations.content__custom;
  }

  return ETranslations.transaction_normal;
}

function getMarketPresetLabel({
  intl,
  label,
  presetKey,
}: {
  intl: ReturnType<typeof useIntl>;
  label?: string;
  presetKey: EMarketPresetKey;
}) {
  if (presetKey === EMarketPresetKey.AUTO) {
    return intl.formatMessage({ id: ETranslations.global_auto });
  }

  // Defensive fallback: P1/P2/P3 carry a static technical label, but if a
  // future preset entry forgets to set one, returning empty would render an
  // invisible segment. Use the key as a last-resort label.
  return label ?? presetKey.toUpperCase();
}

function getPriorityFeeLabel({
  intl,
  settings,
  unit,
}: {
  intl: ReturnType<typeof useIntl>;
  settings?: IMarketPresetDirectionSettings;
  unit?: string;
}) {
  if (settings?.priorityFee.type === EMarketPresetPriorityFeeType.CUSTOM) {
    if (settings.priorityFee.customValue) {
      return `${settings.priorityFee.customValue}${unit ? ` ${unit}` : ''}`;
    }

    return unit ?? '';
  }

  return intl.formatMessage({
    id: getPriorityFeeTranslationId(settings?.priorityFee.type),
  });
}

function buildDraftSettings(presetSettings: IMarketPresetSettingsState) {
  return presetSettings.presets.reduce<IDraftPresetSettings>((acc, preset) => {
    if (preset.key === EMarketPresetKey.AUTO) {
      return acc;
    }

    acc[preset.key] = {
      [EMarketPresetTradeSide.BUY]:
        presetSettings.getSavedDirectionSettings({
          presetKey: preset.key,
          tradeSide: EMarketPresetTradeSide.BUY,
        }) ??
        getMarketPresetDefaultEditableDirectionSettingsForPreset({
          config: presetSettings.config,
          defaultSlippage: presetSettings.defaultSlippageValue,
          presetKey: preset.key,
        }),
      [EMarketPresetTradeSide.SELL]:
        presetSettings.getSavedDirectionSettings({
          presetKey: preset.key,
          tradeSide: EMarketPresetTradeSide.SELL,
        }) ??
        getMarketPresetDefaultEditableDirectionSettingsForPreset({
          config: presetSettings.config,
          defaultSlippage: presetSettings.defaultSlippageValue,
          presetKey: preset.key,
        }),
    };
    return acc;
  }, {});
}

function getDraftDirectionSettings({
  draftSettings,
  presetKey,
  tradeSide,
}: {
  draftSettings: IDraftPresetSettings;
  presetKey: EMarketPresetKey;
  tradeSide: EMarketPresetTradeSide;
}) {
  return draftSettings[presetKey]?.[tradeSide];
}

function areMarketPresetDirectionSettingsEqual(
  firstSettings?: IMarketPresetDirectionSettings,
  secondSettings?: IMarketPresetDirectionSettings,
) {
  const first = normalizeMarketPresetDirectionSettings(firstSettings);
  const second = normalizeMarketPresetDirectionSettings(secondSettings);

  return (
    first.slippage.key === second.slippage.key &&
    first.slippage.value === second.slippage.value &&
    first.priorityFee.type === second.priorityFee.type &&
    first.priorityFee.customValue === second.priorityFee.customValue
  );
}

function getDirectionKey({
  presetKey,
  tradeSide,
}: {
  presetKey: EMarketPresetKey;
  tradeSide: EMarketPresetTradeSide;
}) {
  return `${presetKey}:${tradeSide}`;
}

function parseDirectionKey(directionKey: string) {
  const [presetKey, tradeSide] = directionKey.split(':');

  if (
    !Object.values(EMarketPresetKey).includes(presetKey as EMarketPresetKey) ||
    !Object.values(EMarketPresetTradeSide).includes(
      tradeSide as EMarketPresetTradeSide,
    )
  ) {
    return undefined;
  }

  return {
    presetKey: presetKey as EMarketPresetKey,
    tradeSide: tradeSide as EMarketPresetTradeSide,
  };
}

function getTradeSideActiveBackgroundColor(tradeSide: EMarketPresetTradeSide) {
  return tradeSide === EMarketPresetTradeSide.BUY
    ? '$bgSuccessStrong'
    : '$bgCriticalStrong';
}

function MarketPresetDialogHeader({ networkId }: { networkId?: string }) {
  const intl = useIntl();

  return (
    <Dialog.Header>
      <XStack alignItems="center" gap="$2" py="$px">
        <NetworkAvatar networkId={networkId} size="$6" />
        <Heading size="$headingXl" py="$px">
          {intl.formatMessage({
            id: ETranslations.marketdex_edit_presets_title,
          })}
        </Heading>
      </XStack>
    </Dialog.Header>
  );
}

function MarketPresetReadonlyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      <SizableText size="$bodyMdMedium">{label}</SizableText>
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {value}
      </SizableText>
    </XStack>
  );
}

function MarketPresetReadonlySwitch({ value }: { value: boolean }) {
  return (
    <XStack
      w="$10"
      h="$5"
      p="$0.5"
      alignItems="center"
      justifyContent={value ? 'flex-end' : 'flex-start'}
      borderRadius="$full"
      bg={value ? '$success7' : '$neutral5'}
      overflow="hidden"
      pointerEvents="none"
    >
      <XStack w="$4" h="$4" borderRadius="$full" bg="$bg" />
    </XStack>
  );
}

function MarketPresetAntiMEVReadonlyRow({
  label,
  value,
}: {
  label: string;
  value: boolean;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
        <Icon name="ShieldCheckDoneSolid" size="$3.5" color="$iconSuccess" />
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {label}
        </SizableText>
      </XStack>
      <MarketPresetReadonlySwitch value={value} />
    </XStack>
  );
}

function MarketPresetDialogContentFrame({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const keyboardHeight = useKeyboardHeight();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dialogContentMaxHeight = useMemo(() => {
    if (!platformEnv.isNative) {
      return undefined;
    }

    const availableHeight =
      windowHeight -
      Math.max(keyboardHeight, 0) -
      safeAreaTop -
      MARKET_PRESET_DIALOG_TOP_SAFE_GAP -
      MARKET_PRESET_DIALOG_CHROME_HEIGHT;

    return Math.max(availableHeight, MARKET_PRESET_DIALOG_MIN_CONTENT_HEIGHT);
  }, [keyboardHeight, safeAreaTop, windowHeight]);

  return (
    <>
      <ScrollView
        mx="$-5"
        px="$5"
        pb="$5"
        maxHeight={dialogContentMaxHeight}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4">{children}</YStack>
      </ScrollView>
      {footer}
    </>
  );
}

function MarketPresetDialogActions({
  activePresetKey,
  confirmDisabled,
  intl,
  isReadonlyPreset,
  onConfirm,
  onReset,
}: {
  activePresetKey: EMarketPresetKey;
  confirmDisabled: boolean;
  intl: ReturnType<typeof useIntl>;
  isReadonlyPreset: boolean;
  onConfirm: () => void;
  onReset: () => void;
}) {
  if (activePresetKey === EMarketPresetKey.AUTO || isReadonlyPreset) {
    return (
      <XStack p="$5" pt="$0">
        <Button
          testID={MarketTestIDs.presetSelectorOkBtn}
          flex={1}
          variant="primary"
          size="medium"
          disabled={confirmDisabled}
          onPress={onConfirm}
        >
          {intl.formatMessage({
            id: isReadonlyPreset
              ? ETranslations.global_ok
              : ETranslations.global_confirm,
          })}
        </Button>
      </XStack>
    );
  }

  return (
    <XStack p="$5" pt="$0" gap="$3">
      <Button
        testID={MarketTestIDs.presetSelectorResetBtn}
        flex={1}
        variant="secondary"
        size="medium"
        onPress={onReset}
      >
        {intl.formatMessage({ id: ETranslations.global_reset })}
      </Button>
      <Button
        testID={MarketTestIDs.presetSelectorConfirmBtn}
        flex={1}
        variant="primary"
        size="medium"
        disabled={confirmDisabled}
        onPress={onConfirm}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
    </XStack>
  );
}

function MarketPresetTabBar({
  onChange,
  options,
  value,
}: {
  onChange: (value: EMarketPresetKey) => void;
  options: {
    label: string;
    value: EMarketPresetKey;
    testID?: string;
  }[];
  value: EMarketPresetKey;
}) {
  return (
    <XStack
      alignItems="flex-start"
      bg="$transparent"
      borderBottomColor="$borderSubdued"
      borderBottomWidth="$px"
      gap="$5"
      px="$0"
      width="100%"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <XStack
            key={option.value}
            accessibilityRole="button"
            alignItems="center"
            bg="$transparent"
            borderBottomColor={selected ? '$borderActive' : '$transparent'}
            borderBottomWidth="$0.5"
            cursor="pointer"
            h={44}
            justifyContent="center"
            overflow="hidden"
            pb="$0.5"
            onPress={() => onChange(option.value)}
            testID={option.testID}
          >
            <SizableText
              size="$bodyLgMedium"
              color={selected ? '$text' : '$textSubdued'}
              numberOfLines={1}
            >
              {option.label}
            </SizableText>
          </XStack>
        );
      })}
    </XStack>
  );
}

function MarketPresetSettingsDialog({
  antiMEV,
  close,
  presetSettings,
}: {
  antiMEV?: boolean;
  close: () => void;
  presetSettings: IMarketPresetSettingsState;
}) {
  const intl = useIntl();
  const [activePresetKey, setActivePresetKey] = useState(
    presetSettings.selectedPresetKey,
  );
  const [activeTradeSide, setActiveTradeSide] = useState(
    presetSettings.tradeSide,
  );
  const [draftSettings, setDraftSettings] = useState(() =>
    buildDraftSettings(presetSettings),
  );
  const dirtyDirectionSetRef = useRef(new Set<string>());
  const resetDirectionSetRef = useRef(new Set<string>());

  const presetOptions = useMemo(
    () =>
      presetSettings.presets.map((preset) => ({
        label: getMarketPresetLabel({
          intl,
          label: preset.label,
          presetKey: preset.key,
        }),
        testID: `market-preset-dialog-tab-${preset.key}`,
        value: preset.key,
      })),
    [intl, presetSettings.presets],
  );

  const sideOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_buy }),
        value: EMarketPresetTradeSide.BUY,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_sell }),
        value: EMarketPresetTradeSide.SELL,
      },
    ],
    [intl],
  );

  const priorityFeeOptions = useMemo(() => {
    const supportedTypes = presetSettings.config?.priorityFee
      .supportedTypes ?? [EMarketPresetPriorityFeeType.MARKET];

    return supportedTypes.map((type) => ({
      label: intl.formatMessage({ id: getPriorityFeeTranslationId(type) }),
      value: type,
    }));
  }, [intl, presetSettings.config?.priorityFee.supportedTypes]);
  const isReadonlyPreset =
    !presetSettings.config?.slippage.editable &&
    !presetSettings.config?.priorityFee.editable;
  const showPriorityFeeSettings = !!presetSettings.config?.priorityFee;
  const isPriorityFeeEditable = !!presetSettings.config?.priorityFee.editable;
  const shouldShowAntiMEV = antiMEV === true;

  const currentSettings = useMemo(() => {
    if (activePresetKey === EMarketPresetKey.AUTO) {
      return getMarketPresetDefaultDirectionSettings();
    }

    return normalizeMarketPresetDirectionSettings(
      draftSettings[activePresetKey]?.[activeTradeSide],
    );
  }, [activePresetKey, activeTradeSide, draftSettings]);

  const updateCurrentSettings = useCallback(
    (
      updater: (
        settings: IMarketPresetDirectionSettings,
      ) => IMarketPresetDirectionSettings,
    ) => {
      if (activePresetKey === EMarketPresetKey.AUTO) {
        return;
      }

      const directionKey = getDirectionKey({
        presetKey: activePresetKey,
        tradeSide: activeTradeSide,
      });
      const nextSettings = updater(currentSettings);
      const savedSettings = presetSettings.getSavedDirectionSettings({
        presetKey: activePresetKey,
        tradeSide: activeTradeSide,
      });
      const defaultSettings =
        getMarketPresetDefaultEditableDirectionSettingsForPreset({
          config: presetSettings.config,
          defaultSlippage: presetSettings.defaultSlippageValue,
          presetKey: activePresetKey,
        });
      const matchesDefault = areMarketPresetDirectionSettingsEqual(
        nextSettings,
        defaultSettings,
      );
      const matchesSaved =
        !!savedSettings &&
        areMarketPresetDirectionSettingsEqual(nextSettings, savedSettings);

      if (matchesSaved) {
        dirtyDirectionSetRef.current.delete(directionKey);
        resetDirectionSetRef.current.delete(directionKey);
      } else if (matchesDefault) {
        dirtyDirectionSetRef.current.delete(directionKey);
        if (savedSettings) {
          resetDirectionSetRef.current.add(directionKey);
        } else {
          resetDirectionSetRef.current.delete(directionKey);
        }
      } else {
        resetDirectionSetRef.current.delete(directionKey);
        dirtyDirectionSetRef.current.add(directionKey);
      }

      setDraftSettings((prev) => ({
        ...prev,
        [activePresetKey]: {
          ...prev[activePresetKey],
          [activeTradeSide]: nextSettings,
        },
      }));
    },
    [activePresetKey, activeTradeSide, currentSettings, presetSettings],
  );

  const currentDirectionKey = getDirectionKey({
    presetKey: activePresetKey,
    tradeSide: activeTradeSide,
  });
  const currentDirectionPendingReset =
    resetDirectionSetRef.current.has(currentDirectionKey);
  const currentSlippageCustomStatus =
    getMarketPresetSlippageCustomStatus(currentSettings);
  const currentSlippageInvalid =
    currentSlippageCustomStatus.status === ESwapSlippageCustomStatus.ERROR;
  const currentPriorityFeeInvalid =
    !!presetSettings.config?.priorityFee.editable &&
    isInvalidMarketPresetPriorityFeeSettings(
      currentSettings,
      presetSettings.config,
    );
  const currentPriorityFeeCustomValue =
    currentSettings.priorityFee.customValue ?? '';
  const currentSettingsInvalid =
    !currentDirectionPendingReset &&
    (currentSlippageInvalid || currentPriorityFeeInvalid);
  const showCurrentSlippageError =
    !currentDirectionPendingReset && currentSlippageInvalid;
  const showCurrentSlippageWarning =
    !currentDirectionPendingReset &&
    currentSlippageCustomStatus.status === ESwapSlippageCustomStatus.WRONG;
  const showCurrentPriorityFeeError =
    !currentDirectionPendingReset &&
    currentPriorityFeeInvalid &&
    currentPriorityFeeCustomValue.length > 0;
  const isDirectionSettingsInvalid = useCallback(
    (directionSettings?: IMarketPresetDirectionSettings) => {
      if (!presetSettings.config?.priorityFee.editable) {
        return isInvalidMarketPresetSlippageSettings(directionSettings);
      }
      return isInvalidMarketPresetDirectionSettings(
        directionSettings,
        presetSettings.config,
      );
    },
    [presetSettings.config],
  );
  const hasInvalidDirtySettings = Array.from(dirtyDirectionSetRef.current).some(
    (directionKey) => {
      if (resetDirectionSetRef.current.has(directionKey)) {
        return false;
      }

      const parsed = parseDirectionKey(directionKey);
      if (!parsed) {
        return false;
      }
      const directionSettings = getDraftDirectionSettings({
        draftSettings,
        presetKey: parsed.presetKey,
        tradeSide: parsed.tradeSide,
      });
      return isDirectionSettingsInvalid(directionSettings);
    },
  );

  const confirmDisabled = isMarketPresetConfirmDisabled({
    activePresetKey,
    currentSettingsInvalid,
    hasInvalidDirtySettings,
  });

  const slippageOptions = useMemo(() => {
    const autoSelected =
      currentSettings.slippage.key === ESwapSlippageSegmentKey.AUTO;

    return [
      {
        label: (
          <XStack alignItems="center" gap="$1" justifyContent="center">
            <Icon name="Ai3StarOutline" size="$3.5" color="$iconSuccess" />
            <SizableText
              size="$bodyMdMedium"
              color={autoSelected ? '$text' : '$textSubdued'}
              numberOfLines={1}
            >
              {intl.formatMessage({
                id: ETranslations.slippage_tolerance_switch_auto,
              })}
            </SizableText>
          </XStack>
        ),
        value: ESwapSlippageSegmentKey.AUTO,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.slippage_tolerance_switch_custom,
        }),
        value: ESwapSlippageSegmentKey.CUSTOM,
      },
    ];
  }, [currentSettings.slippage.key, intl]);

  const flushPendingSettings = useCallback(
    async ({
      shouldChangePreset,
      skipInvalidDirtySettings,
    }: {
      shouldChangePreset: boolean;
      skipInvalidDirtySettings: boolean;
    }) => {
      const saveTasks: Array<() => Promise<void>> = [];

      Array.from(resetDirectionSetRef.current).forEach((directionKey) => {
        const parsed = parseDirectionKey(directionKey);
        if (parsed && parsed.presetKey !== EMarketPresetKey.AUTO) {
          saveTasks.push(() =>
            presetSettings.onResetPresetDirectionSettings({
              presetKey: parsed.presetKey,
              tradeSide: parsed.tradeSide,
            }),
          );
        }
      });

      Array.from(dirtyDirectionSetRef.current).forEach((directionKey) => {
        const parsed = parseDirectionKey(directionKey);
        if (
          parsed &&
          parsed.presetKey !== EMarketPresetKey.AUTO &&
          !resetDirectionSetRef.current.has(directionKey)
        ) {
          const directionSettings = getDraftDirectionSettings({
            draftSettings,
            presetKey: parsed.presetKey,
            tradeSide: parsed.tradeSide,
          });
          if (
            directionSettings &&
            (!skipInvalidDirtySettings ||
              !isDirectionSettingsInvalid(directionSettings))
          ) {
            saveTasks.push(() =>
              presetSettings.onSavePresetDirectionSettings({
                presetKey: parsed.presetKey,
                tradeSide: parsed.tradeSide,
                settings: directionSettings,
              }),
            );
          }
        }
      });

      await saveTasks.reduce<Promise<void>>(async (promise, task) => {
        await promise;
        await task();
      }, Promise.resolve());

      if (
        shouldChangePreset &&
        activePresetKey !== presetSettings.selectedPresetKey
      ) {
        presetSettings.onPresetChange(activePresetKey);
      }
    },
    [
      activePresetKey,
      draftSettings,
      isDirectionSettingsInvalid,
      presetSettings,
    ],
  );

  const handleConfirm = useCallback(async () => {
    if (confirmDisabled) {
      return;
    }

    await flushPendingSettings({
      shouldChangePreset: true,
      skipInvalidDirtySettings: activePresetKey === EMarketPresetKey.AUTO,
    });
    close();
  }, [activePresetKey, close, confirmDisabled, flushPendingSettings]);

  const handleReset = useCallback(async () => {
    if (activePresetKey === EMarketPresetKey.AUTO) {
      close();
      return;
    }

    const directionKey = getDirectionKey({
      presetKey: activePresetKey,
      tradeSide: activeTradeSide,
    });
    const savedSettings = presetSettings.getSavedDirectionSettings({
      presetKey: activePresetKey,
      tradeSide: activeTradeSide,
    });

    dirtyDirectionSetRef.current.delete(directionKey);
    if (savedSettings) {
      resetDirectionSetRef.current.add(directionKey);
    } else {
      resetDirectionSetRef.current.delete(directionKey);
    }

    await flushPendingSettings({
      shouldChangePreset: false,
      skipInvalidDirtySettings: true,
    });
    close();
  }, [
    activePresetKey,
    activeTradeSide,
    close,
    flushPendingSettings,
    presetSettings,
  ]);

  return (
    <MarketPresetDialogContentFrame
      footer={
        <Dialog.Footer
          showFooter={false}
          extraContent={
            <MarketPresetDialogActions
              activePresetKey={activePresetKey}
              confirmDisabled={confirmDisabled}
              intl={intl}
              isReadonlyPreset={isReadonlyPreset}
              onConfirm={() => {
                void handleConfirm();
              }}
              onReset={() => {
                void handleReset();
              }}
            />
          }
        />
      }
    >
      <MarketPresetDialogHeader networkId={presetSettings.config?.networkId} />

      <MarketPresetTabBar
        value={activePresetKey}
        options={presetOptions}
        onChange={setActivePresetKey}
      />

      {activePresetKey === EMarketPresetKey.AUTO ? (
        <YStack gap="$3">
          <XStack gap="$3" py="$2">
            <Icon name="Ai2StarSolid" size="$6" color="$iconSubdued" />
            <YStack flex={1} minWidth={0}>
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.marketdex_smarter_trade_settings_title,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.marketdex_smarter_trade_settings_description,
                })}
              </SizableText>
            </YStack>
          </XStack>
          {shouldShowAntiMEV ? (
            <XStack gap="$3" py="$2">
              <Icon
                name="ShieldCheckDoneSolid"
                size="$6"
                color="$iconSubdued"
              />
              <YStack flex={1} minWidth={0}>
                <SizableText size="$bodyMdMedium">
                  {intl.formatMessage({
                    id: ETranslations.marketdex_anti_mev_title,
                  })}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.marketdex_anti_mev_description,
                  })}
                </SizableText>
              </YStack>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$3">
          <SegmentControl
            fullWidth
            value={activeTradeSide}
            options={sideOptions}
            borderRadius="$2.5"
            gap="$0.5"
            p="$0.5"
            slotBackgroundColor="$neutral5"
            activeBackgroundColor={getTradeSideActiveBackgroundColor(
              activeTradeSide,
            )}
            activeTextColor="$textOnColor"
            inactiveTextColor="$textSubdued"
            segmentControlItemStyleProps={{
              borderRadius: '$2',
              px: '$2',
              py: '$1',
            }}
            onChange={(value) =>
              setActiveTradeSide(value as EMarketPresetTradeSide)
            }
          />

          <YStack gap="$2">
            {presetSettings.config?.slippage.editable ? (
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.swap_page_provider_slippage_tolerance,
                })}
              </SizableText>
            ) : null}
            {presetSettings.config?.slippage.editable ? (
              <>
                <SegmentControl
                  fullWidth
                  value={currentSettings.slippage.key}
                  options={slippageOptions}
                  borderRadius="$2.5"
                  gap="$0.5"
                  p="$0.5"
                  slotBackgroundColor="$neutral5"
                  activeBackgroundColor="$bg"
                  activeTextColor="$text"
                  inactiveTextColor="$textSubdued"
                  segmentControlItemStyleProps={{
                    borderRadius: '$2',
                    px: '$2',
                    py: '$1',
                  }}
                  onChange={(value) => {
                    const key = value as ESwapSlippageSegmentKey;
                    updateCurrentSettings((settings) => ({
                      ...settings,
                      slippage: {
                        key,
                        value:
                          key === ESwapSlippageSegmentKey.CUSTOM
                            ? (settings.slippage.value ??
                              presetSettings.defaultSlippageValue)
                            : undefined,
                      },
                    }));
                  }}
                />
                {currentSettings.slippage.key ===
                ESwapSlippageSegmentKey.CUSTOM ? (
                  <>
                    <XStack gap="$2.5">
                      <SlippageInput
                        swapSlippage={{
                          key: ESwapSlippageSegmentKey.CUSTOM,
                          value: currentSettings.slippage.value,
                        }}
                        onChangeText={(text) => {
                          const valueBN = new BigNumber(text);
                          updateCurrentSettings((settings) => ({
                            ...settings,
                            slippage: {
                              key: ESwapSlippageSegmentKey.CUSTOM,
                              value:
                                !text || valueBN.isNaN()
                                  ? undefined
                                  : valueBN.toNumber(),
                            },
                          }));
                        }}
                        props={MARKET_PRESET_SLIPPAGE_INPUT_PROPS}
                      />
                      <XStack>
                        {swapSlippageCustomDefaultList.map((item, index) => (
                          <Button
                            key={item}
                            testID={MarketTestIDs.presetSelectorSlippagePresetBtn(
                              item,
                            )}
                            variant="secondary"
                            size="medium"
                            borderTopRightRadius={index !== 2 ? 0 : '$2'}
                            borderBottomRightRadius={index !== 2 ? 0 : '$2'}
                            borderTopLeftRadius={index !== 0 ? 0 : '$2'}
                            borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
                            onPress={() => {
                              updateCurrentSettings((settings) => ({
                                ...settings,
                                slippage: {
                                  key: ESwapSlippageSegmentKey.CUSTOM,
                                  value: item,
                                },
                              }));
                            }}
                          >{`${item}%`}</Button>
                        ))}
                      </XStack>
                    </XStack>
                    {showCurrentSlippageError || showCurrentSlippageWarning ? (
                      <SizableText
                        size="$bodySmMedium"
                        color={
                          showCurrentSlippageError
                            ? '$textCritical'
                            : '$textCaution'
                        }
                      >
                        {showCurrentSlippageError
                          ? intl.formatMessage({
                              id: ETranslations.slippage_tolerance_error_message,
                            })
                          : intl.formatMessage(
                              {
                                id:
                                  currentSlippageCustomStatus.warningType ===
                                  EMarketPresetSlippageWarningType.WILL_AHEAD
                                    ? ETranslations.slippage_tolerance_warning_message_1
                                    : ETranslations.slippage_tolerance_warning_message_2,
                              },
                              {
                                number:
                                  currentSlippageCustomStatus.warningType ===
                                  EMarketPresetSlippageWarningType.WILL_AHEAD
                                    ? swapSlippageWillAheadMinValue
                                    : swapSlippageWillFailMinValue,
                              },
                            )}
                      </SizableText>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <MarketPresetReadonlyRow
                label={intl.formatMessage({
                  id: ETranslations.swap_page_provider_slippage_tolerance,
                })}
                value={intl.formatMessage({ id: ETranslations.global_auto })}
              />
            )}
          </YStack>

          {showPriorityFeeSettings && isPriorityFeeEditable ? (
            <>
              <Divider />
              <YStack gap="$2">
                <SizableText size="$bodyMdMedium">
                  {intl.formatMessage({
                    id: ETranslations.marketdex_priority_fee,
                  })}
                </SizableText>
                <SegmentControl
                  fullWidth
                  value={currentSettings.priorityFee.type}
                  options={priorityFeeOptions}
                  borderRadius="$2.5"
                  gap="$0.5"
                  p="$0.5"
                  slotBackgroundColor="$neutral5"
                  activeBackgroundColor="$bg"
                  activeTextColor="$text"
                  inactiveTextColor="$textSubdued"
                  segmentControlItemStyleProps={{
                    borderRadius: '$2',
                    px: '$2',
                    py: '$1',
                  }}
                  onChange={(value) => {
                    const type = value as EMarketPresetPriorityFeeType;
                    updateCurrentSettings((settings) => ({
                      ...settings,
                      priorityFee: {
                        type,
                        customValue:
                          type === EMarketPresetPriorityFeeType.CUSTOM
                            ? (settings.priorityFee.customValue ?? '')
                            : undefined,
                      },
                    }));
                  }}
                />
                {currentSettings.priorityFee.type ===
                EMarketPresetPriorityFeeType.CUSTOM ? (
                  <>
                    <Input
                      testID={
                        MarketTestIDs.presetSelectorPriorityFeeCustomInput
                      }
                      size="medium"
                      error={showCurrentPriorityFeeError}
                      value={currentSettings.priorityFee.customValue ?? ''}
                      addOns={[
                        {
                          label: presetSettings.priorityFeeUnit,
                        },
                      ]}
                      placeholder={presetSettings.priorityFeeCustomPlaceholder}
                      onChangeText={(text) => {
                        if (!validateAmountInput(text, 9)) {
                          return;
                        }
                        updateCurrentSettings((settings) => ({
                          ...settings,
                          priorityFee: {
                            ...settings.priorityFee,
                            customValue: text,
                          },
                        }));
                      }}
                    />
                    {showCurrentPriorityFeeError ? (
                      <SizableText size="$bodySmMedium" color="$textCritical">
                        {intl.formatMessage(
                          {
                            id: ETranslations.form_fee_rate_error_out_of_range,
                          },
                          {
                            min: presetSettings.priorityFeeCustomRange.min,
                            max: presetSettings.priorityFeeCustomRange.max,
                          },
                        )}
                      </SizableText>
                    ) : null}
                  </>
                ) : null}
              </YStack>
            </>
          ) : null}

          {showPriorityFeeSettings && !isPriorityFeeEditable ? (
            <MarketPresetReadonlyRow
              label={intl.formatMessage({
                id: ETranslations.marketdex_priority_fee,
              })}
              value={intl.formatMessage({ id: ETranslations.global_auto })}
            />
          ) : null}

          {shouldShowAntiMEV ? (
            <>
              <Divider />

              <MarketPresetAntiMEVReadonlyRow
                label={intl.formatMessage({
                  id: ETranslations.marketdex_anti_mev_title,
                })}
                value
              />
            </>
          ) : null}
        </YStack>
      )}
    </MarketPresetDialogContentFrame>
  );
}

export function MarketPresetSelector({
  antiMEV,
  presetSettings,
  slippageIconName = 'SliderVerOutline',
  showAutoSlippageLabel = false,
  variant,
}: IMarketPresetSelectorProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const {
    enabled,
    presets,
    selectedPreset,
    selectedDirectionSettings,
    selectedPresetKey,
    selectedSlippageValue,
    onPresetChange,
  } = presetSettings;
  const resolvedVariant = variant ?? (gtMd ? 'full' : 'compact');

  const presetOptions = useMemo(
    () =>
      presets.map((preset) => ({
        label: getMarketPresetLabel({
          intl,
          label: preset.label,
          presetKey: preset.key,
        }),
        value: preset.key,
        testID: `market-preset-${preset.key}`,
      })),
    [intl, presets],
  );

  const openPresetDialog = useCallback(() => {
    const dialog = Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.marketdex_edit_presets_title,
      }),
      renderContent: (
        <MarketPresetSettingsDialog
          close={() => {
            void dialog.close();
          }}
          antiMEV={antiMEV}
          presetSettings={presetSettings}
        />
      ),
      showFooter: false,
    });
  }, [antiMEV, intl, presetSettings]);

  const handleQuickPresetSwitch = useCallback(
    (event?: ITradingWidgetMainButtonPressEvent) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      const currentIndex = presetOptions.findIndex(
        (option) => option.value === selectedPresetKey,
      );
      const nextIndex =
        currentIndex < 0 ? 0 : (currentIndex + 1) % presetOptions.length;
      const nextPresetKey = presetOptions[nextIndex]?.value;
      if (nextPresetKey && nextPresetKey !== selectedPresetKey) {
        onPresetChange(nextPresetKey);
      }
    },
    [onPresetChange, presetOptions, selectedPresetKey],
  );

  if (!enabled || presetOptions.length === 0) {
    return null;
  }

  const slippageLabel =
    resolvedVariant === 'compact' &&
    showAutoSlippageLabel &&
    selectedDirectionSettings.slippage.key === ESwapSlippageSegmentKey.AUTO
      ? intl.formatMessage({ id: ETranslations.global_auto })
      : `${selectedSlippageValue}%`;
  const priorityFeeLabel = getPriorityFeeLabel({
    intl,
    settings: selectedDirectionSettings,
    unit: presetSettings.priorityFeeUnit,
  });
  const showAntiMEV = antiMEV === true;
  const selectedPresetItem =
    selectedPreset ??
    presets.find((preset) => preset.key === selectedPresetKey);
  const selectedPresetLabel = selectedPresetItem
    ? getMarketPresetLabel({
        intl,
        label: selectedPresetItem.label,
        presetKey: selectedPresetItem.key,
      })
    : intl.formatMessage({ id: ETranslations.global_auto });

  return (
    <TradingWidgetMainButton
      variant={resolvedVariant}
      presetOptions={presetOptions}
      selectedPresetLabel={selectedPresetLabel}
      selectedPresetValue={selectedPresetKey}
      slippageIconName={slippageIconName}
      slippageLabel={slippageLabel}
      priorityFeeLabel={priorityFeeLabel}
      showAntiMEV={showAntiMEV}
      onPresetChange={onPresetChange}
      onOpenSettings={openPresetDialog}
      onQuickPresetPress={handleQuickPresetSwitch}
      testID="market-preset-selector"
    />
  );
}
