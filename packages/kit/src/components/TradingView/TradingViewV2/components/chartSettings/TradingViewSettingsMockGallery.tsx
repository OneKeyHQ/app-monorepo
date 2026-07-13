import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { IIconProps } from '@onekeyhq/components';
import {
  Icon,
  Input,
  Popover,
  ScrollView,
  SizableText,
  Slider,
  Stack,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';

import {
  createTradingViewChartSettingsValue,
  createTradingViewIndicatorSettingsValue,
  getDefaultTradingViewIndicatorIdForScope,
  getTradingViewSettingsMockIndicatorsByScope,
  toggleTradingViewSettingsMockAppearanceItem,
  toggleTradingViewSettingsMockIndicator,
  toggleTradingViewSettingsMockLine,
  updateTradingViewSettingsMockAppearanceItemColor,
  updateTradingViewSettingsMockIndicatorOpacity,
  updateTradingViewSettingsMockIndicatorOpacityColor,
  updateTradingViewSettingsMockIndicatorParameter,
  updateTradingViewSettingsMockLineColor,
  updateTradingViewSettingsMockLinePeriod,
  updateTradingViewSettingsMockLineSecondaryStyle,
  updateTradingViewSettingsMockLineStyle,
} from './TradingViewSettingsMockState';

import type {
  ITradingViewChartSettingsBackgroundStyle,
  ITradingViewChartSettingsColorMode,
  ITradingViewChartSettingsGridStyle,
  ITradingViewChartSettingsLineStyle,
  ITradingViewChartSettingsOptions,
  ITradingViewChartSettingsPriceColorMode,
  ITradingViewChartSettingsValue,
  ITradingViewIndicatorSettingsValue,
  ITradingViewSettingsMockAppearanceItem,
  ITradingViewSettingsMockAppearanceSection,
  ITradingViewSettingsMockAppearanceSectionId,
  ITradingViewSettingsMockColorRole,
  ITradingViewSettingsMockIndicator,
  ITradingViewSettingsMockIndicatorScope,
  ITradingViewSettingsMockLine,
  ITradingViewSettingsMockLineStyle,
  ITradingViewSettingsMockNumberParam,
} from './TradingViewSettingsMockState';
import type { PointerEvent } from 'react-native';

const OKX_CHART_SETTINGS_WIDTH = 552;
const OKX_CHART_SETTINGS_HEIGHT = 517;
const OKX_CHART_HEADER_HEIGHT = 49;
const OKX_CHART_BODY_HEIGHT = 400;
const OKX_CHART_FOOTER_HEIGHT = 66;
const OKX_CHART_SIDEBAR_WIDTH = 130;
const OKX_CHART_BG = '$bg';
const OKX_CHART_SIDE_ACTIVE_BG = '$bgActive';
const OKX_CHART_BORDER = '$borderSubdued';
const OKX_CHART_DIVIDER = '$borderSubdued';
const OKX_CHART_TEXT = '$text';
const OKX_CHART_TEXT_SUBDUED = '$textSubdued';
const OKX_CHART_UP = '#219D46';
const OKX_CHART_DOWN = '#C33759';
const OKX_CHART_SELECT_BG = '$bgStrong';
const OKX_CHART_SELECT_BORDER = '$borderSubdued';
const OKX_COLOR_SETTING_PANEL_WIDTH = 423;
const OKX_COLOR_SETTING_PANEL_HEIGHT = 374;

const OKX_COLOR_PALETTE = [
  [
    '#FFFFFF',
    '#F02F3C',
    '#FF8D00',
    '#FFE834',
    '#43A646',
    '#088E76',
    '#00B4CE',
    '#2457FF',
    '#5C33AE',
    '#9123A7',
    '#E61C58',
  ],
  [
    '#CCCED7',
    '#FCC4C6',
    '#FFDBA8',
    '#FFF8BC',
    '#C1E2C2',
    '#A2E1D7',
    '#A9E8F0',
    '#B3D4FA',
    '#CBBCE6',
    '#DDB6E3',
    '#F7B3CA',
  ],
  [
    '#9FA2AC',
    '#F9979A',
    '#FFC575',
    '#FFF392',
    '#9BD09D',
    '#66C5B5',
    '#76D9E7',
    '#85B7F8',
    '#AA92D6',
    '#C788D2',
    '#F284A8',
  ],
  [
    '#62656F',
    '#F67175',
    '#FFAE44',
    '#FFEE6B',
    '#76C079',
    '#3BB59F',
    '#45CADD',
    '#5191F5',
    '#8A6AC6',
    '#B15DC1',
    '#EE5788',
  ],
  [
    '#34363E',
    '#F74855',
    '#FF9D22',
    '#FFEB4E',
    '#5BB35F',
    '#20A189',
    '#23BFD5',
    '#2C6EF3',
    '#734DBA',
    '#A13EB4',
    '#E9386F',
  ],
  [
    '#252932',
    '#A9242D',
    '#F27206',
    '#FAB828',
    '#318335',
    '#0B5B4C',
    '#008C9D',
    '#183FC5',
    '#47289E',
    '#701C98',
    '#BA1751',
  ],
  [
    '#000000',
    '#751920',
    '#E24600',
    '#F37416',
    '#19531D',
    '#042D25',
    '#075559',
    '#0F2C8E',
    '#2B1A87',
    '#411481',
    '#7C1046',
  ],
];

const OKX_LINE_STYLE_OPTIONS = ['实线', '虚线'];
const OKX_BACKGROUND_STYLE_OPTIONS = ['实色', '渐变'];
const OKX_GRID_LINE_OPTIONS = ['垂直和水平', '仅水平', '仅垂直', '无'];
const OKX_LINE_PREVIEW_DASHES = [0, 1, 2, 3, 4, 5];
const OKX_INDICATOR_SETTINGS_WIDTH = 690;
const OKX_INDICATOR_SETTINGS_HEIGHT = 570;
const OKX_INDICATOR_HEADER_HEIGHT = 49;
const OKX_INDICATOR_TABS_HEIGHT = 41;
const OKX_INDICATOR_BODY_HEIGHT = 418;
const OKX_INDICATOR_FOOTER_HEIGHT = 62;
const OKX_INDICATOR_SIDEBAR_WIDTH = 184;
const OKX_INDICATOR_SIDEBAR_ROW_PADDING_X = 16;
const OKX_INDICATOR_SIDEBAR_LABEL_WIDTH = 86;
const OKX_INDICATOR_FIELD_LABEL_WIDTH = 136;
const OKX_INDICATOR_LINE_STYLE_OPTIONS: ITradingViewSettingsMockLineStyle[] = [
  'solid',
  'medium',
  'bold',
  'extraBold',
];

type ISettingsValueUpdater<TValue> = (currentValue: TValue) => TValue;

function useSettingsDraftValue<TValue>({
  value,
  defaultValue,
  createDefaultValue,
  onChange,
}: {
  value?: TValue;
  defaultValue?: TValue;
  createDefaultValue: () => TValue;
  onChange?: (value: TValue) => void;
}) {
  const [innerCommittedValue, setInnerCommittedValue] = useState<TValue>(
    () => defaultValue ?? createDefaultValue(),
  );
  const committedValue = value ?? innerCommittedValue;
  const committedValueRef = useRef(committedValue);
  const draftValueRef = useRef(committedValue);
  const isDraftDirtyRef = useRef(false);
  const [draftValue, setDraftValue] = useState(committedValue);

  useEffect(() => {
    if (
      isDraftDirtyRef.current ||
      Object.is(committedValueRef.current, committedValue)
    ) {
      return;
    }

    committedValueRef.current = committedValue;
    draftValueRef.current = committedValue;
    setDraftValue(committedValue);
  }, [committedValue]);

  const updateDraftValue = useCallback(
    (updater: ISettingsValueUpdater<TValue>) => {
      const nextValue = updater(draftValueRef.current);
      if (Object.is(nextValue, draftValueRef.current)) {
        return;
      }
      isDraftDirtyRef.current = true;
      draftValueRef.current = nextValue;
      setDraftValue(nextValue);
      onChange?.(nextValue);
    },
    [onChange],
  );

  const commitDraftValue = useCallback(() => {
    isDraftDirtyRef.current = false;
    committedValueRef.current = draftValueRef.current;
    if (value === undefined) {
      setInnerCommittedValue(draftValueRef.current);
    }
  }, [value]);

  const cancelDraftValue = useCallback(() => {
    const restoredValue = committedValueRef.current;
    isDraftDirtyRef.current = false;
    draftValueRef.current = restoredValue;
    setDraftValue(restoredValue);
    onChange?.(restoredValue);
  }, [onChange]);

  return [
    draftValue,
    updateDraftValue,
    commitDraftValue,
    cancelDraftValue,
  ] as const;
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
  onCancel?: () => void;
  onClose?: () => void;
};

export type ITradingViewIndicatorSettingsProps = {
  /** Use value for controlled committed state, or defaultValue for local state. */
  value?: ITradingViewIndicatorSettingsValue;
  defaultValue?: ITradingViewIndicatorSettingsValue;
  maxActiveSubIndicators?: number;
  isSubmitting?: boolean;
  /** Called when the editable draft changes. */
  onChange?: (value: ITradingViewIndicatorSettingsValue) => void;
  /** Receives the complete value after the user confirms the draft. */
  onConfirm?: (
    value: ITradingViewIndicatorSettingsValue,
  ) => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
};

function AppearanceSidebar({
  sections,
  selectedSectionId,
  onSelect,
}: {
  sections: ITradingViewSettingsMockAppearanceSection[];
  selectedSectionId: ITradingViewSettingsMockAppearanceSectionId;
  onSelect: (sectionId: ITradingViewSettingsMockAppearanceSectionId) => void;
}) {
  return (
    <YStack w={OKX_CHART_SIDEBAR_WIDTH} pt={12} bg={OKX_CHART_BG}>
      {sections.map((section) => {
        const selected = section.id === selectedSectionId;
        return (
          <XStack
            key={section.id}
            h={40}
            px={20}
            gap={9}
            alignItems="center"
            bg={selected ? OKX_CHART_SIDE_ACTIVE_BG : OKX_CHART_BG}
            hoverStyle={{
              bg: selected ? OKX_CHART_SIDE_ACTIVE_BG : '$bgHover',
            }}
            pressStyle={{ bg: OKX_CHART_SIDE_ACTIVE_BG }}
            cursor="pointer"
            userSelect="none"
            onPress={() => onSelect(section.id)}
          >
            <Icon
              name={getOkxAppearanceSectionIcon(section.id)}
              size="$5"
              color="$icon"
            />
            <SizableText
              fontSize={14}
              lineHeight={16}
              color={OKX_CHART_TEXT}
              numberOfLines={1}
            >
              {getOkxAppearanceSectionLabel(section.id)}
            </SizableText>
          </XStack>
        );
      })}
    </YStack>
  );
}

function getOkxAppearanceSectionLabel(
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

function getOkxAppearanceSectionIcon(
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

function getOkxAppearanceItemLabel(itemId: string) {
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

function OkxChartCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Stack
      w={16}
      h={16}
      alignItems="center"
      justifyContent="center"
      borderRadius={3}
      bg={checked ? '$bgInverse' : OKX_CHART_BG}
      borderWidth={checked ? 0 : 1}
      borderColor="$borderStrong"
      hoverStyle={{ opacity: 0.78 }}
      pressStyle={{ opacity: 0.62 }}
      cursor="pointer"
      onPress={() => onChange(!checked)}
    >
      {checked ? (
        <Icon name="CheckLargeOutline" size="$3" color="$iconInverse" />
      ) : null}
    </Stack>
  );
}

function OkxChartColorPicker({
  value,
  placement = 'bottom',
  align = 'left',
  pattern,
  bare = false,
  testID,
  onChange,
}: {
  value: string;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
  pattern?: 'checker';
  bare?: boolean;
  testID?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const themeName = useThemeName();
  const checkerColor =
    themeName === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
  let popoverPlacement: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
  if (placement === 'bottom') {
    popoverPlacement = align === 'left' ? 'bottom-start' : 'bottom-end';
  } else {
    popoverPlacement = align === 'left' ? 'top-start' : 'top-end';
  }

  return (
    <Popover
      title=""
      showHeader={false}
      usingSheet={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      placement={popoverPlacement}
      allowFlip={false}
      offset={8}
      floatingPanelProps={{
        w: 'auto',
        minWidth: 0,
        p: 0,
        bg: 'transparent',
        borderRadius: 0,
        outlineWidth: 0,
        boxShadow: 'none',
      }}
      renderTrigger={
        <Stack
          testID={testID}
          w={bare ? 24 : 30}
          h={bare ? 24 : 30}
          alignItems="center"
          justifyContent="center"
          borderRadius={bare ? 0 : 5}
          borderWidth={bare ? 0 : 1}
          borderColor="$borderSubdued"
          bg="$bgStrong"
          hoverStyle={{ borderColor: '$borderStrong', opacity: 0.86 }}
          pressStyle={{ opacity: 0.7 }}
          cursor="pointer"
          onPress={() => setIsOpen(true)}
        >
          <Stack
            w={bare ? 24 : 22}
            h={bare ? 24 : 22}
            borderRadius={bare ? 0 : 2}
            bg={value}
            style={
              pattern === 'checker'
                ? {
                    background: `repeating-conic-gradient(${value} 0% 25%, ${checkerColor} 0% 50%) 50% / 6px 6px`,
                  }
                : undefined
            }
          />
        </Stack>
      }
      renderContent={
        <OkxChartColorPalette
          placement={placement}
          align={align}
          offset={bare ? 32 : 38}
          inPopover
          selectedColor={value}
          onSelect={(color) => {
            onChange(color);
            setIsOpen(false);
          }}
        />
      }
    />
  );
}

function OkxChartColorPalette({
  placement,
  align,
  offset = 38,
  inPopover = false,
  selectedColor,
  onSelect,
}: {
  placement: 'bottom' | 'top';
  align: 'left' | 'right';
  offset?: number;
  inPopover?: boolean;
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <YStack
      position={inPopover ? 'relative' : 'absolute'}
      top={!inPopover && placement === 'bottom' ? offset : undefined}
      bottom={!inPopover && placement === 'top' ? offset : undefined}
      left={!inPopover && align === 'left' ? 0 : undefined}
      right={!inPopover && align === 'right' ? 0 : undefined}
      p={12}
      gap={6}
      zIndex={100}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius={6}
      bg={OKX_CHART_BG}
    >
      {OKX_COLOR_PALETTE.map((row) => (
        <XStack key={row.join('-')} gap={6}>
          {row.map((color) => {
            const selected = color === selectedColor;
            return (
              <Stack
                key={color}
                w={18}
                h={18}
                position="relative"
                cursor="pointer"
                hoverStyle={{ opacity: 0.76 }}
                pressStyle={{ opacity: 0.6 }}
                onPress={() => onSelect(color)}
              >
                <Stack
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  borderWidth={color === '#000000' ? 1 : 0}
                  borderColor="$borderStrong"
                  bg={color}
                />
                {selected ? (
                  <Stack
                    position="absolute"
                    top={-3}
                    right={-3}
                    bottom={-3}
                    left={-3}
                    borderWidth={2}
                    borderColor="$borderActive"
                    pointerEvents="none"
                  />
                ) : null}
              </Stack>
            );
          })}
        </XStack>
      ))}
    </YStack>
  );
}

function OkxChartSectionTitle({ children }: { children: ReactNode }) {
  return (
    <SizableText
      h={12}
      fontSize={12}
      lineHeight={12}
      color={OKX_CHART_TEXT_SUBDUED}
    >
      {children}
    </SizableText>
  );
}

function OkxChartSettingRow({ children }: { children: ReactNode }) {
  return (
    <XStack h={50} w={380} alignItems="center">
      {children}
    </XStack>
  );
}

function OkxChartRowLabel({ children }: { children: ReactNode }) {
  return (
    <SizableText fontSize={14} lineHeight={16} color={OKX_CHART_TEXT}>
      {children}
    </SizableText>
  );
}

function OkxChartCheckboxWithLabel({
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
      <OkxChartCheckbox checked={checked} onChange={onChange} />
      <SizableText ml={8} fontSize={14} lineHeight={16} color={OKX_CHART_TEXT}>
        {children}
      </SizableText>
    </XStack>
  );
}

function OkxChartSelectMock({
  value,
  width,
  height = 28,
  showLinePreview,
  options,
  onChange,
}: {
  value: string;
  width: number;
  height?: number;
  showLinePreview?: boolean;
  options: string[];
  onChange?: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Stack position="relative" zIndex={isOpen ? 20 : 1}>
      <XStack
        h={height}
        w={width}
        px={9}
        alignItems="center"
        borderRadius={6}
        borderWidth={1}
        borderColor={isOpen ? '$borderActive' : OKX_CHART_SELECT_BORDER}
        bg={OKX_CHART_SELECT_BG}
        cursor="pointer"
        onPress={() => setIsOpen((current) => !current)}
      >
        {showLinePreview ? (
          <OkxChartLinePreview variant={value} mr={9} color={OKX_CHART_TEXT} />
        ) : null}
        <SizableText
          flex={1}
          minWidth={0}
          fontSize={12}
          lineHeight={12}
          color={OKX_CHART_TEXT}
          numberOfLines={1}
        >
          {value}
        </SizableText>
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$4"
          color="$icon"
        />
      </XStack>

      {isOpen ? (
        <YStack
          position="absolute"
          top={height + 8}
          left={0}
          w={width}
          overflow="hidden"
          borderRadius={6}
          bg="$bgSubdued"
          zIndex={100}
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <XStack
                key={option}
                h={36}
                px={12}
                gap={10}
                alignItems="center"
                bg={selected ? '$bgActive' : '$bgSubdued'}
                hoverStyle={{ bg: '$bgStrongHover' }}
                cursor="pointer"
                onPress={() => {
                  onChange?.(option);
                  setIsOpen(false);
                }}
              >
                {showLinePreview ? (
                  <OkxChartLinePreview variant={option} color="$text" />
                ) : null}
                <SizableText
                  fontSize={13}
                  lineHeight={18}
                  color={OKX_CHART_TEXT}
                >
                  {option}
                </SizableText>
              </XStack>
            );
          })}
        </YStack>
      ) : null}
    </Stack>
  );
}

function OkxChartLinePreview({
  variant,
  color,
  mr,
}: {
  variant: string;
  color: string;
  mr?: number;
}) {
  if (variant === '虚线') {
    return (
      <XStack w={24} h={1} mr={mr} gap={2} alignItems="center">
        {OKX_LINE_PREVIEW_DASHES.map((dash) => (
          <Stack key={dash} w={2} h={1} bg={color} />
        ))}
      </XStack>
    );
  }

  return <Stack w={24} h={1} mr={mr} bg={color} />;
}

function OkxChartSolidSwatch({
  color,
  placement = 'bottom',
  align = 'left',
  bare = false,
  onChange,
}: {
  color: string;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
  bare?: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <OkxChartColorPicker
      value={color}
      placement={placement}
      align={align}
      bare={bare}
      onChange={onChange}
    />
  );
}

function OkxChartPriceSwatch({
  upColor,
  downColor,
  onChange,
}: {
  upColor: string;
  downColor: string;
  onChange: (upColor: string, downColor: string) => void;
}) {
  const [activeColorRole, setActiveColorRole] = useState<
    ITradingViewSettingsMockColorRole | undefined
  >();

  return (
    <Stack position="relative" zIndex={activeColorRole ? 30 : 1}>
      <Stack
        w={28}
        h={28}
        overflow="hidden"
        borderRadius={4}
        borderWidth={1}
        borderColor={OKX_CHART_SELECT_BORDER}
        bg={OKX_CHART_BG}
        style={{
          background: `linear-gradient(45deg, ${downColor} 0 50%, ${upColor} 50% 100%)`,
        }}
      >
        <XStack position="absolute" top={0} right={0} bottom={0} left={0}>
          <Stack
            flex={1}
            cursor="pointer"
            onPress={() => setActiveColorRole('down')}
          />
          <Stack
            flex={1}
            cursor="pointer"
            onPress={() => setActiveColorRole('up')}
          />
        </XStack>
      </Stack>

      {activeColorRole ? (
        <OkxChartColorPalette
          placement="bottom"
          align="left"
          selectedColor={activeColorRole === 'up' ? upColor : downColor}
          onSelect={(color) => {
            if (activeColorRole === 'up') {
              onChange(color, downColor);
            } else {
              onChange(upColor, color);
            }
            setActiveColorRole(undefined);
          }}
        />
      ) : null}
    </Stack>
  );
}

function getOkxChartTrendColors(
  colorMode: ITradingViewChartSettingsColorMode,
  priceColorMode: ITradingViewChartSettingsPriceColorMode,
) {
  const positiveColor = colorMode === 'modern' ? '#D6FF00' : OKX_CHART_UP;
  const negativeColor = colorMode === 'modern' ? '#FF3CD9' : OKX_CHART_DOWN;

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

function applyOkxChartTrendColors(
  value: ITradingViewChartSettingsValue,
  colorMode: ITradingViewChartSettingsColorMode,
  priceColorMode: ITradingViewChartSettingsPriceColorMode,
): ITradingViewChartSettingsValue {
  const trendColors = getOkxChartTrendColors(colorMode, priceColorMode);

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
      <OkxChartColorPicker
        value={item.upColor}
        onChange={(color) => onColorChange(item.id, 'up', color)}
      />
      <OkxChartColorPicker
        value={item.downColor}
        onChange={(color) => onColorChange(item.id, 'down', color)}
      />
    </XStack>
  );
}

function AppearanceCandleSettingsContent({
  items,
  onOpenColorSettings,
  onToggleItem,
  onColorChange,
}: {
  items: ITradingViewSettingsMockAppearanceItem[];
  onOpenColorSettings: () => void;
  onToggleItem: (itemId: string, enabled: boolean) => void;
  onColorChange: (
    itemId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
}) {
  return (
    <YStack pt={24} pl={20} bg={OKX_CHART_BG}>
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
          color={OKX_CHART_TEXT}
        >
          颜色设置
        </SizableText>
        <XStack gap={0} alignItems="center">
          <Icon name="ArrowTopOutline" size="$4" color="$iconSuccess" />
          <Icon name="ArrowBottomOutline" size="$4" color="$iconCritical" />
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>

      <Stack h={12} />

      <OkxChartSectionTitle>K线</OkxChartSectionTitle>

      <YStack>
        {items.map((item) => (
          <OkxChartSettingRow key={item.id}>
            <Stack testID={`trading-view-settings-mock-appearance-${item.id}`}>
              <OkxChartCheckbox
                checked={item.enabled}
                onChange={(checked) => onToggleItem(item.id, checked)}
              />
            </Stack>
            <SizableText
              ml={9}
              w={116}
              fontSize={14}
              lineHeight={16}
              color={OKX_CHART_TEXT}
            >
              {getOkxAppearanceItemLabel(item.id)}
            </SizableText>
            <AppearanceColorPair item={item} onColorChange={onColorChange} />
          </OkxChartSettingRow>
        ))}
      </YStack>
    </YStack>
  );
}

function AppearanceCoordinatesSettingsContent({
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
  return (
    <YStack pt={24} pl={20} bg={OKX_CHART_BG}>
      <OkxChartSectionTitle>价格坐标</OkxChartSectionTitle>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.countdown}
          onChange={(checked) => onOptionChange('countdown', checked)}
        >
          倒计时
        </OkxChartCheckboxWithLabel>
      </OkxChartSettingRow>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.depth}
          onChange={(checked) => onOptionChange('depth', checked)}
        >
          深度显示
        </OkxChartCheckboxWithLabel>
      </OkxChartSettingRow>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.priceChange}
          onChange={(checked) => onOptionChange('priceChange', checked)}
        >
          价格涨跌幅
        </OkxChartCheckboxWithLabel>
      </OkxChartSettingRow>

      <Stack h={12} />
      <OkxChartSectionTitle>价格标签和价格线</OkxChartSectionTitle>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.latestPrice}
          onChange={(checked) => onOptionChange('latestPrice', checked)}
        >
          最新价格
        </OkxChartCheckboxWithLabel>
        <Stack ml={52}>
          <OkxChartPriceSwatch
            upColor={latestPriceLine.upColor}
            downColor={latestPriceLine.downColor}
            onChange={onLatestPriceColorChange}
          />
        </Stack>
        <Stack ml={8}>
          <OkxChartSelectMock
            value={getOkxChartLineStyleLabel(latestPriceLine.style)}
            width={97}
            options={OKX_LINE_STYLE_OPTIONS}
            showLinePreview
            onChange={(label) =>
              onLatestPriceLineStyleChange(getOkxChartLineStyleFromLabel(label))
            }
          />
        </Stack>
      </OkxChartSettingRow>
    </YStack>
  );
}

function AppearanceEventsSettingsContent({
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
    <YStack pt={24} pl={20} bg={OKX_CHART_BG}>
      <OkxChartSectionTitle>财经日历</OkxChartSectionTitle>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.futureEvents}
          onChange={(checked) => onOptionChange('futureEvents', checked)}
        >
          显示未来事件
        </OkxChartCheckboxWithLabel>
      </OkxChartSettingRow>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.pastEvents}
          onChange={(checked) => onOptionChange('pastEvents', checked)}
        >
          显示过往事件
        </OkxChartCheckboxWithLabel>
      </OkxChartSettingRow>
    </YStack>
  );
}

function getOkxChartLineStyleLabel(style: ITradingViewChartSettingsLineStyle) {
  return style === 'dashed' ? '虚线' : '实线';
}

function getOkxChartLineStyleFromLabel(
  label: string,
): ITradingViewChartSettingsLineStyle {
  return label === '虚线' ? 'dashed' : 'solid';
}

function getOkxBackgroundStyleLabel(
  style: ITradingViewChartSettingsBackgroundStyle,
) {
  return style === 'gradient' ? '渐变' : '实色';
}

function getOkxBackgroundStyleFromLabel(
  label: string,
): ITradingViewChartSettingsBackgroundStyle {
  return label === '渐变' ? 'gradient' : 'solid';
}

function getOkxGridStyleLabel(style: ITradingViewChartSettingsGridStyle) {
  const labels: Record<ITradingViewChartSettingsGridStyle, string> = {
    both: '垂直和水平',
    horizontal: '仅水平',
    vertical: '仅垂直',
    none: '无',
  };
  return labels[style];
}

function getOkxGridStyleFromLabel(
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

function getOkxGridSwatches(
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

function AppearanceLayoutSettingsContent({
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
  const gridSwatches = getOkxGridSwatches(grid);

  return (
    <YStack pt={24} pl={20} bg={OKX_CHART_BG}>
      <OkxChartSectionTitle>图表交互</OkxChartSectionTitle>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.clickInteraction}
          onChange={(checked) => onOptionChange('clickInteraction', checked)}
        >
          点击启用交互
        </OkxChartCheckboxWithLabel>
      </OkxChartSettingRow>

      <Stack h={12} />
      <OkxChartSectionTitle>图表样式</OkxChartSectionTitle>
      <OkxChartSettingRow>
        <OkxChartRowLabel>背景</OkxChartRowLabel>
        <Stack ml={91}>
          <OkxChartSelectMock
            value={getOkxBackgroundStyleLabel(background.style)}
            width={140}
            height={32}
            options={OKX_BACKGROUND_STYLE_OPTIONS}
            onChange={(label) =>
              onBackgroundStyleChange(getOkxBackgroundStyleFromLabel(label))
            }
          />
        </Stack>
        {backgroundSwatchCount > 0 ? (
          <XStack ml={12} gap={10}>
            {Array.from({ length: backgroundSwatchCount }).map((_, index) => (
              <OkxChartSolidSwatch
                key={index}
                color={background.colors[index]}
                onChange={(color) =>
                  onBackgroundColorChange(index === 0 ? 0 : 1, color)
                }
              />
            ))}
          </XStack>
        ) : null}
      </OkxChartSettingRow>
      <OkxChartSettingRow>
        <OkxChartRowLabel>网格线</OkxChartRowLabel>
        <Stack ml={77}>
          <OkxChartSelectMock
            value={getOkxGridStyleLabel(grid.style)}
            width={140}
            height={32}
            options={OKX_GRID_LINE_OPTIONS}
            onChange={(label) =>
              onGridStyleChange(getOkxGridStyleFromLabel(label))
            }
          />
        </Stack>
        {gridSwatches.length > 0 ? (
          <XStack ml={12} gap={10}>
            {gridSwatches.map(([role, color]) => (
              <OkxChartSolidSwatch
                key={role}
                color={color}
                onChange={(nextColor) => onGridColorChange(role, nextColor)}
              />
            ))}
          </XStack>
        ) : null}
      </OkxChartSettingRow>
      <OkxChartSettingRow>
        <OkxChartCheckboxWithLabel
          checked={optionState.crossLine}
          onChange={(checked) => onOptionChange('crossLine', checked)}
        >
          十字线
        </OkxChartCheckboxWithLabel>
        <Stack ml={52}>
          <OkxChartSolidSwatch
            color={crossLine.color}
            onChange={onCrossLineColorChange}
          />
        </Stack>
        <Stack ml={8}>
          <OkxChartSelectMock
            value={getOkxChartLineStyleLabel(crossLine.style)}
            width={97}
            options={OKX_LINE_STYLE_OPTIONS}
            showLinePreview
            onChange={(label) =>
              onCrossLineStyleChange(getOkxChartLineStyleFromLabel(label))
            }
          />
        </Stack>
      </OkxChartSettingRow>
    </YStack>
  );
}

function OkxChartColorSettingsPanel({
  colorMode,
  priceColorMode,
  onColorModeChange,
  onPriceColorModeChange,
  onClose,
}: {
  colorMode: ITradingViewChartSettingsColorMode;
  priceColorMode: ITradingViewChartSettingsPriceColorMode;
  onColorModeChange: (value: ITradingViewChartSettingsColorMode) => void;
  onPriceColorModeChange: (
    value: ITradingViewChartSettingsPriceColorMode,
  ) => void;
  onClose: () => void;
}) {
  return (
    <YStack
      position="absolute"
      top={55}
      left={390}
      w={OKX_COLOR_SETTING_PANEL_WIDTH}
      h={OKX_COLOR_SETTING_PANEL_HEIGHT}
      overflow="hidden"
      zIndex={40}
      borderWidth={1}
      borderColor="$borderStrong"
      borderRadius={7}
      bg={OKX_CHART_BG}
    >
      <XStack
        h={49}
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
          颜色设置
        </SizableText>
        <Stack
          w={28}
          h={28}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ opacity: 0.72 }}
          pressStyle={{ opacity: 0.56 }}
          onPress={onClose}
        >
          <Icon name="CrossedSmallOutline" size="$5" color="$icon" />
        </Stack>
      </XStack>

      <YStack px={24} py={26} gap={24}>
        <YStack gap={12}>
          <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
            颜色模式
          </SizableText>
          <XStack gap={17}>
            <OkxChartColorModeCard
              label="现代"
              selected={colorMode === 'modern'}
              variant="modern"
              onPress={() => onColorModeChange('modern')}
            />
            <OkxChartColorModeCard
              label="经典"
              selected={colorMode === 'classic'}
              variant="classic"
              onPress={() => onColorModeChange('classic')}
            />
          </XStack>
        </YStack>

        <YStack gap={12}>
          <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
            涨跌颜色
          </SizableText>
          <XStack gap={17}>
            <OkxChartPriceColorButton
              label="绿涨红跌"
              selected={priceColorMode === 'greenUpRedDown'}
              upIconColor="$iconSuccess"
              downIconColor="$iconCritical"
              onPress={() => onPriceColorModeChange('greenUpRedDown')}
            />
            <OkxChartPriceColorButton
              label="红涨绿跌"
              selected={priceColorMode === 'redUpGreenDown'}
              upIconColor="$iconCritical"
              downIconColor="$iconSuccess"
              onPress={() => onPriceColorModeChange('redUpGreenDown')}
            />
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}

function OkxChartColorModeCard({
  label,
  selected,
  variant,
  onPress,
}: {
  label: string;
  selected: boolean;
  variant: 'modern' | 'classic';
  onPress: () => void;
}) {
  return (
    <YStack
      w={178}
      h={116}
      p={16}
      justifyContent="space-between"
      borderWidth={1}
      borderColor={selected ? '$borderActive' : '$borderStrong'}
      borderRadius={6}
      bg={OKX_CHART_BG}
      cursor="pointer"
      onPress={onPress}
    >
      <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
        {label}
      </SizableText>
      <OkxChartMiniCandles variant={variant} />
    </YStack>
  );
}

function OkxChartMiniCandles({ variant }: { variant: 'modern' | 'classic' }) {
  const bullishColor = variant === 'modern' ? '#D6FF00' : OKX_CHART_UP;
  const bearishColor = variant === 'modern' ? '#FF3CD9' : OKX_CHART_DOWN;
  const candles = [
    { h: 28, body: 17, color: bullishColor },
    { h: 16, body: 8, color: bearishColor },
    { h: 12, body: 6, color: bullishColor },
    { h: 20, body: 14, color: bearishColor },
    { h: 13, body: 7, color: bearishColor },
    { h: 18, body: 10, color: bullishColor },
    { h: 31, body: 18, color: bullishColor },
    { h: 16, body: 9, color: bullishColor },
    { h: 24, body: 16, color: bearishColor },
    { h: 19, body: 11, color: bullishColor },
    { h: 34, body: 20, color: bullishColor },
  ];

  return (
    <XStack h={52} alignItems="flex-end" gap={5}>
      {candles.map((candle, index) => (
        <YStack
          key={`${candle.color}-${index}`}
          h={candle.h}
          alignItems="center"
        >
          <Stack flex={1} w={1} bg={candle.color} />
          <Stack w={5} h={candle.body} bg={candle.color} />
          <Stack flex={1} w={1} bg={candle.color} />
        </YStack>
      ))}
    </XStack>
  );
}

function OkxChartPriceColorButton({
  label,
  selected,
  upIconColor,
  downIconColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  upIconColor: IIconProps['color'];
  downIconColor: IIconProps['color'];
  onPress: () => void;
}) {
  return (
    <XStack
      w={178}
      h={58}
      px={16}
      alignItems="center"
      justifyContent="space-between"
      borderWidth={1}
      borderColor={selected ? '$borderActive' : '$borderStrong'}
      borderRadius={6}
      bg={OKX_CHART_BG}
      cursor="pointer"
      onPress={onPress}
    >
      <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
        {label}
      </SizableText>
      <XStack gap={2} alignItems="center">
        <Icon name="ArrowTopOutline" size="$5" color={upIconColor} />
        <Icon name="ArrowBottomOutline" size="$5" color={downIconColor} />
      </XStack>
    </XStack>
  );
}

function OkxIndicatorScopeTabs({
  value,
  indicators,
  onChange,
}: {
  value: ITradingViewSettingsMockIndicatorScope;
  indicators: ITradingViewSettingsMockIndicator[];
  onChange: (value: ITradingViewSettingsMockIndicatorScope) => void;
}) {
  const activeSubIndicatorCount = indicators.filter(
    (indicator) => indicator.scope === 'sub' && indicator.active,
  ).length;
  const tabs = [
    { label: '主图指标', value: 'main' as const },
    {
      label: `副图指标 (${Math.min(activeSubIndicatorCount, 4)}/4)`,
      value: 'sub' as const,
    },
  ];

  return (
    <XStack
      h={OKX_INDICATOR_TABS_HEIGHT}
      px={24}
      gap={24}
      alignItems="flex-end"
      borderBottomWidth={1}
      borderBottomColor={OKX_CHART_DIVIDER}
      bg={OKX_CHART_BG}
    >
      {tabs.map((tab) => {
        const selected = value === tab.value;
        return (
          <YStack
            key={tab.value}
            h={OKX_INDICATOR_TABS_HEIGHT}
            justifyContent="center"
            cursor="pointer"
            onPress={() => onChange(tab.value)}
          >
            <SizableText
              fontSize={14}
              lineHeight={18}
              fontWeight={selected ? '700' : '400'}
              color={selected ? OKX_CHART_TEXT : OKX_CHART_TEXT_SUBDUED}
            >
              {tab.label}
            </SizableText>
            <Stack
              position="absolute"
              left={0}
              right={0}
              bottom={0}
              h={2}
              bg={selected ? '$text' : 'transparent'}
            />
          </YStack>
        );
      })}
    </XStack>
  );
}

function OkxIndicatorSidebar({
  indicators,
  selectedIndicatorId,
  onSelect,
  onToggle,
}: {
  indicators: ITradingViewSettingsMockIndicator[];
  selectedIndicatorId: string;
  onSelect: (indicatorId: string) => void;
  onToggle: (indicatorId: string, active: boolean) => void;
}) {
  const [scrollMetrics, setScrollMetrics] = useState({
    contentHeight: OKX_INDICATOR_BODY_HEIGHT,
    viewportHeight: OKX_INDICATOR_BODY_HEIGHT,
    scrollY: 0,
  });
  const hasScrollableContent =
    scrollMetrics.contentHeight > scrollMetrics.viewportHeight;
  const scrollbarThumbHeight = hasScrollableContent
    ? Math.max(
        34,
        (scrollMetrics.viewportHeight / scrollMetrics.contentHeight) *
          scrollMetrics.viewportHeight,
      )
    : 0;
  const scrollbarThumbTop = hasScrollableContent
    ? Math.min(
        scrollMetrics.viewportHeight - scrollbarThumbHeight,
        (scrollMetrics.scrollY /
          (scrollMetrics.contentHeight - scrollMetrics.viewportHeight)) *
          (scrollMetrics.viewportHeight - scrollbarThumbHeight),
      )
    : 0;

  return (
    <Stack
      w={OKX_INDICATOR_SIDEBAR_WIDTH}
      h={OKX_INDICATOR_BODY_HEIGHT}
      position="relative"
      overflow="hidden"
    >
      <ScrollView
        w={OKX_INDICATOR_SIDEBAR_WIDTH}
        h={OKX_INDICATOR_BODY_HEIGHT}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onContentSizeChange={(_, contentHeight) =>
          setScrollMetrics((current) => ({ ...current, contentHeight }))
        }
        onLayout={(event) =>
          setScrollMetrics((current) => ({
            ...current,
            viewportHeight: event.nativeEvent.layout.height,
          }))
        }
        onScroll={(event) =>
          setScrollMetrics((current) => ({
            ...current,
            scrollY: event.nativeEvent.contentOffset.y,
          }))
        }
      >
        <YStack pt={15} pb={24} bg={OKX_CHART_BG}>
          {indicators.map((indicator, index) => {
            const selected = indicator.id === selectedIndicatorId;
            const previousIndicator = indicators[index - 1];
            const showGroupLabel =
              indicator.groupLabel &&
              indicator.groupLabel !== previousIndicator?.groupLabel;
            return (
              <YStack key={indicator.id} w="100%">
                {showGroupLabel ? (
                  <SizableText
                    mt={index === 0 ? 0 : 19}
                    mb={12}
                    px={OKX_INDICATOR_SIDEBAR_ROW_PADDING_X}
                    fontSize={12}
                    lineHeight={14}
                    color={OKX_CHART_TEXT_SUBDUED}
                  >
                    {indicator.groupLabel}
                  </SizableText>
                ) : null}
                <XStack
                  testID={`trading-view-indicator-sidebar-${indicator.id}`}
                  w="100%"
                  h={41}
                  px={OKX_INDICATOR_SIDEBAR_ROW_PADDING_X}
                  gap={8}
                  alignItems="center"
                  bg={selected ? OKX_CHART_SIDE_ACTIVE_BG : OKX_CHART_BG}
                  hoverStyle={{
                    bg: selected ? OKX_CHART_SIDE_ACTIVE_BG : '$bgHover',
                  }}
                  cursor="pointer"
                  onPress={() => onSelect(indicator.id)}
                >
                  <OkxChartCheckbox
                    checked={indicator.active}
                    onChange={(checked) => onToggle(indicator.id, checked)}
                  />
                  <Stack
                    w={OKX_INDICATOR_SIDEBAR_LABEL_WIDTH}
                    maxWidth={OKX_INDICATOR_SIDEBAR_LABEL_WIDTH}
                    flexShrink={0}
                    overflow="hidden"
                  >
                    <SizableText
                      fontSize={14}
                      lineHeight={18}
                      color={OKX_CHART_TEXT}
                      numberOfLines={1}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {indicator.label}
                    </SizableText>
                  </Stack>
                  <Icon
                    name="ChevronRightSmallOutline"
                    size="$4"
                    color="$icon"
                    flexShrink={0}
                  />
                </XStack>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
      {hasScrollableContent ? (
        <Stack
          position="absolute"
          top={scrollbarThumbTop}
          right={1}
          w={3}
          h={scrollbarThumbHeight}
          borderRadius={2}
          bg="$iconSubdued"
          pointerEvents="none"
        />
      ) : null}
    </Stack>
  );
}

function OkxIndicatorLinePreview({
  style,
  color = OKX_CHART_TEXT,
  width = 76,
}: {
  style: ITradingViewSettingsMockLineStyle;
  color?: string;
  width?: number;
}) {
  if (style === 'dashed') {
    return (
      <XStack w={width} h={2} gap={4} alignItems="center">
        {OKX_LINE_PREVIEW_DASHES.map((dash) => (
          <Stack key={dash} w={6} h={1} bg={color} />
        ))}
      </XStack>
    );
  }

  if (style === 'dotted') {
    return (
      <XStack w={width} h={2} gap={6} alignItems="center">
        {OKX_LINE_PREVIEW_DASHES.map((dot) => (
          <Stack key={dot} w={2} h={2} borderRadius={1} bg={color} />
        ))}
      </XStack>
    );
  }

  const lineHeight = {
    solid: 1,
    medium: 2,
    bold: 3,
    extraBold: 4,
  }[style];

  return <Stack w={width} h={lineHeight} bg={color} />;
}

function getOkxIndicatorLineStyleLabel(
  style: ITradingViewSettingsMockLineStyle | undefined,
) {
  if (style === 'dashed') {
    return '虚线';
  }

  return '实线';
}

function getOkxIndicatorLineStyleFromLabel(
  label: string,
): ITradingViewSettingsMockLineStyle {
  return label === '虚线' ? 'dashed' : 'solid';
}

function OkxIndicatorLineStyleSelect({
  value,
  testID,
  onChange,
}: {
  value: ITradingViewSettingsMockLineStyle;
  testID?: string;
  onChange: (value: ITradingViewSettingsMockLineStyle) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Stack position="relative" zIndex={isOpen ? 30 : 1}>
      <XStack
        testID={testID}
        w={120}
        h={34}
        px={12}
        alignItems="center"
        justifyContent="space-between"
        borderRadius={6}
        borderWidth={1}
        borderColor={isOpen ? '$borderActive' : OKX_CHART_SELECT_BORDER}
        bg={OKX_CHART_SELECT_BG}
        hoverStyle={{ borderColor: '$borderStrong', bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        cursor="pointer"
        onPress={() => setIsOpen((current) => !current)}
      >
        <OkxIndicatorLinePreview style={value} />
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$4"
          color="$icon"
        />
      </XStack>
      {isOpen ? (
        <YStack
          position="absolute"
          top={42}
          left={0}
          w={120}
          overflow="hidden"
          borderRadius={6}
          bg="$bgSubdued"
          zIndex={100}
        >
          {OKX_INDICATOR_LINE_STYLE_OPTIONS.map((option) => (
            <XStack
              key={option}
              h={33}
              px={13}
              alignItems="center"
              bg={option === value ? '$bgActive' : '$bgSubdued'}
              hoverStyle={{ bg: '$bgStrongHover' }}
              cursor="pointer"
              onPress={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              <OkxIndicatorLinePreview
                style={option}
                color="$text"
                width={94}
              />
            </XStack>
          ))}
        </YStack>
      ) : null}
    </Stack>
  );
}

function OkxIndicatorNumberInput({
  value,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const valueRef = useRef(value);
  const [inputValue, setInputValue] = useState(() => String(value));

  useEffect(() => {
    valueRef.current = value;
    setInputValue(String(value));
  }, [value]);

  const getDecimalPrecision = useCallback((numberValue: number) => {
    const stringValue = String(numberValue);
    const exponentSeparatorIndex = stringValue.indexOf('e-');
    if (exponentSeparatorIndex >= 0) {
      return Number(stringValue.slice(exponentSeparatorIndex + 2));
    }

    const decimalSeparatorIndex = stringValue.indexOf('.');
    return decimalSeparatorIndex >= 0
      ? stringValue.length - decimalSeparatorIndex - 1
      : 0;
  }, []);

  const normalizeValue = useCallback(
    (text: string, fallbackValue: number) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return fallbackValue;
      }

      const parsedValue = Number(trimmedText.replace(/,/g, ''));
      if (!Number.isFinite(parsedValue)) {
        return fallbackValue;
      }

      const boundedValue = Math.min(max, Math.max(min, parsedValue));
      if (!Number.isFinite(step) || step <= 0) {
        return boundedValue;
      }

      const stepBase = Number.isFinite(min) ? min : 0;
      const precision = Math.min(
        12,
        Math.max(getDecimalPrecision(step), getDecimalPrecision(stepBase)),
      );
      const steppedValue =
        stepBase + Math.round((boundedValue - stepBase) / step) * step;
      return Math.min(
        max,
        Math.max(min, Number(steppedValue.toFixed(precision))),
      );
    },
    [getDecimalPrecision, max, min, step],
  );

  const commitInputValue = useCallback(() => {
    const previousValue = valueRef.current;
    const nextValue = normalizeValue(inputValue, previousValue);
    valueRef.current = nextValue;
    setInputValue(String(nextValue));
    if (nextValue !== previousValue) {
      onChange(nextValue);
    }
  }, [inputValue, normalizeValue, onChange]);

  const stepInputValue = useCallback(
    (direction: -1 | 1) => {
      const effectiveStep = Number.isFinite(step) && step > 0 ? step : 1;
      const previousValue = valueRef.current;
      const currentValue = normalizeValue(inputValue, previousValue);
      const nextValue = normalizeValue(
        String(currentValue + direction * effectiveStep),
        currentValue,
      );
      valueRef.current = nextValue;
      setInputValue(String(nextValue));
      if (nextValue !== previousValue) {
        onChange(nextValue);
      }
    },
    [inputValue, normalizeValue, onChange, step],
  );

  return (
    <XStack
      w={120}
      h={32}
      overflow="hidden"
      alignItems="center"
      borderRadius={6}
      bg={OKX_CHART_SELECT_BG}
      hoverStyle={{ bg: '$bgStrongHover' }}
    >
      <Input
        testID="trading-view-indicator-number-input"
        size="small"
        value={inputValue}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        autoCorrect={false}
        fontSize={14}
        color={OKX_CHART_TEXT}
        containerProps={{
          flex: 1,
          h: 32,
          borderWidth: 0,
          borderRadius: 0,
          bg: 'transparent',
        }}
        InputComponentStyle={{
          h: 32,
          px: 11,
          py: 0,
          bg: 'transparent',
        }}
        onChangeText={setInputValue}
        onBlur={commitInputValue}
        onSubmitEditing={commitInputValue}
      />
      <YStack w={24} h={32} borderLeftWidth={1} borderLeftColor="$borderStrong">
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          cursor="pointer"
          onPress={() => stepInputValue(1)}
        >
          <Icon name="ChevronTopSmallOutline" size="$4" color="$iconSubdued" />
        </Stack>
        <Stack h={1} bg="$borderStrong" />
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          cursor="pointer"
          onPress={() => stepInputValue(-1)}
        >
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </Stack>
      </YStack>
    </XStack>
  );
}

function OkxIndicatorParameterRow({
  parameters,
  onChange,
}: {
  parameters: ITradingViewSettingsMockNumberParam[];
  onChange: (parameterId: string, value: number) => void;
}) {
  const firstParameter = parameters[0];
  if (!firstParameter) {
    return null;
  }

  return (
    <XStack h={48} alignItems="center">
      <SizableText
        w={OKX_INDICATOR_FIELD_LABEL_WIDTH}
        fontSize={14}
        lineHeight={18}
        color={OKX_CHART_TEXT}
      >
        {firstParameter.rowLabel ?? firstParameter.label}
      </SizableText>
      <XStack gap={8}>
        {parameters.map((parameter) => (
          <OkxIndicatorNumberInput
            key={parameter.id}
            value={parameter.value}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            onChange={(value) => onChange(parameter.id, value)}
          />
        ))}
      </XStack>
    </XStack>
  );
}

function groupOkxIndicatorParameters(
  parameters: ITradingViewSettingsMockNumberParam[] = [],
) {
  const rows: ITradingViewSettingsMockNumberParam[][] = [];
  const rowIndexes = new Map<string, number>();

  parameters.forEach((parameter) => {
    const rowKey = parameter.rowId ?? parameter.id;
    const rowIndex = rowIndexes.get(rowKey);
    if (rowIndex === undefined) {
      rowIndexes.set(rowKey, rows.length);
      rows.push([parameter]);
      return;
    }

    rows[rowIndex]?.push(parameter);
  });

  return rows;
}

function OkxIndicatorLineRow({
  line,
  colorPickerPlacement,
  onToggleLine,
  onPeriodChange,
  onStyleChange,
  onSecondaryStyleChange,
  onColorChange,
}: {
  line: ITradingViewSettingsMockLine;
  colorPickerPlacement: 'bottom' | 'top';
  onToggleLine: (lineId: string, enabled: boolean) => void;
  onPeriodChange: (lineId: string, period: number) => void;
  onStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onSecondaryStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onColorChange: (lineId: string, color: string) => void;
}) {
  const showCheckbox = line.showCheckbox !== false;
  const showPeriod = line.showPeriod !== false;
  const showStyle = line.showStyle !== false;
  const showColor = line.showColor !== false;
  const showSecondaryStyle = line.showSecondaryStyle === true;

  return (
    <XStack h={48} alignItems="center">
      <XStack w={OKX_INDICATOR_FIELD_LABEL_WIDTH} alignItems="center">
        {showCheckbox ? (
          <OkxChartCheckbox
            checked={line.enabled}
            onChange={(checked) => onToggleLine(line.id, checked)}
          />
        ) : null}
        <SizableText
          ml={showCheckbox ? 12 : 0}
          fontSize={14}
          lineHeight={18}
          color={OKX_CHART_TEXT}
        >
          {line.label}
        </SizableText>
      </XStack>
      {showPeriod ? (
        <OkxIndicatorNumberInput
          value={line.period}
          onChange={(period) => onPeriodChange(line.id, period)}
        />
      ) : null}
      {showStyle ? (
        <Stack ml={8}>
          <OkxIndicatorLineStyleSelect
            value={line.style}
            testID={`trading-view-indicator-line-style-${line.id}`}
            onChange={(style) => onStyleChange(line.id, style)}
          />
        </Stack>
      ) : null}
      {showColor ? (
        <Stack ml={line.colorOffset ?? (showPeriod || showStyle ? 8 : 0)}>
          <OkxChartColorPicker
            placement={line.colorPickerPlacement ?? colorPickerPlacement}
            align="right"
            pattern={line.colorPattern}
            value={line.color}
            testID={`trading-view-indicator-color-${line.id}`}
            onChange={(color) => onColorChange(line.id, color)}
          />
        </Stack>
      ) : null}
      {showSecondaryStyle ? (
        <Stack ml={8}>
          <OkxChartSelectMock
            value={getOkxIndicatorLineStyleLabel(line.secondaryStyle)}
            width={97}
            options={OKX_LINE_STYLE_OPTIONS}
            showLinePreview
            onChange={(value) =>
              onSecondaryStyleChange(
                line.id,
                getOkxIndicatorLineStyleFromLabel(value),
              )
            }
          />
        </Stack>
      ) : null}
    </XStack>
  );
}

function OkxIndicatorOpacitySlider({
  value,
  upColor,
  downColor,
  onChange,
  onColorChange,
}: {
  value: number;
  upColor: string;
  downColor: string;
  onChange: (value: number) => void;
  onColorChange: (
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
}) {
  const points = [0, 25, 50, 75, 100];
  const [isSliderHovered, setIsSliderHovered] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const isCurrentPointActive = isSliderHovered || isSliderDragging;
  const currentPointSize = isCurrentPointActive ? 12 : 8;
  const handleSliderPointerMove = useCallback(
    (event: PointerEvent) => {
      const currentTarget = event.currentTarget as unknown as {
        getBoundingClientRect?: () => { left: number };
      };
      const bounds = currentTarget.getBoundingClientRect?.();
      const pointerX = bounds
        ? event.nativeEvent.pageX - bounds.left
        : event.nativeEvent.offsetX;
      const currentPointX = 8 + (value / 100) * 370;
      setIsSliderHovered(Math.abs(pointerX - currentPointX) <= 8);
    },
    [value],
  );

  return (
    <YStack mt={18} gap={8}>
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
          透明度
        </SizableText>
        <XStack gap={18}>
          <OkxChartSolidSwatch
            color={upColor}
            placement="top"
            align="right"
            bare
            onChange={(color) => onColorChange('up', color)}
          />
          <OkxChartSolidSwatch
            color={downColor}
            placement="top"
            align="right"
            bare
            onChange={(color) => onColorChange('down', color)}
          />
        </XStack>
      </XStack>
      <XStack h={34} position="relative" alignItems="center">
        <Stack w={370} h={2} position="relative" bg="$borderStrong">
          <Stack w={(value / 100) * 370} h={2} bg="$text" />
        </Stack>
        <SizableText
          testID="trading-view-indicator-opacity-value"
          ml={28}
          fontSize={14}
          lineHeight={18}
          color={OKX_CHART_TEXT}
        >
          {value}%
        </SizableText>
        {points.map((point) => (
          <Stack
            key={point}
            position="absolute"
            left={(point / 100) * 370 - 4}
            top={13}
            w={8}
            h={8}
            borderRadius={4}
            borderWidth={1}
            borderColor={point < value ? '$text' : '$borderStrong'}
            bg={OKX_CHART_BG}
            pointerEvents="none"
          />
        ))}
        <Stack
          position="absolute"
          left={(value / 100) * 370 - currentPointSize / 2}
          top={17 - currentPointSize / 2}
          w={currentPointSize}
          h={currentPointSize}
          borderRadius={currentPointSize / 2}
          borderWidth={2}
          borderColor="$text"
          bg={OKX_CHART_BG}
          pointerEvents="none"
        />
        <Stack
          position="absolute"
          top={0}
          left={-8}
          w={386}
          h={34}
          opacity={0.001}
          cursor="pointer"
          onPointerEnter={handleSliderPointerMove}
          onPointerMove={handleSliderPointerMove}
          onPointerLeave={() => setIsSliderHovered(false)}
        >
          <Slider
            testID="trading-view-indicator-opacity-slider"
            w={386}
            h={34}
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(nextValue) => onChange(Math.round(nextValue))}
            onSlideStart={() => setIsSliderDragging(true)}
            onSlideEnd={() => setIsSliderDragging(false)}
          />
        </Stack>
      </XStack>
      <XStack w={370} justifyContent="space-between">
        <SizableText fontSize={12} lineHeight={14} color={OKX_CHART_TEXT}>
          0
        </SizableText>
        <SizableText fontSize={12} lineHeight={14} color={OKX_CHART_TEXT}>
          100%
        </SizableText>
      </XStack>
    </YStack>
  );
}

function OkxIndicatorContent({
  indicator,
  onToggleLine,
  onLinePeriodChange,
  onLineStyleChange,
  onLineSecondaryStyleChange,
  onLineColorChange,
  onOpacityChange,
  onOpacityColorChange,
  onParameterChange,
}: {
  indicator: ITradingViewSettingsMockIndicator | undefined;
  onToggleLine: (lineId: string, enabled: boolean) => void;
  onLinePeriodChange: (lineId: string, period: number) => void;
  onLineStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineSecondaryStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineColorChange: (lineId: string, color: string) => void;
  onOpacityChange: (indicatorId: string, opacity: number) => void;
  onOpacityColorChange: (
    indicatorId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
  onParameterChange: (parameterId: string, value: number) => void;
}) {
  if (!indicator) {
    return null;
  }

  const parameterRows = groupOkxIndicatorParameters(indicator.parameters);

  return (
    <ScrollView h={OKX_INDICATOR_BODY_HEIGHT} showsVerticalScrollIndicator>
      <YStack pt={31} pb={34} pl={31} pr={33} bg={OKX_CHART_BG}>
        <SizableText
          mb={22}
          fontSize={16}
          lineHeight={20}
          fontWeight="700"
          color={OKX_CHART_TEXT}
        >
          {indicator.title}
        </SizableText>
        {parameterRows.map((parameters) => (
          <OkxIndicatorParameterRow
            key={parameters[0]?.rowId ?? parameters[0]?.id}
            parameters={parameters}
            onChange={onParameterChange}
          />
        ))}
        {indicator.lines.map((line, index) => (
          <OkxIndicatorLineRow
            key={line.id}
            line={line}
            colorPickerPlacement={
              parameterRows.length + index <= 2 ? 'bottom' : 'top'
            }
            onToggleLine={onToggleLine}
            onPeriodChange={onLinePeriodChange}
            onStyleChange={onLineStyleChange}
            onSecondaryStyleChange={onLineSecondaryStyleChange}
            onColorChange={onLineColorChange}
          />
        ))}
        {indicator.showOpacity !== false ? (
          <OkxIndicatorOpacitySlider
            value={indicator.opacity}
            upColor={indicator.opacityColors?.upColor ?? OKX_CHART_UP}
            downColor={indicator.opacityColors?.downColor ?? OKX_CHART_DOWN}
            onChange={(value) => onOpacityChange(indicator.id, value)}
            onColorChange={(role, color) =>
              onOpacityColorChange(indicator.id, role, color)
            }
          />
        ) : null}
        {indicator.description ? (
          <YStack mt={30} gap={10}>
            <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
              指标说明
            </SizableText>
            <SizableText
              maxWidth={440}
              fontSize={13}
              lineHeight={20}
              color={OKX_CHART_TEXT_SUBDUED}
            >
              {indicator.description}
            </SizableText>
          </YStack>
        ) : null}
      </YStack>
    </ScrollView>
  );
}

function OkxIndicatorSettingsDialog({
  value,
  selectedIndicatorScope,
  selectedIndicatorId,
  visibleIndicators,
  selectedIndicator,
  onScopeChange,
  onSelectIndicator,
  onToggleIndicator,
  onToggleLine,
  onLinePeriodChange,
  onLineStyleChange,
  onLineSecondaryStyleChange,
  onLineColorChange,
  onOpacityChange,
  onOpacityColorChange,
  onParameterChange,
  onReset,
  onConfirm,
  onClose,
  isSubmitting = false,
}: {
  value: ITradingViewIndicatorSettingsValue;
  selectedIndicatorScope: ITradingViewSettingsMockIndicatorScope;
  selectedIndicatorId: string;
  visibleIndicators: ITradingViewSettingsMockIndicator[];
  selectedIndicator: ITradingViewSettingsMockIndicator | undefined;
  onScopeChange: (scope: ITradingViewSettingsMockIndicatorScope) => void;
  onSelectIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string, active: boolean) => void;
  onToggleLine: (lineId: string, enabled: boolean) => void;
  onLinePeriodChange: (lineId: string, period: number) => void;
  onLineStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineSecondaryStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineColorChange: (lineId: string, color: string) => void;
  onOpacityChange: (indicatorId: string, opacity: number) => void;
  onOpacityColorChange: (
    indicatorId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
  onParameterChange: (parameterId: string, value: number) => void;
  onReset: () => void;
  onConfirm?: () => void;
  onClose?: () => void;
  isSubmitting?: boolean;
}) {
  return (
    <YStack
      testID="trading-view-indicator-settings-okx-dialog"
      w={OKX_INDICATOR_SETTINGS_WIDTH}
      h={OKX_INDICATOR_SETTINGS_HEIGHT}
      overflow="hidden"
      borderWidth={1}
      borderColor={OKX_CHART_BORDER}
      borderRadius={6}
      bg={OKX_CHART_BG}
    >
      <XStack
        h={OKX_INDICATOR_HEADER_HEIGHT}
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
          指标设置
        </SizableText>
        <Stack
          w={28}
          h={28}
          alignItems="center"
          justifyContent="center"
          cursor={onClose ? 'pointer' : 'default'}
          onPress={onClose}
        >
          <Icon name="CrossedSmallOutline" size="$5" color="$icon" />
        </Stack>
      </XStack>
      <OkxIndicatorScopeTabs
        value={selectedIndicatorScope}
        indicators={value.indicators}
        onChange={onScopeChange}
      />
      <XStack h={OKX_INDICATOR_BODY_HEIGHT} minHeight={0}>
        <Stack
          w={OKX_INDICATOR_SIDEBAR_WIDTH}
          minWidth={OKX_INDICATOR_SIDEBAR_WIDTH}
          maxWidth={OKX_INDICATOR_SIDEBAR_WIDTH}
          flexShrink={0}
          position="relative"
          zIndex={1}
          bg={OKX_CHART_BG}
        >
          <OkxIndicatorSidebar
            indicators={visibleIndicators}
            selectedIndicatorId={selectedIndicatorId}
            onSelect={onSelectIndicator}
            onToggle={onToggleIndicator}
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
        <Stack
          flex={1}
          minWidth={0}
          position="relative"
          zIndex={2}
          overflow="visible"
          bg={OKX_CHART_BG}
        >
          <OkxIndicatorContent
            indicator={selectedIndicator}
            onToggleLine={onToggleLine}
            onLinePeriodChange={onLinePeriodChange}
            onLineStyleChange={onLineStyleChange}
            onLineSecondaryStyleChange={onLineSecondaryStyleChange}
            onLineColorChange={onLineColorChange}
            onOpacityChange={onOpacityChange}
            onOpacityColorChange={onOpacityColorChange}
            onParameterChange={onParameterChange}
          />
        </Stack>
      </XStack>
      <XStack
        h={OKX_INDICATOR_FOOTER_HEIGHT}
        alignItems="center"
        justifyContent="flex-end"
        gap={12}
        pr={28}
        borderTopWidth={1}
        borderTopColor={OKX_CHART_BORDER}
        bg={OKX_CHART_BG}
      >
        <XStack
          testID="trading-view-indicator-settings-mock-reset"
          w={84}
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
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onReset}
        >
          <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
            重置
          </SizableText>
        </XStack>
        <XStack
          testID="trading-view-indicator-settings-mock-confirm"
          w={84}
          h={36}
          alignItems="center"
          justifyContent="center"
          borderRadius={18}
          bg="$bgInverse"
          cursor={isSubmitting ? 'default' : 'pointer'}
          opacity={isSubmitting ? 0.5 : 1}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
          hoverStyle={{ opacity: 0.86 }}
          pressStyle={{ opacity: 0.72 }}
          onPress={onConfirm}
        >
          <SizableText
            fontSize={14}
            lineHeight={18}
            fontWeight="700"
            color="$textInverse"
          >
            确认
          </SizableText>
        </XStack>
      </XStack>
    </YStack>
  );
}

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

export function TradingViewIndicatorSettings({
  value,
  defaultValue,
  maxActiveSubIndicators = 4,
  isSubmitting = false,
  onChange,
  onConfirm,
  onCancel,
  onClose,
}: ITradingViewIndicatorSettingsProps) {
  const [
    settingsValue,
    updateSettingsValue,
    commitSettingsValue,
    cancelSettingsValue,
  ] = useSettingsDraftValue({
    value,
    defaultValue,
    createDefaultValue: createTradingViewIndicatorSettingsValue,
    onChange,
  });
  const [selectedIndicatorScope, setSelectedIndicatorScope] =
    useState<ITradingViewSettingsMockIndicatorScope>('main');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(() =>
    getDefaultTradingViewIndicatorIdForScope(settingsValue.indicators, 'main'),
  );

  const visibleIndicators = useMemo(
    () =>
      getTradingViewSettingsMockIndicatorsByScope(
        settingsValue,
        selectedIndicatorScope,
      ),
    [selectedIndicatorScope, settingsValue],
  );
  const selectedIndicator = useMemo(
    () =>
      visibleIndicators.find(
        (indicator) => indicator.id === selectedIndicatorId,
      ) ?? visibleIndicators[0],
    [selectedIndicatorId, visibleIndicators],
  );
  const effectiveSelectedIndicatorId = selectedIndicator?.id ?? '';

  const handleReset = useCallback(() => {
    const nextValue = createTradingViewIndicatorSettingsValue();
    updateSettingsValue(() => nextValue);
    if (
      !nextValue.indicators.some(
        (indicator) => indicator.id === selectedIndicatorId,
      )
    ) {
      setSelectedIndicatorId(
        getDefaultTradingViewIndicatorIdForScope(
          nextValue.indicators,
          selectedIndicatorScope,
        ),
      );
    }
  }, [selectedIndicatorId, selectedIndicatorScope, updateSettingsValue]);

  const handleToggleIndicator = useCallback(
    (indicatorId: string, active: boolean) => {
      updateSettingsValue((currentValue) =>
        toggleTradingViewSettingsMockIndicator(
          currentValue,
          indicatorId,
          active,
          maxActiveSubIndicators,
        ),
      );
    },
    [maxActiveSubIndicators, updateSettingsValue],
  );

  const handleClose = () => {
    cancelSettingsValue();
    onCancel?.();
    onClose?.();
  };

  const handleConfirm = () => {
    commitSettingsValue();
    void onConfirm?.(settingsValue);
  };

  return (
    <OkxIndicatorSettingsDialog
      value={settingsValue}
      selectedIndicatorScope={selectedIndicatorScope}
      selectedIndicatorId={effectiveSelectedIndicatorId}
      visibleIndicators={visibleIndicators}
      selectedIndicator={selectedIndicator}
      onScopeChange={(scope) => {
        setSelectedIndicatorScope(scope);
        const currentIndicator = settingsValue.indicators.find(
          (indicator) => indicator.id === effectiveSelectedIndicatorId,
        );
        if (currentIndicator?.scope !== scope) {
          setSelectedIndicatorId(
            getDefaultTradingViewIndicatorIdForScope(
              settingsValue.indicators,
              scope,
            ),
          );
        }
      }}
      onSelectIndicator={(indicatorId) => {
        const indicator = settingsValue.indicators.find(
          (item) => item.id === indicatorId,
        );
        if (indicator) {
          setSelectedIndicatorScope(indicator.scope);
          setSelectedIndicatorId(indicatorId);
        }
      }}
      onToggleIndicator={handleToggleIndicator}
      onToggleLine={(lineId, enabled) => {
        updateSettingsValue((currentValue) =>
          toggleTradingViewSettingsMockLine(currentValue, lineId, enabled),
        );
      }}
      onLinePeriodChange={(lineId, period) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLinePeriod(currentValue, lineId, period),
        );
      }}
      onLineStyleChange={(lineId, style) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLineStyle(currentValue, lineId, style),
        );
      }}
      onLineSecondaryStyleChange={(lineId, style) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLineSecondaryStyle(
            currentValue,
            lineId,
            style,
          ),
        );
      }}
      onLineColorChange={(lineId, color) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockLineColor(currentValue, lineId, color),
        );
      }}
      onOpacityChange={(indicatorId, opacity) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockIndicatorOpacity(
            currentValue,
            indicatorId,
            opacity,
          ),
        );
      }}
      onOpacityColorChange={(indicatorId, role, color) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockIndicatorOpacityColor(
            currentValue,
            indicatorId,
            role,
            color,
          ),
        );
      }}
      onParameterChange={(parameterId, nextValue) => {
        updateSettingsValue((currentValue) =>
          updateTradingViewSettingsMockIndicatorParameter(
            currentValue,
            parameterId,
            nextValue,
          ),
        );
      }}
      onReset={handleReset}
      onConfirm={handleConfirm}
      onClose={handleClose}
      isSubmitting={isSubmitting}
    />
  );
}

export function TradingViewChartSettingsMockGallery() {
  return <TradingViewChartSettings />;
}

export function TradingViewIndicatorSettingsMockGallery() {
  return <TradingViewIndicatorSettings />;
}

export function TradingViewSettingsMockGallery() {
  return (
    <YStack gap="$8">
      <TradingViewChartSettingsMockGallery />
      <TradingViewIndicatorSettingsMockGallery />
    </YStack>
  );
}
