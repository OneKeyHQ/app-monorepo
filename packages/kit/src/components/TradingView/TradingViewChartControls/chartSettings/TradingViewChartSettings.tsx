import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Button,
  Checkbox,
  ColorPicker,
  Divider,
  Icon,
  IconButton,
  Page,
  Popover,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  createTradingViewChartSettingsValue,
  toggleTradingViewSettingsMockAppearanceItem,
  updateTradingViewSettingsMockAppearanceItemColor,
} from './TradingViewSettingsMockState';
import { useSettingsDraftValue } from './TradingViewSettingsShared';

import type {
  ITradingViewChartSettingsOptions,
  ITradingViewChartSettingsPriceColorMode,
  ITradingViewChartSettingsValue,
  ITradingViewSettingsMockAppearanceItem,
  ITradingViewSettingsMockAppearanceSectionId,
  ITradingViewSettingsMockColorRole,
} from './TradingViewSettingsMockState';

const CHART_COLOR_PALETTE = [
  '#FFFFFF',
  '#B2B5BF',
  '#83858F',
  '#555966',
  '#2B2E38',
  '#0F1013',
  '#E5484D',
  '#C33759',
  '#D64073',
  '#FF3CD9',
  '#FBA43A',
  '#FDEB5B',
  '#D6FF00',
  '#6AAF63',
  '#219D46',
  '#4E9F8A',
  '#5CB8D1',
  '#3D63DD',
  '#6747C7',
  '#953EA8',
] as const;

const NAVIGATION_TRANSLATION_IDS: Record<
  ITradingViewSettingsMockAppearanceSectionId,
  ETranslations
> = {
  candles: ETranslations.market_chart_settings__candles,
  coordinates: ETranslations.market_chart_settings__scales,
  events: ETranslations.market_chart_settings__events,
  layout: ETranslations.market_chart_settings__canvas,
};

const OPTION_TRANSLATION_IDS: Record<
  keyof ITradingViewChartSettingsOptions,
  ETranslations
> = {
  countdown: ETranslations.market_chart_settings__countdown,
  depth: ETranslations.market_chart_settings__depth,
  priceChange: ETranslations.market_chart_settings__price_change,
  latestPrice: ETranslations.market_chart_settings__latest_price,
  futureEvents: ETranslations.market_chart_settings__show_upcoming_events,
  pastEvents: ETranslations.market_chart_settings__show_past_events,
  clickInteraction: ETranslations.market_chart_settings__chart_interaction,
  crossLine: ETranslations.market_chart_settings__crosshair,
};

const SELECT_OPTION_TRANSLATION_IDS: Record<string, ETranslations> = {
  solid: ETranslations.market_chart_settings__solid_line,
  dashed: ETranslations.market_chart_settings__dotted_line,
  gradient: ETranslations.market_chart_settings__gradient,
  both: ETranslations.market_chart_settings__vertical_and_horizontal,
  horizontal: ETranslations.market_chart_settings__horizontal,
  vertical: ETranslations.market_chart_settings__vertical,
  none: ETranslations.market_chart_settings__none,
  greenUpRedDown: ETranslations.market_chart_settings__green_up_red_down,
  redUpGreenDown: ETranslations.market_chart_settings__red_up_green_down,
};

const APPEARANCE_ITEM_TRANSLATION_IDS: Record<string, ETranslations> = {
  body: ETranslations.market_chart_settings__body,
  border: ETranslations.market_chart_settings__border,
  wick: ETranslations.market_chart_settings__wick,
};

const TREND_COLOR_PRESETS = {
  modern: {
    positive: '#D6FF00',
    negative: '#FF3CD9',
  },
  classic: {
    positive: '#219D46',
    negative: '#C33759',
  },
} as const;

function applyChartTrendColors(
  value: ITradingViewChartSettingsValue,
  priceColorMode: ITradingViewChartSettingsPriceColorMode,
): ITradingViewChartSettingsValue {
  const preset = TREND_COLOR_PRESETS.classic;
  const trendColors =
    priceColorMode === 'greenUpRedDown'
      ? {
          upColor: preset.positive,
          downColor: preset.negative,
        }
      : {
          upColor: preset.negative,
          downColor: preset.positive,
        };

  return {
    ...value,
    colorMode: 'classic',
    priceColorMode,
    appearanceSections: value.appearanceSections.map((section) =>
      section.id === 'candles'
        ? {
            ...section,
            items: section.items.map((item) => ({
              ...item,
              ...trendColors,
            })),
          }
        : section,
    ),
    latestPriceLine: {
      ...value.latestPriceLine,
      ...trendColors,
    },
  };
}

function formatOptionLabel(
  intl: ReturnType<typeof useIntl>,
  value: string,
  optionTranslationIds?: Partial<Record<string, ETranslations>>,
) {
  const translationId =
    optionTranslationIds?.[value] ?? SELECT_OPTION_TRANSLATION_IDS[value];
  if (translationId) {
    return intl.formatMessage({ id: translationId });
  }

  return value;
}

function formatTestID(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

function SettingsGroup({
  title,
  children,
  showDivider = true,
}: {
  title?: string;
  children: ReactNode;
  showDivider?: boolean;
}) {
  const { md } = useMedia();

  return (
    <YStack width="100%">
      <YStack py="$5">
        {title ? (
          <XStack px="$5" pb="$3" width="100%">
            <SizableText flex={1} size="$bodyMd" color="$textSubdued">
              {title}
            </SizableText>
          </XStack>
        ) : null}
        <YStack gap={md ? '$1' : '$0'}>{children}</YStack>
      </YStack>
      {md && showDivider ? <Divider mx="$5" /> : null}
    </YStack>
  );
}

function SettingsRow({
  label,
  children,
  onPress,
  testID,
}: {
  label: string;
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const interactive = Boolean(onPress);

  return (
    <XStack
      testID={testID}
      minHeight={38}
      mx="$2.5"
      px="$2.5"
      py="$1.5"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
      borderRadius="$3"
      role={interactive ? 'button' : undefined}
      cursor={interactive ? 'pointer' : undefined}
      hoverStyle={interactive ? { bg: '$bgHover' } : undefined}
      pressStyle={interactive ? { bg: '$bgActive' } : undefined}
      onPress={onPress}
    >
      <SizableText size="$bodyMdMedium" flex={1}>
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

function SettingsCheckboxRow({
  label,
  testID,
  value,
  disabled,
  children,
  onChange,
}: {
  label: string;
  testID?: string;
  value: boolean;
  disabled: boolean;
  children?: ReactNode;
  onChange: (value: boolean) => void;
}) {
  return (
    <XStack
      minHeight={38}
      mx="$2.5"
      px="$2.5"
      py="$1.5"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
    >
      <Checkbox
        testID={`trading-view-settings-checkbox-${
          testID ?? formatTestID(label)
        }`}
        label={label}
        value={value}
        disabled={disabled}
        labelProps={{ variant: '$bodyMdMedium' }}
        containerProps={{ alignItems: 'center' }}
        labelContainerProps={{ py: '$0', my: '$0', justifyContent: 'center' }}
        onChange={(checked) => onChange(Boolean(checked))}
      />
      {children}
    </XStack>
  );
}

function SettingsColorPicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker
      value={value}
      colors={CHART_COLOR_PALETTE}
      columns={5}
      triggerSize={32}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

function SettingsColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <XStack gap={label ? '$2' : '$0'} alignItems="center">
      {label ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {label}
        </SizableText>
      ) : null}
      <SettingsColorPicker
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </XStack>
  );
}

function SettingsPriceColorPicker({
  upColor,
  downColor,
  disabled,
  onChange,
}: {
  upColor: string;
  downColor: string;
  disabled: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <ColorPicker
      value={upColor}
      colors={CHART_COLOR_PALETTE}
      columns={5}
      triggerSize={32}
      disabled={disabled}
      renderTrigger={() => (
        <YStack
          width={32}
          height={32}
          p="$1"
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$2"
          bg="$bgStrong"
        >
          <YStack
            flex={1}
            borderRadius="$1"
            style={{
              background: `linear-gradient(45deg, ${downColor} 0 50%, ${upColor} 50% 100%)`,
            }}
          />
        </YStack>
      )}
      onChange={onChange}
    />
  );
}

function SettingsLineStylePreview({ style }: { style: 'solid' | 'dashed' }) {
  if (style === 'solid') {
    return <XStack width="$8" height={2} bg="$iconSubdued" />;
  }

  return (
    <XStack width="$8" gap="$0.5" alignItems="center">
      {Array.from({ length: 5 }).map((_, index) => (
        <XStack key={index} width="$1" height={2} bg="$iconSubdued" />
      ))}
    </XStack>
  );
}

function SettingsColorPair({
  item,
  disabled,
  onToggle,
  onColorChange,
}: {
  item: ITradingViewSettingsMockAppearanceItem;
  disabled: boolean;
  onToggle: (itemId: string, enabled: boolean) => void;
  onColorChange: (
    itemId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
}) {
  const intl = useIntl();
  const label =
    APPEARANCE_ITEM_TRANSLATION_IDS[item.id] !== undefined
      ? intl.formatMessage({
          id: APPEARANCE_ITEM_TRANSLATION_IDS[item.id],
        })
      : item.label;

  return (
    <SettingsCheckboxRow
      label={label}
      testID={item.id}
      value={item.enabled}
      disabled={disabled}
      onChange={(enabled) => onToggle(item.id, enabled)}
    >
      <XStack
        gap="$4"
        alignItems="center"
        opacity={item.enabled ? 1 : 0.5}
        pointerEvents={item.enabled && !disabled ? 'auto' : 'none'}
      >
        <SettingsColorField
          label={intl.formatMessage({
            id: ETranslations.market_chart_settings__up,
          })}
          value={item.upColor}
          disabled={disabled || !item.enabled}
          onChange={(color) => onColorChange(item.id, 'up', color)}
        />
        <SettingsColorField
          label={intl.formatMessage({
            id: ETranslations.market_chart_settings__down,
          })}
          value={item.downColor}
          disabled={disabled || !item.enabled}
          onChange={(color) => onColorChange(item.id, 'down', color)}
        />
      </XStack>
    </SettingsCheckboxRow>
  );
}

function SettingsSelect<TValue extends string>({
  testID,
  title,
  value,
  options,
  disabled,
  onChange,
  showLinePreview = false,
  renderOption,
  renderTriggerContent,
  optionTranslationIds,
}: {
  testID: string;
  title: string;
  value: TValue;
  options: readonly TValue[];
  disabled: boolean;
  onChange: (value: TValue) => void;
  showLinePreview?: boolean;
  renderOption?: (value: TValue) => ReactNode;
  renderTriggerContent?: (value: TValue) => ReactNode;
  optionTranslationIds?: Partial<Record<TValue, ETranslations>>;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { md } = useMedia();

  return (
    <Popover
      title={title}
      showHeader={md}
      open={disabled ? false : isOpen}
      onOpenChange={(nextOpen) => {
        if (!disabled) {
          setIsOpen(nextOpen);
        }
      }}
      placement="bottom-end"
      floatingPanelProps={{ width: 240 }}
      renderTrigger={
        <XStack
          testID={`trading-view-settings-select-${testID}`}
          gap="$1.5"
          alignItems="center"
          cursor={disabled ? 'default' : 'pointer'}
          opacity={disabled ? 0.5 : 1}
        >
          {renderTriggerContent
            ? renderTriggerContent(value)
            : (renderOption?.(value) ?? (
                <>
                  {showLinePreview ? (
                    <SettingsLineStylePreview
                      style={value as 'solid' | 'dashed'}
                    />
                  ) : null}
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {formatOptionLabel(intl, value, optionTranslationIds)}
                  </SizableText>
                </>
              ))}
          <Icon
            name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
            size="$4.5"
            color="$iconSubdued"
          />
        </XStack>
      }
      renderContent={({ closePopover }) => (
        <YStack p={md ? '$3' : '$1'} gap={md ? '$1' : '$0.5'}>
          {options.map((option) => {
            const selected = value === option;
            return (
              <XStack
                key={option}
                testID={`trading-view-settings-select-${testID}-${option}`}
                minHeight={md ? 48 : 36}
                px={md ? '$2.5' : '$2'}
                py={md ? '$2.5' : '$1.5'}
                alignItems="center"
                justifyContent="space-between"
                borderRadius="$2"
                cursor="pointer"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                onPress={() => {
                  onChange(option);
                  closePopover();
                }}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <XStack gap="$2" alignItems="center">
                    {showLinePreview ? (
                      <SettingsLineStylePreview
                        style={option as 'solid' | 'dashed'}
                      />
                    ) : null}
                    <SizableText size="$bodyMd">
                      {formatOptionLabel(intl, option, optionTranslationIds)}
                    </SizableText>
                  </XStack>
                )}
                {selected ? (
                  <Icon
                    name="CheckLargeOutline"
                    size="$4"
                    color="$iconActive"
                  />
                ) : null}
              </XStack>
            );
          })}
        </YStack>
      )}
    />
  );
}

function ChartSettingsNavigation({
  sections,
  selectedSectionId,
  disabled,
  compact,
  onSelect,
}: {
  sections: ITradingViewChartSettingsValue['appearanceSections'];
  selectedSectionId: ITradingViewSettingsMockAppearanceSectionId;
  disabled: boolean;
  compact: boolean;
  onSelect: (sectionId: ITradingViewSettingsMockAppearanceSectionId) => void;
}) {
  const intl = useIntl();

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        flexGrow={0}
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        contentContainerStyle={{
          px: '$4',
          py: '$2',
          gap: '$1',
        }}
      >
        {sections.map((section) => {
          const selected = section.id === selectedSectionId;
          return (
            <Button
              key={section.id}
              testID={`trading-view-settings-section-${section.id}`}
              size="medium"
              icon={section.icon}
              variant={selected ? 'secondary' : 'tertiary'}
              disabled={disabled}
              onPress={() => onSelect(section.id)}
            >
              {intl.formatMessage({
                id: NAVIGATION_TRANSLATION_IDS[section.id],
              })}
            </Button>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <DesktopTabItem
          key={section.id}
          testID={`trading-view-settings-section-${section.id}`}
          icon={section.icon}
          label={intl.formatMessage({
            id: NAVIGATION_TRANSLATION_IDS[section.id],
          })}
          selected={section.id === selectedSectionId}
          size="medium"
          showTooltip={false}
          pointerEvents={disabled ? 'none' : 'auto'}
          opacity={disabled ? 0.5 : 1}
          onPress={() => onSelect(section.id)}
        />
      ))}
    </>
  );
}

function PriceMovementColorSelector({
  value,
  disabled,
  onChange,
}: {
  value: ITradingViewChartSettingsValue;
  disabled: boolean;
  onChange: (priceColorMode: ITradingViewChartSettingsPriceColorMode) => void;
}) {
  const intl = useIntl();
  const renderOption = (
    priceColorMode: ITradingViewChartSettingsPriceColorMode,
  ) => {
    const greenUp = priceColorMode === 'greenUpRedDown';
    return (
      <XStack gap="$2" alignItems="center">
        <XStack gap="$0.5" alignItems="center">
          <Icon
            name="ArrowTopOutline"
            size="$4.5"
            color={greenUp ? '$iconSuccess' : '$iconCritical'}
          />
          <Icon
            name="ArrowBottomOutline"
            size="$4.5"
            color={greenUp ? '$iconCritical' : '$iconSuccess'}
          />
        </XStack>
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: greenUp
              ? ETranslations.market_chart_settings__green_up_red_down
              : ETranslations.market_chart_settings__red_up_green_down,
          })}
        </SizableText>
      </XStack>
    );
  };

  const renderTriggerContent = (
    priceColorMode: ITradingViewChartSettingsPriceColorMode,
  ) => {
    const greenUp = priceColorMode === 'greenUpRedDown';
    return (
      <XStack mr="$2" gap="$0.5" alignItems="center">
        <Icon
          name="ArrowTopOutline"
          size="$4.5"
          color={greenUp ? '$iconSuccess' : '$iconCritical'}
        />
        <Icon
          name="ArrowBottomOutline"
          size="$4.5"
          color={greenUp ? '$iconCritical' : '$iconSuccess'}
        />
      </XStack>
    );
  };

  return (
    <SettingsSelect
      testID="price-change-colors"
      title={intl.formatMessage({
        id: ETranslations.market_chart_settings__price_change_colors,
      })}
      value={value.priceColorMode}
      options={['greenUpRedDown', 'redUpGreenDown']}
      disabled={disabled}
      renderOption={renderOption}
      renderTriggerContent={renderTriggerContent}
      onChange={onChange}
    />
  );
}

export type ITradingViewChartSettingsProps = {
  /** Use value for controlled committed state, or defaultValue for local state. */
  value?: ITradingViewChartSettingsValue;
  defaultValue?: ITradingViewChartSettingsValue;
  isSubmitting?: boolean;
  /** Called when the editable draft changes. */
  onChange?: (value: ITradingViewChartSettingsValue) => void;
  /** Receives the complete value after the user confirms the draft. */
  onConfirm?: (value: ITradingViewChartSettingsValue) => void | Promise<void>;
  /** Called when the external confirmation fails. */
  onConfirmError?: (error: unknown) => void;
  onCancel?: () => void;
  onClose?: () => void;
  /** Render the actions through the surrounding OneKey modal page. */
  usePageFooter?: boolean;
  /** Render the mobile settings as a single vertically scrolling list. */
  mobileLayout?: boolean;
};

export function TradingViewChartSettings({
  value,
  defaultValue,
  isSubmitting = false,
  onChange,
  onConfirm,
  onConfirmError,
  onCancel,
  onClose,
  usePageFooter = false,
  mobileLayout = false,
}: ITradingViewChartSettingsProps) {
  const intl = useIntl();
  const { md } = useMedia();
  const { height: windowHeight } = useWindowDimensions();
  const dialogHeight = Math.min(600, Math.max(windowHeight - 32, 420));
  const [
    settingsValue,
    updateSettingsValue,
    commitSettingsValue,
    cancelSettingsValue,
  ] = useSettingsDraftValue({
    value,
    defaultValue,
    createDefaultValue: createTradingViewChartSettingsValue,
    onChange,
  });
  const [selectedAppearanceSectionId, setSelectedAppearanceSectionId] =
    useState<ITradingViewSettingsMockAppearanceSectionId>('candles');
  const [isConfirming, setIsConfirming] = useState(false);
  const submitInProgress = isSubmitting || isConfirming;

  const selectedAppearanceSection = useMemo(
    () =>
      settingsValue.appearanceSections.find(
        (section) => section.id === selectedAppearanceSectionId,
      ) ?? settingsValue.appearanceSections[0],
    [selectedAppearanceSectionId, settingsValue.appearanceSections],
  );

  const handleReset = useCallback(() => {
    updateSettingsValue(() => createTradingViewChartSettingsValue());
  }, [updateSettingsValue]);

  const handleOptionChange = useCallback(
    (key: keyof ITradingViewChartSettingsOptions, checked: boolean) => {
      updateSettingsValue((currentValue) => ({
        ...currentValue,
        options: {
          ...currentValue.options,
          [key]: checked,
        },
      }));
    },
    [updateSettingsValue],
  );

  const handleToggleAppearanceItem = useCallback(
    (itemId: string, enabled: boolean) => {
      updateSettingsValue((currentValue) =>
        toggleTradingViewSettingsMockAppearanceItem(
          currentValue,
          itemId,
          enabled,
        ),
      );
    },
    [updateSettingsValue],
  );

  const handleAppearanceItemColorChange = useCallback(
    (
      itemId: string,
      role: ITradingViewSettingsMockColorRole,
      color: string,
    ) => {
      updateSettingsValue((currentValue) =>
        updateTradingViewSettingsMockAppearanceItemColor(
          currentValue,
          itemId,
          role,
          color,
        ),
      );
    },
    [updateSettingsValue],
  );

  const handleCancel = () => {
    cancelSettingsValue();
    onCancel?.();
  };

  const handleClose = () => {
    handleCancel();
    onClose?.();
  };

  const handleConfirm = async () => {
    if (submitInProgress) {
      return false;
    }

    setIsConfirming(true);
    try {
      await onConfirm?.(settingsValue);
      commitSettingsValue();
      return true;
    } catch (error) {
      onConfirmError?.(error);
      return false;
    } finally {
      setIsConfirming(false);
    }
  };

  const renderCandleSettings = () => (
    <YStack>
      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_settings__color_preferences,
        })}
      >
        <SettingsRow
          label={intl.formatMessage({
            id: ETranslations.market_chart_settings__price_change_colors,
          })}
        >
          <PriceMovementColorSelector
            value={settingsValue}
            disabled={submitInProgress}
            onChange={(priceColorMode) => {
              updateSettingsValue((currentValue) =>
                applyChartTrendColors(currentValue, priceColorMode),
              );
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_settings__candles,
        })}
      >
        {(selectedAppearanceSection?.items ?? []).map((item) => (
          <SettingsColorPair
            key={item.id}
            item={item}
            disabled={submitInProgress}
            onToggle={handleToggleAppearanceItem}
            onColorChange={handleAppearanceItemColorChange}
          />
        ))}
      </SettingsGroup>
    </YStack>
  );

  const renderCoordinateSettings = () => (
    <YStack>
      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_settings__price_scales,
        })}
      >
        {(['countdown', 'depth', 'priceChange'] as const).map((option) => (
          <SettingsCheckboxRow
            key={option}
            label={intl.formatMessage({
              id: OPTION_TRANSLATION_IDS[option],
            })}
            testID={option}
            value={settingsValue.options[option]}
            disabled={submitInProgress}
            onChange={(checked) => handleOptionChange(option, checked)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_settings__price_label_and_line,
        })}
      >
        <SettingsCheckboxRow
          label={intl.formatMessage({
            id: OPTION_TRANSLATION_IDS.latestPrice,
          })}
          testID="latest-price"
          value={settingsValue.options.latestPrice}
          disabled={submitInProgress}
          onChange={(checked) => handleOptionChange('latestPrice', checked)}
        >
          <XStack
            gap="$3"
            alignItems="center"
            opacity={settingsValue.options.latestPrice ? 1 : 0.5}
          >
            <SettingsSelect
              testID="latest-price-line-style"
              title={intl.formatMessage({
                id: ETranslations.market_chart_settings__line_style,
              })}
              value={settingsValue.latestPriceLine.style}
              options={['solid', 'dashed']}
              disabled={submitInProgress || !settingsValue.options.latestPrice}
              showLinePreview
              onChange={(style) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  latestPriceLine: {
                    ...currentValue.latestPriceLine,
                    style,
                  },
                }));
              }}
            />
            <SettingsPriceColorPicker
              upColor={settingsValue.latestPriceLine.upColor}
              downColor={settingsValue.latestPriceLine.downColor}
              disabled={submitInProgress || !settingsValue.options.latestPrice}
              onChange={(color) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  latestPriceLine: {
                    ...currentValue.latestPriceLine,
                    upColor: color,
                    downColor: color,
                  },
                }));
              }}
            />
          </XStack>
        </SettingsCheckboxRow>
      </SettingsGroup>
    </YStack>
  );

  const renderEventSettings = () => (
    <YStack>
      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_settings__economic_calendar,
        })}
      >
        {(['futureEvents', 'pastEvents'] as const).map((option) => (
          <SettingsCheckboxRow
            key={option}
            label={intl.formatMessage({
              id: OPTION_TRANSLATION_IDS[option],
            })}
            testID={option}
            value={settingsValue.options[option]}
            disabled={submitInProgress}
            onChange={(checked) => handleOptionChange(option, checked)}
          />
        ))}
      </SettingsGroup>
    </YStack>
  );

  const renderLayoutSettings = () => (
    <YStack>
      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_settings__chart_interface,
        })}
      >
        <SettingsCheckboxRow
          label={intl.formatMessage({
            id: OPTION_TRANSLATION_IDS.clickInteraction,
          })}
          testID="click-interaction"
          value={settingsValue.options.clickInteraction}
          disabled={submitInProgress}
          onChange={(checked) =>
            handleOptionChange('clickInteraction', checked)
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title={intl.formatMessage({
          id: ETranslations.market_chart_style,
        })}
        showDivider={false}
      >
        <SettingsRow
          label={intl.formatMessage({
            id: ETranslations.market_chart_settings__background,
          })}
        >
          <XStack gap="$3" alignItems="center">
            <SettingsSelect
              testID="background-style"
              title={intl.formatMessage({
                id: ETranslations.market_chart_settings__background_style,
              })}
              value={settingsValue.background.style}
              options={['solid', 'gradient']}
              disabled={submitInProgress}
              optionTranslationIds={{
                solid: ETranslations.market_chart_settings__solid_color,
                gradient: ETranslations.market_chart_settings__gradient,
              }}
              onChange={(style) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  background: {
                    ...currentValue.background,
                    style,
                  },
                }));
              }}
            />
            <SettingsColorField
              label=""
              value={settingsValue.background.colors[0]}
              disabled={submitInProgress}
              onChange={(color) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  background: {
                    ...currentValue.background,
                    colors: [color, currentValue.background.colors[1]],
                  },
                }));
              }}
            />
            {settingsValue.background.style === 'gradient' ? (
              <SettingsColorField
                label=""
                value={settingsValue.background.colors[1]}
                disabled={submitInProgress}
                onChange={(color) => {
                  updateSettingsValue((currentValue) => ({
                    ...currentValue,
                    background: {
                      ...currentValue.background,
                      colors: [currentValue.background.colors[0], color],
                    },
                  }));
                }}
              />
            ) : null}
          </XStack>
        </SettingsRow>

        <SettingsRow
          label={intl.formatMessage({
            id: ETranslations.market_chart_settings__grid_lines,
          })}
        >
          <XStack gap="$3" alignItems="center">
            <SettingsSelect
              testID="grid-lines"
              title={intl.formatMessage({
                id: ETranslations.market_chart_settings__grid_lines,
              })}
              value={settingsValue.grid.style}
              options={['both', 'horizontal', 'vertical', 'none']}
              disabled={submitInProgress}
              onChange={(style) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  grid: {
                    ...currentValue.grid,
                    style,
                  },
                }));
              }}
            />
            {['both', 'horizontal'].includes(settingsValue.grid.style) ? (
              <SettingsColorField
                label=""
                value={settingsValue.grid.horizontalColor}
                disabled={submitInProgress}
                onChange={(horizontalColor) => {
                  updateSettingsValue((currentValue) => ({
                    ...currentValue,
                    grid: {
                      ...currentValue.grid,
                      horizontalColor,
                    },
                  }));
                }}
              />
            ) : null}
            {['both', 'vertical'].includes(settingsValue.grid.style) ? (
              <SettingsColorField
                label=""
                value={settingsValue.grid.verticalColor}
                disabled={submitInProgress}
                onChange={(verticalColor) => {
                  updateSettingsValue((currentValue) => ({
                    ...currentValue,
                    grid: {
                      ...currentValue.grid,
                      verticalColor,
                    },
                  }));
                }}
              />
            ) : null}
          </XStack>
        </SettingsRow>

        <SettingsCheckboxRow
          label={intl.formatMessage({
            id: OPTION_TRANSLATION_IDS.crossLine,
          })}
          testID="crosshair"
          value={settingsValue.options.crossLine}
          disabled={submitInProgress}
          onChange={(checked) => handleOptionChange('crossLine', checked)}
        >
          <XStack
            gap="$3"
            alignItems="center"
            opacity={settingsValue.options.crossLine ? 1 : 0.5}
          >
            <SettingsSelect
              testID="crosshair-line-style"
              title={intl.formatMessage({
                id: ETranslations.market_chart_settings__crosshair_line_style,
              })}
              value={settingsValue.crossLine.style}
              options={['solid', 'dashed']}
              disabled={submitInProgress || !settingsValue.options.crossLine}
              showLinePreview
              onChange={(style) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  crossLine: {
                    ...currentValue.crossLine,
                    style,
                  },
                }));
              }}
            />
            <SettingsColorPicker
              value={settingsValue.crossLine.color}
              disabled={submitInProgress || !settingsValue.options.crossLine}
              onChange={(color) => {
                updateSettingsValue((currentValue) => ({
                  ...currentValue,
                  crossLine: {
                    ...currentValue.crossLine,
                    color,
                  },
                }));
              }}
            />
          </XStack>
        </SettingsCheckboxRow>
      </SettingsGroup>
    </YStack>
  );

  const renderSettingsContent = () => {
    if (selectedAppearanceSectionId === 'candles') {
      return renderCandleSettings();
    }
    if (selectedAppearanceSectionId === 'coordinates') {
      return renderCoordinateSettings();
    }
    if (selectedAppearanceSectionId === 'events') {
      return renderEventSettings();
    }
    return renderLayoutSettings();
  };

  const handleSectionSelect = (
    sectionId: ITradingViewSettingsMockAppearanceSectionId,
  ) => {
    setSelectedAppearanceSectionId(sectionId);
  };

  const resetButton = (
    <Button
      testID="trading-view-settings-mock-reset"
      size="medium"
      icon="RotateCounterclockwiseOutline"
      variant="tertiary"
      disabled={submitInProgress}
      onPress={handleReset}
    >
      {intl.formatMessage({ id: ETranslations.global_reset })}
    </Button>
  );

  const settingsBody = (
    <XStack flex={1} minHeight={0} flexDirection={md ? 'column' : 'row'}>
      {md ? (
        <ChartSettingsNavigation
          sections={settingsValue.appearanceSections}
          selectedSectionId={selectedAppearanceSectionId}
          disabled={submitInProgress}
          compact
          onSelect={handleSectionSelect}
        />
      ) : (
        <YStack
          width={192}
          flexShrink={0}
          px="$3"
          py="$4"
          gap="$1"
          borderRightWidth="$px"
          borderRightColor="$neutral3"
        >
          <ChartSettingsNavigation
            sections={settingsValue.appearanceSections}
            selectedSectionId={selectedAppearanceSectionId}
            disabled={submitInProgress}
            compact={false}
            onSelect={handleSectionSelect}
          />
        </YStack>
      )}

      <ScrollView
        flex={1}
        minHeight={0}
        contentContainerStyle={{
          pb: '$5',
        }}
      >
        {renderSettingsContent()}
      </ScrollView>
    </XStack>
  );

  const mobileSettingsBody = (
    <ScrollView
      testID="trading-view-chart-settings-mobile"
      flex={1}
      minHeight={0}
      contentContainerStyle={{
        pb: '$8',
      }}
    >
      {renderCandleSettings()}
      {renderCoordinateSettings()}
      {renderEventSettings()}
      {renderLayoutSettings()}
    </ScrollView>
  );

  if (mobileLayout) {
    return mobileSettingsBody;
  }

  if (usePageFooter) {
    return (
      <>
        <Page.Footer>
          <Page.FooterActions
            onCancel={(close) => {
              handleCancel();
              close({ flag: 'cancel' });
            }}
            onConfirm={(close) => {
              void handleConfirm().then((confirmed) => {
                if (confirmed) {
                  close({ flag: 'confirm' });
                }
              });
            }}
            cancelButtonProps={{
              disabled: submitInProgress,
            }}
            confirmButtonProps={{
              disabled: submitInProgress,
            }}
          >
            {resetButton}
          </Page.FooterActions>
        </Page.Footer>
        <XStack
          testID="trading-view-chart-settings-dialog"
          width="100%"
          flex={1}
          minHeight={0}
        >
          {settingsBody}
        </XStack>
      </>
    );
  }

  return (
    <YStack
      testID="trading-view-chart-settings-dialog"
      width="100%"
      maxWidth={640}
      height={dialogHeight}
      maxHeight="100%"
      overflow="hidden"
      borderWidth={md ? 0 : '$px'}
      borderColor="$borderSubdued"
      borderRadius={md ? 0 : '$5'}
      borderCurve="continuous"
      bg="$bgApp"
    >
      <XStack
        minHeight={64}
        px="$6"
        alignItems="center"
        justifyContent="space-between"
      >
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.market_chart_settings,
          })}
        </SizableText>
        <IconButton
          testID="trading-view-settings-close"
          title={intl.formatMessage({ id: ETranslations.global_cancel })}
          icon="CrossedSmallOutline"
          variant="tertiary"
          disabled={submitInProgress}
          onPress={handleClose}
        />
      </XStack>

      {settingsBody}
      <XStack
        minHeight={72}
        px="$6"
        py="$3"
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        bg="$bgApp"
      >
        {resetButton}
        <XStack gap="$3">
          <Button
            testID="trading-view-settings-mock-cancel"
            size="medium"
            variant="secondary"
            disabled={submitInProgress}
            onPress={handleCancel}
          >
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
          <Button
            testID="trading-view-settings-mock-confirm"
            size="medium"
            variant="primary"
            loading={submitInProgress}
            disabled={submitInProgress}
            onPress={() => void handleConfirm()}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </XStack>
      </XStack>
    </YStack>
  );
}

export function TradingViewChartSettingsMockGallery() {
  return <TradingViewChartSettings />;
}
