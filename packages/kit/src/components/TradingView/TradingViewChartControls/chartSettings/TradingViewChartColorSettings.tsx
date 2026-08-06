import type { IIconProps } from '@onekeyhq/components';
import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  OKX_CHART_BG,
  OKX_CHART_BORDER,
  OKX_CHART_DOWN,
  OKX_CHART_TEXT,
  OKX_CHART_UP,
} from './TradingViewSettingsShared';

import type {
  ITradingViewChartSettingsColorMode,
  ITradingViewChartSettingsPriceColorMode,
} from './TradingViewSettingsMockState';

const OKX_COLOR_SETTING_PANEL_WIDTH = 423;
const OKX_COLOR_SETTING_PANEL_HEIGHT = 374;

export function OkxChartColorSettingsPanel({
  colorMode,
  priceColorMode,
  onColorModeChange,
  onPriceColorModeChange,
  onClose,
  isDisabled = false,
}: {
  colorMode: ITradingViewChartSettingsColorMode;
  priceColorMode: ITradingViewChartSettingsPriceColorMode;
  onColorModeChange: (value: ITradingViewChartSettingsColorMode) => void;
  onPriceColorModeChange: (
    value: ITradingViewChartSettingsPriceColorMode,
  ) => void;
  onClose: () => void;
  isDisabled?: boolean;
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
      pointerEvents={isDisabled ? 'none' : 'auto'}
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
