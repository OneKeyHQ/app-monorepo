import { useState } from 'react';

import { SizableText, Stack, XStack, useTheme } from '@onekeyhq/components';

import { TradingViewPanelButton } from './TradingViewPanelButton';
import { TradingViewPanelIcon } from './TradingViewPanelIcon';

import type { ITradingViewLayoutSelectorProps } from './TradingViewLayoutSelector';

const LAYOUT_OPTIONS = [
  { label: '1 × 1', value: 1, icon: 'single' },
  { label: '1 × 2', value: 2, icon: 'columns' },
  { label: '2 × 2', value: 4, icon: 'grid' },
] as const;

export function TradingViewLayoutSelector({
  title,
  panelCount,
  icon,
  onChange,
}: ITradingViewLayoutSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();

  return (
    <Stack alignItems="flex-end" gap="$1">
      <TradingViewPanelButton
        icon={icon}
        accessibilityLabel={title}
        testID="trading-view-chart-layout-trigger"
        onPress={() => setIsOpen((current) => !current)}
      />
      {isOpen ? (
        <Stack
          testID="trading-view-chart-layout-menu"
          width={180}
          padding="$1"
          bg="$bgApp"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$2"
          style={{ elevation: 8 }}
        >
          {LAYOUT_OPTIONS.map((option) => (
            <XStack
              key={option.value}
              testID={`trading-view-chart-layout-option-${option.value}`}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: panelCount === option.value }}
              height={44}
              px="$3"
              gap="$3"
              alignItems="center"
              borderRadius="$1"
              bg={panelCount === option.value ? '$bgActive' : undefined}
              pressStyle={{ bg: '$bgHover' }}
              onPress={() => {
                setIsOpen(false);
                onChange(option.value);
              }}
            >
              <TradingViewPanelIcon
                name={option.icon}
                size={20}
                color={theme.iconSubdued.val}
              />
              <SizableText size="$bodyMd">{option.label}</SizableText>
            </XStack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
