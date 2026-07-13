import { useCallback, useMemo, useState } from 'react';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  AppearanceCandleSettingsContent,
  AppearanceCoordinatesSettingsContent,
  AppearanceEventsSettingsContent,
  AppearanceLayoutSettingsContent,
  AppearanceSidebar,
  applyOkxChartTrendColors,
} from './TradingViewChartAppearance';
import { OkxChartColorSettingsPanel } from './TradingViewChartColorSettings';
import {
  createTradingViewChartSettingsValue,
  toggleTradingViewSettingsMockAppearanceItem,
  updateTradingViewSettingsMockAppearanceItemColor,
} from './TradingViewSettingsMockState';
import {
  OKX_CHART_BG,
  OKX_CHART_BORDER,
  OKX_CHART_DIVIDER,
  OKX_CHART_TEXT,
  useSettingsDraftValue,
} from './TradingViewSettingsShared';

import type {
  ITradingViewChartSettingsOptions,
  ITradingViewChartSettingsValue,
  ITradingViewSettingsMockAppearanceSectionId,
} from './TradingViewSettingsMockState';

const OKX_CHART_SETTINGS_WIDTH = 552;
const OKX_CHART_SETTINGS_HEIGHT = 517;
const OKX_CHART_HEADER_HEIGHT = 49;
const OKX_CHART_BODY_HEIGHT = 400;
const OKX_CHART_FOOTER_HEIGHT = 66;
const OKX_CHART_SIDEBAR_WIDTH = 130;

export type ITradingViewChartSettingsProps = {
  /** Use value for controlled committed state, or defaultValue for local state. */
  value?: ITradingViewChartSettingsValue;
  defaultValue?: ITradingViewChartSettingsValue;
  isSubmitting?: boolean;
  /** Called when the editable draft changes. */
  onChange?: (value: ITradingViewChartSettingsValue) => void;
  /** Receives the complete value after the user confirms the draft. */
  onConfirm?: (value: ITradingViewChartSettingsValue) => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
};

export function TradingViewChartSettings({
  value,
  defaultValue,
  isSubmitting = false,
  onChange,
  onConfirm,
  onCancel,
  onClose,
}: ITradingViewChartSettingsProps) {
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
  const [contentResetVersion, setContentResetVersion] = useState(0);
  const [isColorSettingsPanelOpen, setIsColorSettingsPanelOpen] =
    useState(false);

  const selectedAppearanceSection = useMemo(
    () =>
      settingsValue.appearanceSections.find(
        (section) => section.id === selectedAppearanceSectionId,
      ) ?? settingsValue.appearanceSections[0],
    [selectedAppearanceSectionId, settingsValue.appearanceSections],
  );

  const handleReset = useCallback(() => {
    updateSettingsValue(() => createTradingViewChartSettingsValue());
    setContentResetVersion((currentVersion) => currentVersion + 1);
    setIsColorSettingsPanelOpen(false);
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

  const renderAppearanceContent = () => {
    if (selectedAppearanceSectionId === 'candles') {
      return (
        <AppearanceCandleSettingsContent
          key={contentResetVersion}
          items={selectedAppearanceSection?.items ?? []}
          colorMode={settingsValue.colorMode}
          priceColorMode={settingsValue.priceColorMode}
          onOpenColorSettings={() => setIsColorSettingsPanelOpen(true)}
          onToggleItem={(itemId, enabled) => {
            updateSettingsValue((currentValue) =>
              toggleTradingViewSettingsMockAppearanceItem(
                currentValue,
                itemId,
                enabled,
              ),
            );
          }}
          onColorChange={(itemId, role, color) => {
            updateSettingsValue((currentValue) =>
              updateTradingViewSettingsMockAppearanceItemColor(
                currentValue,
                itemId,
                role,
                color,
              ),
            );
          }}
        />
      );
    }

    if (selectedAppearanceSectionId === 'coordinates') {
      return (
        <AppearanceCoordinatesSettingsContent
          key={contentResetVersion}
          optionState={settingsValue.options}
          latestPriceLine={settingsValue.latestPriceLine}
          onOptionChange={handleOptionChange}
          onLatestPriceColorChange={(upColor, downColor) => {
            updateSettingsValue((currentValue) => ({
              ...currentValue,
              latestPriceLine: {
                ...currentValue.latestPriceLine,
                upColor,
                downColor,
              },
            }));
          }}
          onLatestPriceLineStyleChange={(style) => {
            updateSettingsValue((currentValue) => ({
              ...currentValue,
              latestPriceLine: {
                ...currentValue.latestPriceLine,
                style,
              },
            }));
          }}
        />
      );
    }

    if (selectedAppearanceSectionId === 'events') {
      return (
        <AppearanceEventsSettingsContent
          key={contentResetVersion}
          optionState={settingsValue.options}
          onOptionChange={handleOptionChange}
        />
      );
    }

    return (
      <AppearanceLayoutSettingsContent
        key={contentResetVersion}
        optionState={settingsValue.options}
        background={settingsValue.background}
        grid={settingsValue.grid}
        crossLine={settingsValue.crossLine}
        onOptionChange={handleOptionChange}
        onBackgroundStyleChange={(style) => {
          updateSettingsValue((currentValue) => ({
            ...currentValue,
            background: {
              ...currentValue.background,
              style,
            },
          }));
        }}
        onBackgroundColorChange={(index, color) => {
          updateSettingsValue((currentValue) => {
            const colors: [string, string] = [
              ...currentValue.background.colors,
            ];
            colors[index] = color;
            return {
              ...currentValue,
              background: {
                ...currentValue.background,
                colors,
              },
            };
          });
        }}
        onGridStyleChange={(style) => {
          updateSettingsValue((currentValue) => ({
            ...currentValue,
            grid: {
              ...currentValue.grid,
              style,
            },
          }));
        }}
        onGridColorChange={(role, color) => {
          updateSettingsValue((currentValue) => ({
            ...currentValue,
            grid: {
              ...currentValue.grid,
              [role]: color,
            },
          }));
        }}
        onCrossLineColorChange={(color) => {
          updateSettingsValue((currentValue) => ({
            ...currentValue,
            crossLine: {
              ...currentValue.crossLine,
              color,
            },
          }));
        }}
        onCrossLineStyleChange={(style) => {
          updateSettingsValue((currentValue) => ({
            ...currentValue,
            crossLine: {
              ...currentValue.crossLine,
              style,
            },
          }));
        }}
      />
    );
  };

  const handleCancel = () => {
    cancelSettingsValue();
    onCancel?.();
  };

  const handleClose = () => {
    handleCancel();
    onClose?.();
  };

  const handleConfirm = () => {
    commitSettingsValue();
    void onConfirm?.(settingsValue);
  };

  return (
    <YStack
      testID="trading-view-chart-settings-okx-dialog"
      w={OKX_CHART_SETTINGS_WIDTH}
      h={OKX_CHART_SETTINGS_HEIGHT}
      position="relative"
      overflow="visible"
      borderWidth={1}
      borderColor={OKX_CHART_BORDER}
      borderRadius={0}
      bg={OKX_CHART_BG}
    >
      <XStack
        h={OKX_CHART_HEADER_HEIGHT}
        px={24}
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor={OKX_CHART_BORDER}
      >
        <SizableText
          fontSize={16}
          lineHeight={22}
          fontWeight="700"
          color={OKX_CHART_TEXT}
        >
          图表设置
        </SizableText>
        <Stack
          w={28}
          h={28}
          alignItems="center"
          justifyContent="center"
          cursor={isSubmitting ? 'default' : 'pointer'}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
          onPress={handleClose}
        >
          <Icon name="CrossedSmallOutline" size="$5" color="$icon" />
        </Stack>
      </XStack>

      <XStack h={OKX_CHART_BODY_HEIGHT} minHeight={0}>
        <Stack
          w={OKX_CHART_SIDEBAR_WIDTH}
          position="relative"
          bg={OKX_CHART_BG}
        >
          <AppearanceSidebar
            sections={settingsValue.appearanceSections}
            selectedSectionId={selectedAppearanceSectionId}
            onSelect={(sectionId) => {
              setIsColorSettingsPanelOpen(false);
              setSelectedAppearanceSectionId(sectionId);
            }}
          />
          <Stack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            w={1}
            zIndex={2}
            bg={OKX_CHART_DIVIDER}
            pointerEvents="none"
          />
        </Stack>

        <Stack flex={1} bg={OKX_CHART_BG}>
          {renderAppearanceContent()}
        </Stack>
      </XStack>

      {isColorSettingsPanelOpen ? (
        <OkxChartColorSettingsPanel
          colorMode={settingsValue.colorMode}
          priceColorMode={settingsValue.priceColorMode}
          onColorModeChange={(colorMode) => {
            updateSettingsValue((currentValue) =>
              applyOkxChartTrendColors(
                currentValue,
                colorMode,
                currentValue.priceColorMode,
              ),
            );
          }}
          onPriceColorModeChange={(priceColorMode) => {
            updateSettingsValue((currentValue) =>
              applyOkxChartTrendColors(
                currentValue,
                currentValue.colorMode,
                priceColorMode,
              ),
            );
          }}
          onClose={() => setIsColorSettingsPanelOpen(false)}
        />
      ) : null}

      <XStack
        h={OKX_CHART_FOOTER_HEIGHT}
        alignItems="center"
        justifyContent="space-between"
        borderTopWidth={1}
        borderTopColor={OKX_CHART_BORDER}
        bg={OKX_CHART_BG}
      >
        <XStack
          testID="trading-view-settings-mock-reset"
          h={41}
          w={90}
          ml={24}
          gap={8}
          alignItems="center"
          justifyContent="center"
          borderRadius={20}
          cursor={isSubmitting ? 'default' : 'pointer'}
          opacity={isSubmitting ? 0.5 : 1}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
          userSelect="none"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={handleReset}
        >
          <Icon name="RotateCounterclockwiseOutline" size="$5" color="$icon" />
          <SizableText fontSize={15} lineHeight={20} color={OKX_CHART_TEXT}>
            重置
          </SizableText>
        </XStack>

        <XStack mr={24} gap={12} alignItems="center">
          <XStack
            testID="trading-view-settings-mock-cancel"
            w={81}
            h={36}
            alignItems="center"
            justifyContent="center"
            borderRadius={18}
            borderWidth={1}
            borderColor="$borderStrong"
            bg={OKX_CHART_BG}
            cursor={isSubmitting ? 'default' : 'pointer'}
            opacity={isSubmitting ? 0.5 : 1}
            pointerEvents={isSubmitting ? 'none' : 'auto'}
            onPress={handleCancel}
          >
            <SizableText
              fontSize={14}
              lineHeight={20}
              fontWeight="600"
              color={OKX_CHART_TEXT}
            >
              取消
            </SizableText>
          </XStack>
          <XStack
            testID="trading-view-settings-mock-confirm"
            w={81}
            h={36}
            alignItems="center"
            justifyContent="center"
            borderRadius={18}
            bg="$bgInverse"
            cursor={isSubmitting ? 'default' : 'pointer'}
            opacity={isSubmitting ? 0.5 : 1}
            pointerEvents={isSubmitting ? 'none' : 'auto'}
            onPress={handleConfirm}
          >
            <SizableText
              fontSize={14}
              lineHeight={20}
              fontWeight="600"
              color="$textInverse"
            >
              确认
            </SizableText>
          </XStack>
        </XStack>
      </XStack>
    </YStack>
  );
}

export function TradingViewChartSettingsMockGallery() {
  return <TradingViewChartSettings />;
}
