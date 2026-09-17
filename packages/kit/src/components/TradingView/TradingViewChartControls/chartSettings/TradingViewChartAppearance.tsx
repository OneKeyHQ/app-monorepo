import { useState } from 'react';
import type { ReactNode } from 'react';

import type { IIconProps } from '@onekeyhq/components';
import {
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_CHART_BG,
  TRADING_VIEW_CHART_DOWN,
  TRADING_VIEW_CHART_SIDE_ACTIVE_BG,
  TRADING_VIEW_CHART_TEXT,
  TRADING_VIEW_CHART_TEXT_SUBDUED,
  TRADING_VIEW_CHART_UP,
  TradingViewChartCheckbox,
  TradingViewChartColorPalette,
  TradingViewChartColorPicker,
  TradingViewChartSelectMock,
  TradingViewChartSolidSwatch,
} from './TradingViewSettingsShared';
import {
  resolveTradingViewSettingsThemeColor,
  useTradingViewSettingsThemeColors,
} from './TradingViewSettingsThemeColors';

import type {
  ITradingViewChartSettingsBackgroundStyle,
  ITradingViewChartSettingsColorMode,
  ITradingViewChartSettingsGridStyle,
  ITradingViewChartSettingsLineStyle,
  ITradingViewChartSettingsOptions,
  ITradingViewChartSettingsPriceColorMode,
  ITradingViewChartSettingsValue,
  ITradingViewSettingsMockAppearanceItem,
  ITradingViewSettingsMockAppearanceSection,
  ITradingViewSettingsMockAppearanceSectionId,
  ITradingViewSettingsMockColorRole,
} from './TradingViewSettingsMockState';

const TRADING_VIEW_CHART_SIDEBAR_WIDTH = 130;
const TRADING_VIEW_LINE_STYLE_OPTIONS = ['实线', '虚线'];
const TRADING_VIEW_BACKGROUND_STYLE_OPTIONS = ['实色', '渐变'];
const TRADING_VIEW_GRID_LINE_OPTIONS = ['垂直和水平', '仅水平', '仅垂直', '无'];

export function AppearanceSidebar({
  sections,
  selectedSectionId,
  onSelect,
}: {
  sections: ITradingViewSettingsMockAppearanceSection[];
  selectedSectionId: ITradingViewSettingsMockAppearanceSectionId;
  onSelect: (sectionId: ITradingViewSettingsMockAppearanceSectionId) => void;
}) {
  return (
    <YStack
      w={TRADING_VIEW_CHART_SIDEBAR_WIDTH}
      pt={12}
      bg={TRADING_VIEW_CHART_BG}
    >
      {sections.map((section) => {
        const selected = section.id === selectedSectionId;
        return (
          <XStack
            key={section.id}
            h={40}
            px={20}
            gap={9}
            alignItems="center"
            bg={
              selected
                ? TRADING_VIEW_CHART_SIDE_ACTIVE_BG
                : TRADING_VIEW_CHART_BG
            }
            hoverStyle={{
              bg: selected ? TRADING_VIEW_CHART_SIDE_ACTIVE_BG : '$bgHover',
            }}
            pressStyle={{ bg: TRADING_VIEW_CHART_SIDE_ACTIVE_BG }}
            cursor="pointer"
            userSelect="none"
            onPress={() => onSelect(section.id)}
          >
            <Icon
              name={getTradingViewAppearanceSectionIcon(section.id)}
              size="$5"
              color="$icon"
            />
            <SizableText
              fontSize={14}
              lineHeight={16}
              color={TRADING_VIEW_CHART_TEXT}
              numberOfLines={1}
            >
              {getTradingViewAppearanceSectionLabel(section.id)}
            </SizableText>
          </XStack>
        );
      })}
    </YStack>
  );
}

function getTradingViewAppearanceSectionLabel(
  sectionId: ITradingViewSettingsMockAppearanceSectionId,
) {
  const labelMap: Record<ITradingViewSettingsMockAppearanceSectionId, string> =
    {
      candles: 'K线',
      coordinates: '坐标',
      events: '事件',
      layout: '版面',
    };

  return labelMap[sectionId];
}

function getTradingViewAppearanceSectionIcon(
  sectionId: ITradingViewSettingsMockAppearanceSectionId,
): IIconProps['name'] {
  const iconMap: Record<
    ITradingViewSettingsMockAppearanceSectionId,
    IIconProps['name']
  > = {
    candles: 'TradingViewCandlesOutline',
    coordinates: 'RandomCrossoverOutline',
    events: 'EarthOutline',
    layout: 'PencilOutline',
  };

  return iconMap[sectionId];
}

function getTradingViewAppearanceItemLabel(itemId: string) {
  const labelMap: Record<string, string> = {
    body: '主体',
    border: '边框',
    wick: '影线',
    crosshair: '十字光标',
    'price-label': '价格标签',
    orders: '订单',
    fills: '成交',
    background: '背景',
    grid: '网格',
  };

  return labelMap[itemId] ?? itemId;
}

function TradingViewChartSectionTitle({ children }: { children: ReactNode }) {
  return (
    <SizableText
      h={12}
      fontSize={12}
      lineHeight={12}
      color={TRADING_VIEW_CHART_TEXT_SUBDUED}
    >
      {children}
    </SizableText>
  );
}

function TradingViewChartSettingRow({ children }: { children: ReactNode }) {
  return (
    <XStack h={50} w={380} alignItems="center">
      {children}
    </XStack>
  );
}

function TradingViewChartRowLabel({ children }: { children: ReactNode }) {
  return (
    <SizableText fontSize={14} lineHeight={16} color={TRADING_VIEW_CHART_TEXT}>
      {children}
    </SizableText>
  );
}

function TradingViewChartCheckboxWithLabel({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <XStack h={20} alignItems="center">
      <TradingViewChartCheckbox checked={checked} onChange={onChange} />
      <SizableText
        ml={8}
        fontSize={14}
        lineHeight={16}
        color={TRADING_VIEW_CHART_TEXT}
      >
        {children}
      </SizableText>
    </XStack>
  );
}

function TradingViewChartPriceSwatch({
  upColor,
  downColor,
  open,
  onOpenChange,
  onChange,
}: {
  upColor: string;
  downColor: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (upColor: string, downColor: string) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const themeColors = useTradingViewSettingsThemeColors();
  const resolvedUpColor = resolveTradingViewSettingsThemeColor(
    upColor,
    themeColors,
  );
  const resolvedDownColor = resolveTradingViewSettingsThemeColor(
    downColor,
    themeColors,
  );
  const isPaletteOpen = open ?? uncontrolledOpen;
  const setIsPaletteOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <Stack position="relative" zIndex={isPaletteOpen ? 30 : 1}>
      <Stack
        w={30}
        h={30}
        alignItems="center"
        justifyContent="center"
        borderRadius={5}
        borderWidth={1}
        borderColor="$borderSubdued"
        bg="$bgStrong"
        hoverStyle={{ borderColor: '$borderStrong', opacity: 0.86 }}
        pressStyle={{ opacity: 0.7 }}
        cursor="pointer"
        onPress={() => setIsPaletteOpen(!isPaletteOpen)}
      >
        <LinearGradient
          w={22}
          h={22}
          overflow="hidden"
          borderRadius={2}
          colors={[
            resolvedDownColor,
            resolvedDownColor,
            resolvedUpColor,
            resolvedUpColor,
          ]}
          locations={[0, 0.5, 0.5, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
        />
      </Stack>

      {isPaletteOpen ? (
        <TradingViewChartColorPalette
          placement="bottom"
          align="left"
          selectedColor={upColor === downColor ? upColor : ''}
          onSelect={(color) => {
            // Choosing a swatch replaces the automatic two-color state.
            onChange(color, color);
            setIsPaletteOpen(false);
          }}
        />
      ) : null}
    </Stack>
  );
}

function getTradingViewChartTrendColors(
  colorMode: ITradingViewChartSettingsColorMode,
  priceColorMode: ITradingViewChartSettingsPriceColorMode,
) {
  const positiveColor =
    colorMode === 'modern'
      ? TRADING_VIEW_NATIVE_THEME_COLORS.brand
      : TRADING_VIEW_CHART_UP;
  const negativeColor =
    colorMode === 'modern'
      ? TRADING_VIEW_NATIVE_THEME_COLORS.quaternary
      : TRADING_VIEW_CHART_DOWN;

  if (priceColorMode === 'greenUpRedDown') {
    return {
      upColor: positiveColor,
      downColor: negativeColor,
    };
  }

  return {
    upColor: negativeColor,
    downColor: positiveColor,
  };
}

export function applyTradingViewChartTrendColors(
  value: ITradingViewChartSettingsValue,
  colorMode: ITradingViewChartSettingsColorMode,
  priceColorMode: ITradingViewChartSettingsPriceColorMode,
): ITradingViewChartSettingsValue {
  const trendColors = getTradingViewChartTrendColors(colorMode, priceColorMode);

  return {
    ...value,
    colorMode,
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

function AppearanceColorPair({
  item,
  onColorChange,
}: {
  item: ITradingViewSettingsMockAppearanceItem;
  onColorChange: (
    itemId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
}) {
  return (
    <XStack gap={12} alignItems="center">
      <TradingViewChartColorPicker
        value={item.upColor}
        onChange={(color) => onColorChange(item.id, 'up', color)}
      />
      <TradingViewChartColorPicker
        value={item.downColor}
        onChange={(color) => onColorChange(item.id, 'down', color)}
      />
    </XStack>
  );
}

export function AppearanceCandleSettingsContent({
  items,
  colorMode,
  priceColorMode,
  onOpenColorSettings,
  onToggleItem,
  onColorChange,
}: {
  items: ITradingViewSettingsMockAppearanceItem[];
  colorMode: ITradingViewChartSettingsColorMode;
  priceColorMode: ITradingViewChartSettingsPriceColorMode;
  onOpenColorSettings: () => void;
  onToggleItem: (itemId: string, enabled: boolean) => void;
  onColorChange: (
    itemId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
}) {
  const trendColors = getTradingViewChartTrendColors(colorMode, priceColorMode);

  return (
    <YStack pt={24} pl={20} bg={TRADING_VIEW_CHART_BG}>
      <XStack
        h={32}
        w={213}
        alignItems="center"
        cursor="pointer"
        onPress={onOpenColorSettings}
      >
        <SizableText
          w={164}
          fontSize={14}
          lineHeight={16}
          color={TRADING_VIEW_CHART_TEXT}
        >
          颜色设置
        </SizableText>
        <XStack gap={0} alignItems="center">
          <Icon name="ArrowTopOutline" size="$4" color={trendColors.upColor} />
          <Icon
            name="ArrowBottomOutline"
            size="$4"
            color={trendColors.downColor}
          />
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>

      <Stack h={12} />

      <TradingViewChartSectionTitle>K线</TradingViewChartSectionTitle>

      <YStack>
        {items.map((item) => (
          <TradingViewChartSettingRow key={item.id}>
            <Stack testID={`trading-view-settings-mock-appearance-${item.id}`}>
              <TradingViewChartCheckbox
                checked={item.enabled}
                onChange={(checked) => onToggleItem(item.id, checked)}
              />
            </Stack>
            <SizableText
              ml={9}
              w={116}
              fontSize={14}
              lineHeight={16}
              color={TRADING_VIEW_CHART_TEXT}
            >
              {getTradingViewAppearanceItemLabel(item.id)}
            </SizableText>
            <AppearanceColorPair item={item} onColorChange={onColorChange} />
          </TradingViewChartSettingRow>
        ))}
      </YStack>
    </YStack>
  );
}

export function AppearanceCoordinatesSettingsContent({
  optionState,
  latestPriceLine,
  onOptionChange,
  onLatestPriceColorChange,
  onLatestPriceLineStyleChange,
}: {
  optionState: ITradingViewChartSettingsOptions;
  latestPriceLine: ITradingViewChartSettingsValue['latestPriceLine'];
  onOptionChange: (
    key: keyof ITradingViewChartSettingsOptions,
    checked: boolean,
  ) => void;
  onLatestPriceColorChange: (upColor: string, downColor: string) => void;
  onLatestPriceLineStyleChange: (
    style: ITradingViewChartSettingsLineStyle,
  ) => void;
}) {
  const [activeLatestPriceControl, setActiveLatestPriceControl] = useState<
    'color' | 'style' | undefined
  >();

  return (
    <YStack pt={24} pl={20} bg={TRADING_VIEW_CHART_BG}>
      <TradingViewChartSectionTitle>价格坐标</TradingViewChartSectionTitle>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.countdown}
          onChange={(checked) => onOptionChange('countdown', checked)}
        >
          倒计时
        </TradingViewChartCheckboxWithLabel>
      </TradingViewChartSettingRow>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.depth}
          onChange={(checked) => onOptionChange('depth', checked)}
        >
          深度显示
        </TradingViewChartCheckboxWithLabel>
      </TradingViewChartSettingRow>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.priceChange}
          onChange={(checked) => onOptionChange('priceChange', checked)}
        >
          价格涨跌幅
        </TradingViewChartCheckboxWithLabel>
      </TradingViewChartSettingRow>

      <Stack h={12} />
      <TradingViewChartSectionTitle>
        价格标签和价格线
      </TradingViewChartSectionTitle>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.latestPrice}
          onChange={(checked) => onOptionChange('latestPrice', checked)}
        >
          最新价格
        </TradingViewChartCheckboxWithLabel>
        <Stack ml={52}>
          <TradingViewChartPriceSwatch
            upColor={latestPriceLine.upColor}
            downColor={latestPriceLine.downColor}
            open={activeLatestPriceControl === 'color'}
            onOpenChange={(open) =>
              setActiveLatestPriceControl(open ? 'color' : undefined)
            }
            onChange={onLatestPriceColorChange}
          />
        </Stack>
        <Stack ml={8}>
          <TradingViewChartSelectMock
            value={getTradingViewChartLineStyleLabel(latestPriceLine.style)}
            width={97}
            options={TRADING_VIEW_LINE_STYLE_OPTIONS}
            showLinePreview
            getLinePreviewVariant={getTradingViewChartLineStyleFromLabel}
            open={activeLatestPriceControl === 'style'}
            onOpenChange={(open) =>
              setActiveLatestPriceControl(open ? 'style' : undefined)
            }
            onChange={(label) =>
              onLatestPriceLineStyleChange(
                getTradingViewChartLineStyleFromLabel(label),
              )
            }
          />
        </Stack>
      </TradingViewChartSettingRow>
    </YStack>
  );
}

export function AppearanceEventsSettingsContent({
  optionState,
  onOptionChange,
}: {
  optionState: ITradingViewChartSettingsOptions;
  onOptionChange: (
    key: keyof ITradingViewChartSettingsOptions,
    checked: boolean,
  ) => void;
}) {
  return (
    <YStack pt={24} pl={20} bg={TRADING_VIEW_CHART_BG}>
      <TradingViewChartSectionTitle>财经日历</TradingViewChartSectionTitle>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.futureEvents}
          onChange={(checked) => onOptionChange('futureEvents', checked)}
        >
          显示未来事件
        </TradingViewChartCheckboxWithLabel>
      </TradingViewChartSettingRow>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.pastEvents}
          onChange={(checked) => onOptionChange('pastEvents', checked)}
        >
          显示过往事件
        </TradingViewChartCheckboxWithLabel>
      </TradingViewChartSettingRow>
    </YStack>
  );
}

function getTradingViewChartLineStyleLabel(
  style: ITradingViewChartSettingsLineStyle,
) {
  return style === 'dashed' ? '虚线' : '实线';
}

function getTradingViewChartLineStyleFromLabel(
  label: string,
): ITradingViewChartSettingsLineStyle {
  return label === '虚线' ? 'dashed' : 'solid';
}

function getTradingViewBackgroundStyleLabel(
  style: ITradingViewChartSettingsBackgroundStyle,
) {
  return style === 'gradient' ? '渐变' : '实色';
}

function getTradingViewBackgroundStyleFromLabel(
  label: string,
): ITradingViewChartSettingsBackgroundStyle {
  return label === '渐变' ? 'gradient' : 'solid';
}

function getTradingViewGridStyleLabel(
  style: ITradingViewChartSettingsGridStyle,
) {
  const labels: Record<ITradingViewChartSettingsGridStyle, string> = {
    both: '垂直和水平',
    horizontal: '仅水平',
    vertical: '仅垂直',
    none: '无',
  };
  return labels[style];
}

function getTradingViewGridStyleFromLabel(
  label: string,
): ITradingViewChartSettingsGridStyle {
  if (label === '仅水平') {
    return 'horizontal';
  }
  if (label === '仅垂直') {
    return 'vertical';
  }
  if (label === '无') {
    return 'none';
  }
  return 'both';
}

function getTradingViewGridSwatches(
  grid: ITradingViewChartSettingsValue['grid'],
): Array<readonly ['horizontalColor' | 'verticalColor', string]> {
  if (grid.style === 'both') {
    return [
      ['horizontalColor', grid.horizontalColor],
      ['verticalColor', grid.verticalColor],
    ];
  }
  if (grid.style === 'horizontal') {
    return [['horizontalColor', grid.horizontalColor]];
  }
  if (grid.style === 'vertical') {
    return [['verticalColor', grid.verticalColor]];
  }
  return [];
}

export function AppearanceLayoutSettingsContent({
  optionState,
  background,
  grid,
  crossLine,
  onOptionChange,
  onBackgroundStyleChange,
  onBackgroundColorChange,
  onGridStyleChange,
  onGridColorChange,
  onCrossLineColorChange,
  onCrossLineStyleChange,
}: {
  optionState: ITradingViewChartSettingsOptions;
  background: ITradingViewChartSettingsValue['background'];
  grid: ITradingViewChartSettingsValue['grid'];
  crossLine: ITradingViewChartSettingsValue['crossLine'];
  onOptionChange: (
    key: keyof ITradingViewChartSettingsOptions,
    checked: boolean,
  ) => void;
  onBackgroundStyleChange: (
    style: ITradingViewChartSettingsBackgroundStyle,
  ) => void;
  onBackgroundColorChange: (index: 0 | 1, color: string) => void;
  onGridStyleChange: (style: ITradingViewChartSettingsGridStyle) => void;
  onGridColorChange: (
    role: 'horizontalColor' | 'verticalColor',
    color: string,
  ) => void;
  onCrossLineColorChange: (color: string) => void;
  onCrossLineStyleChange: (style: ITradingViewChartSettingsLineStyle) => void;
}) {
  const backgroundSwatchCount = background.style === 'gradient' ? 2 : 1;
  const gridSwatches = getTradingViewGridSwatches(grid);

  return (
    <YStack pt={24} pl={20} bg={TRADING_VIEW_CHART_BG}>
      <TradingViewChartSectionTitle>图表交互</TradingViewChartSectionTitle>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.clickInteraction}
          onChange={(checked) => onOptionChange('clickInteraction', checked)}
        >
          点击启用交互
        </TradingViewChartCheckboxWithLabel>
      </TradingViewChartSettingRow>

      <Stack h={12} />
      <TradingViewChartSectionTitle>图表样式</TradingViewChartSectionTitle>
      <TradingViewChartSettingRow>
        <TradingViewChartRowLabel>背景</TradingViewChartRowLabel>
        <Stack ml={91}>
          <TradingViewChartSelectMock
            value={getTradingViewBackgroundStyleLabel(background.style)}
            width={140}
            height={32}
            options={TRADING_VIEW_BACKGROUND_STYLE_OPTIONS}
            onChange={(label) =>
              onBackgroundStyleChange(
                getTradingViewBackgroundStyleFromLabel(label),
              )
            }
          />
        </Stack>
        {backgroundSwatchCount > 0 ? (
          <XStack ml={12} gap={10}>
            {Array.from({ length: backgroundSwatchCount }).map((_, index) => (
              <TradingViewChartSolidSwatch
                key={index}
                color={background.colors[index]}
                onChange={(color) =>
                  onBackgroundColorChange(index === 0 ? 0 : 1, color)
                }
              />
            ))}
          </XStack>
        ) : null}
      </TradingViewChartSettingRow>
      <TradingViewChartSettingRow>
        <TradingViewChartRowLabel>网格线</TradingViewChartRowLabel>
        <Stack ml={77}>
          <TradingViewChartSelectMock
            value={getTradingViewGridStyleLabel(grid.style)}
            width={140}
            height={32}
            options={TRADING_VIEW_GRID_LINE_OPTIONS}
            onChange={(label) =>
              onGridStyleChange(getTradingViewGridStyleFromLabel(label))
            }
          />
        </Stack>
        {gridSwatches.length > 0 ? (
          <XStack ml={12} gap={10}>
            {gridSwatches.map(([role, color]) => (
              <TradingViewChartSolidSwatch
                key={role}
                color={color}
                onChange={(nextColor) => onGridColorChange(role, nextColor)}
              />
            ))}
          </XStack>
        ) : null}
      </TradingViewChartSettingRow>
      <TradingViewChartSettingRow>
        <TradingViewChartCheckboxWithLabel
          checked={optionState.crossLine}
          onChange={(checked) => onOptionChange('crossLine', checked)}
        >
          十字线
        </TradingViewChartCheckboxWithLabel>
        <Stack ml={52}>
          <TradingViewChartSolidSwatch
            color={crossLine.color}
            onChange={onCrossLineColorChange}
          />
        </Stack>
        <Stack ml={8}>
          <TradingViewChartSelectMock
            value={getTradingViewChartLineStyleLabel(crossLine.style)}
            width={97}
            options={TRADING_VIEW_LINE_STYLE_OPTIONS}
            showLinePreview
            getLinePreviewVariant={getTradingViewChartLineStyleFromLabel}
            onChange={(label) =>
              onCrossLineStyleChange(
                getTradingViewChartLineStyleFromLabel(label),
              )
            }
          />
        </Stack>
      </TradingViewChartSettingRow>
    </YStack>
  );
}
