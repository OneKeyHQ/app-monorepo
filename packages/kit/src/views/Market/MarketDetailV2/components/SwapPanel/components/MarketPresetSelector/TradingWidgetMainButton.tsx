import {
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';

export type ITradingWidgetMainButtonVariant = 'full' | 'compact';

export type ITradingWidgetMainButtonPressEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export type ITradingWidgetMainButtonPresetOption<T extends string> = {
  label: string;
  value: T;
  testID?: string;
};

type ITradingWidgetMainButtonProps<T extends string> = {
  variant: ITradingWidgetMainButtonVariant;
  presetOptions: ITradingWidgetMainButtonPresetOption<T>[];
  selectedPresetLabel: string;
  selectedPresetValue: T;
  slippageIconName?: IIconProps['name'];
  slippageLabel: string;
  priorityFeeLabel: string;
  showAntiMEV?: boolean;
  onPresetChange: (value: T) => void;
  onOpenSettings: () => void;
  onQuickPresetPress?: (event?: ITradingWidgetMainButtonPressEvent) => void;
  testID?: string;
};

function TradingWidgetPresetButton<T extends string>({
  onPresetChange,
  option,
  selected,
}: {
  onPresetChange: (value: T) => void;
  option: ITradingWidgetMainButtonPresetOption<T>;
  selected: boolean;
}) {
  return (
    <XStack
      accessibilityRole="button"
      alignItems="center"
      bg={selected ? '$bgActive' : '$transparent'}
      borderRadius="$full"
      cursor="pointer"
      flex={1}
      justifyContent="center"
      minHeight={30}
      minWidth={0}
      px="$2.5"
      py="$1"
      hoverStyle={{ bg: selected ? '$bgActive' : '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={() => {
        if (!selected) {
          onPresetChange(option.value);
        }
      }}
      testID={option.testID}
    >
      <SizableText
        size="$bodyMdMedium"
        color={selected ? '$text' : '$textSubdued'}
        numberOfLines={1}
      >
        {option.label}
      </SizableText>
    </XStack>
  );
}

function TradingWidgetMainButtonInfoRow<T extends string>({
  variant,
  selectedPresetLabel,
  slippageIconName = 'SliderVerOutline',
  slippageLabel,
  priorityFeeLabel,
  showAntiMEV,
  onOpenSettings,
  onQuickPresetPress,
}: Pick<
  ITradingWidgetMainButtonProps<T>,
  | 'variant'
  | 'selectedPresetLabel'
  | 'slippageIconName'
  | 'slippageLabel'
  | 'priorityFeeLabel'
  | 'showAntiMEV'
  | 'onOpenSettings'
  | 'onQuickPresetPress'
>) {
  const compact = variant === 'compact';

  return (
    <XStack
      alignItems="center"
      justifyContent={compact ? 'flex-start' : 'space-between'}
      bg={compact ? '$bgStrong' : undefined}
      borderRadius={compact ? '$2' : undefined}
      borderWidth={0}
      cursor="pointer"
      gap={compact ? '$1' : '$3'}
      minHeight={compact ? '$8' : 20}
      pl={compact ? '$3.5' : 0}
      pr={compact ? '$2.5' : 0}
      py={compact ? '$1.5' : 0}
      width="100%"
      hoverStyle={compact ? { bg: '$bgHover' } : undefined}
      pressStyle={compact ? { bg: '$bgActive' } : undefined}
      onPress={onOpenSettings}
      testID="market-preset-settings-trigger"
    >
      {compact ? (
        <XStack
          accessibilityRole="button"
          alignItems="center"
          flexShrink={0}
          onPress={onQuickPresetPress}
          testID="market-preset-quick-switch"
        >
          <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
            {selectedPresetLabel}
          </SizableText>
        </XStack>
      ) : null}

      <XStack
        alignItems="center"
        justifyContent={compact ? 'flex-end' : 'flex-start'}
        flex={1}
        minWidth={0}
      >
        <XStack
          alignItems="center"
          flexShrink={0}
          gap="$2"
          justifyContent="center"
          minWidth={57}
        >
          <Icon name={slippageIconName} size="$4.5" color="$iconSubdued" />
          <SizableText
            size="$bodyMdMedium"
            color="$textSubdued"
            numberOfLines={1}
          >
            {slippageLabel}
          </SizableText>
        </XStack>

        <Divider vertical h={12} mx="$2" />

        <XStack alignItems="center" gap="$2" minWidth={0}>
          <Icon name="HandCoinsOutline" size="$4.5" color="$iconSubdued" />
          <SizableText
            size="$bodyMdMedium"
            color="$textSubdued"
            numberOfLines={1}
          >
            {priorityFeeLabel}
          </SizableText>
        </XStack>

        {showAntiMEV ? <Divider vertical h={12} mx="$2" /> : null}

        <XStack
          alignItems="center"
          justifyContent="flex-end"
          gap={compact ? '$1' : '$3'}
          flex={compact ? undefined : 1}
        >
          {showAntiMEV ? (
            <Icon
              name="ShieldCheckDoneSolid"
              size="$4.5"
              color="$iconSuccess"
            />
          ) : null}
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
    </XStack>
  );
}

export function TradingWidgetMainButton<T extends string>({
  variant,
  presetOptions,
  selectedPresetLabel,
  selectedPresetValue,
  slippageIconName,
  slippageLabel,
  priorityFeeLabel,
  showAntiMEV,
  onPresetChange,
  onOpenSettings,
  onQuickPresetPress,
  testID,
}: ITradingWidgetMainButtonProps<T>) {
  if (variant === 'compact') {
    return (
      <YStack width="100%" testID={testID}>
        <TradingWidgetMainButtonInfoRow
          variant={variant}
          selectedPresetLabel={selectedPresetLabel}
          slippageIconName={slippageIconName}
          slippageLabel={slippageLabel}
          priorityFeeLabel={priorityFeeLabel}
          showAntiMEV={showAntiMEV}
          onOpenSettings={onOpenSettings}
          onQuickPresetPress={onQuickPresetPress}
        />
      </YStack>
    );
  }

  return (
    <YStack gap="$3" width="100%" testID={testID}>
      <XStack alignItems="center" gap="$2" justifyContent="center" width="100%">
        {presetOptions.map((option) => (
          <TradingWidgetPresetButton
            key={option.value}
            option={option}
            selected={option.value === selectedPresetValue}
            onPresetChange={onPresetChange}
          />
        ))}
      </XStack>

      <TradingWidgetMainButtonInfoRow
        variant={variant}
        selectedPresetLabel={selectedPresetLabel}
        slippageIconName={slippageIconName}
        slippageLabel={slippageLabel}
        priorityFeeLabel={priorityFeeLabel}
        showAntiMEV={showAntiMEV}
        onOpenSettings={onOpenSettings}
        onQuickPresetPress={onQuickPresetPress}
      />
    </YStack>
  );
}
