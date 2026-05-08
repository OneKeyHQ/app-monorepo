import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  Input,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { SlippageInput } from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { swapSlippageCustomDefaultList } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
  EMarketPresetTradeSide,
  type IMarketPresetDirectionSettings,
  getMarketPresetDefaultDirectionSettings,
  getMarketPresetDefaultEditableDirectionSettingsForPreset,
  isInvalidMarketPresetDirectionSettings,
  isInvalidMarketPresetPriorityFeeSettings,
  isInvalidMarketPresetSlippageSettings,
  normalizeMarketPresetDirectionSettings,
} from '../../hooks/marketPresetSettings';

import {
  type ITradingWidgetMainButtonPressEvent,
  type ITradingWidgetMainButtonVariant,
  TradingWidgetMainButton,
} from './TradingWidgetMainButton';

import type { IMarketPresetSettingsState } from '../../hooks/useMarketPresetSettings';

type IMarketPresetSelectorProps = {
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

  return ETranslations.global_market;
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
          presetKey: preset.key,
        }),
      [EMarketPresetTradeSide.SELL]:
        presetSettings.getSavedDirectionSettings({
          presetKey: preset.key,
          tradeSide: EMarketPresetTradeSide.SELL,
        }) ??
        getMarketPresetDefaultEditableDirectionSettingsForPreset({
          config: presetSettings.config,
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
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.marketdex_edit_presets_title,
          })}
        </SizableText>
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
  close,
  presetSettings,
}: {
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

  const priorityFeeOptions = useMemo(
    () =>
      (
        presetSettings.config?.priorityFee.supportedTypes ?? [
          EMarketPresetPriorityFeeType.MARKET,
        ]
      ).map((type) => ({
        label: intl.formatMessage({ id: getPriorityFeeTranslationId(type) }),
        value: type,
      })),
    [intl, presetSettings.config?.priorityFee.supportedTypes],
  );
  const isReadonlyPreset =
    !presetSettings.config?.slippage.editable &&
    !presetSettings.config?.priorityFee.editable;

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
  const currentSlippageInvalid =
    isInvalidMarketPresetSlippageSettings(currentSettings);
  const currentPriorityFeeInvalid =
    !!presetSettings.config?.priorityFee.editable &&
    isInvalidMarketPresetPriorityFeeSettings(currentSettings);
  const currentSettingsInvalid =
    !currentDirectionPendingReset &&
    (currentSlippageInvalid || currentPriorityFeeInvalid);
  const showCurrentSlippageError =
    !currentDirectionPendingReset && currentSlippageInvalid;
  const showCurrentPriorityFeeError =
    !currentDirectionPendingReset && currentPriorityFeeInvalid;
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
      if (!presetSettings.config?.priorityFee.editable) {
        return isInvalidMarketPresetSlippageSettings(directionSettings);
      }
      return isInvalidMarketPresetDirectionSettings(directionSettings);
    },
  );

  const confirmDisabled = currentSettingsInvalid || hasInvalidDirtySettings;

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

  const handleConfirm = useCallback(async () => {
    if (confirmDisabled) {
      return;
    }

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
        if (directionSettings) {
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

    if (activePresetKey !== presetSettings.selectedPresetKey) {
      presetSettings.onPresetChange(activePresetKey);
    }
    close();
  }, [activePresetKey, close, confirmDisabled, draftSettings, presetSettings]);

  const handleReset = useCallback(() => {
    if (activePresetKey === EMarketPresetKey.AUTO) {
      close();
      return;
    }

    const defaultSettings =
      getMarketPresetDefaultEditableDirectionSettingsForPreset({
        config: presetSettings.config,
        presetKey: activePresetKey,
      });
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

    setDraftSettings((prev) => ({
      ...prev,
      [activePresetKey]: {
        ...prev[activePresetKey],
        [activeTradeSide]: defaultSettings,
      },
    }));
  }, [activePresetKey, activeTradeSide, close, presetSettings]);

  return (
    <YStack gap="$4">
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
          <XStack gap="$3" py="$2">
            <Icon name="ShieldCheckDoneSolid" size="$6" color="$iconSubdued" />
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
          <Button
            variant="primary"
            size="medium"
            disabled={confirmDisabled}
            onPress={() => {
              void handleConfirm();
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </YStack>
      ) : (
        <YStack gap="$4">
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
                          value:
                            currentSettings.slippage.value ??
                            presetSettings.defaultSlippageValue,
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
                      />
                      <XStack>
                        {swapSlippageCustomDefaultList.map((item, index) => (
                          <Button
                            key={item}
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
                    {showCurrentSlippageError ? (
                      <SizableText size="$bodySmMedium" color="$textCritical">
                        {intl.formatMessage({
                          id: ETranslations.slippage_tolerance_error_message,
                        })}
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

          <YStack gap="$2">
            {presetSettings.config?.priorityFee.editable ? (
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id: ETranslations.marketdex_priority_fee,
                })}
              </SizableText>
            ) : null}
            {presetSettings.config?.priorityFee.editable ? (
              <>
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
                      size="medium"
                      error={showCurrentPriorityFeeError}
                      value={currentSettings.priorityFee.customValue ?? ''}
                      addOns={[
                        {
                          label: presetSettings.priorityFeeUnit,
                        },
                      ]}
                      placeholder="0"
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
                            min: 0,
                            max: MARKET_PRESET_CUSTOM_PRIORITY_FEE_MAX_VALUE,
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
                  id: ETranslations.marketdex_priority_fee,
                })}
                value={intl.formatMessage({ id: ETranslations.global_auto })}
              />
            )}
          </YStack>

          {isReadonlyPreset ? (
            <Button
              variant="primary"
              size="medium"
              disabled={confirmDisabled}
              onPress={() => {
                void handleConfirm();
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_ok })}
            </Button>
          ) : (
            <XStack gap="$3">
              <Button
                flex={1}
                variant="secondary"
                size="medium"
                onPress={handleReset}
              >
                {intl.formatMessage({ id: ETranslations.global_reset })}
              </Button>
              <Button
                flex={1}
                variant="primary"
                size="medium"
                disabled={confirmDisabled}
                onPress={() => {
                  void handleConfirm();
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_confirm })}
              </Button>
            </XStack>
          )}
        </YStack>
      )}
    </YStack>
  );
}

export function MarketPresetSelector({
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
    presetCustomizedMap,
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
        label: `${getMarketPresetLabel({
          intl,
          label: preset.label,
          presetKey: preset.key,
        })}${presetCustomizedMap[preset.key] ? '*' : ''}`,
        value: preset.key,
        testID: `market-preset-${preset.key}`,
      })),
    [intl, presetCustomizedMap, presets],
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
          presetSettings={presetSettings}
        />
      ),
      showFooter: false,
    });
  }, [intl, presetSettings]);

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
      onPresetChange={onPresetChange}
      onOpenSettings={openPresetDialog}
      onQuickPresetPress={handleQuickPresetSwitch}
      testID="market-preset-selector"
    />
  );
}
