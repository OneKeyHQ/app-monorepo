// cspell:ignore heikin Ashi
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  ColorPicker,
  Divider,
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TRADING_VIEW_SETTINGS_COLOR_PALETTE } from './TradingViewSettingsShared';

export const SELECT_OPTION_TRANSLATION_IDS: Record<string, ETranslations> = {
  auto: ETranslations.global_auto,
  candlestick: ETranslations.market_candle,
  heikinAshi: ETranslations.market_heikin_ashi,
  bars: ETranslations.market_bars,
  line: ETranslations.market_line,
  area: ETranslations.market_area,
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

export function formatOptionLabel(
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

export function formatTestID(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

// Settings rows keep a label and its controls on one line while both fit.
// Otherwise the row wraps and the controls start the next line, left-aligned
// under the label text, rather than squeezing the label: react-native-web gives
// flex children `min-width: 0`, so a squeezed label breaks into one glyph per
// line. Checkbox rows indent that line past the 20px box and the label's 8px
// leading padding so it lines up with the first letter of the label.
export const SETTINGS_ROW_CHECKBOX_LABEL_INDENT = 28;

export function SettingsGroup({
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

export function SettingsRow({
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
      columnGap="$3"
      rowGap="$1.5"
      flexWrap="wrap"
      alignItems="center"
      justifyContent="space-between"
      borderRadius="$3"
      role={interactive ? 'button' : undefined}
      cursor={interactive ? 'pointer' : undefined}
      hoverStyle={interactive ? { bg: '$bgHover' } : undefined}
      pressStyle={interactive ? { bg: '$bgActive' } : undefined}
      onPress={onPress}
    >
      <SizableText size="$bodyMdMedium" flexShrink={1}>
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

export function SettingsCheckboxRow({
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
      columnGap="$3"
      rowGap="$1.5"
      flexWrap="wrap"
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
        // Drop the default web `flex: 1` so the label is sized by its text and
        // the row can tell when the controls no longer fit beside it.
        labelContainerProps={{
          py: '$0',
          my: '$0',
          justifyContent: 'center',
          flex: undefined,
        }}
        onChange={(checked) => onChange(Boolean(checked))}
      />
      {children ? (
        <XStack ml={SETTINGS_ROW_CHECKBOX_LABEL_INDENT} flexShrink={1}>
          {children}
        </XStack>
      ) : null}
    </XStack>
  );
}

export function SettingsColorPicker({
  testID,
  value,
  disabled,
  onChange,
}: {
  testID?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker
      value={value}
      colors={TRADING_VIEW_SETTINGS_COLOR_PALETTE}
      columns={5}
      triggerSize={32}
      disabled={disabled}
      testID={testID}
      onChange={onChange}
    />
  );
}

export function SettingsColorField({
  label,
  testID,
  value,
  disabled,
  onChange,
}: {
  label?: string;
  testID?: string;
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
        testID={testID}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </XStack>
  );
}

export function SettingsLineStylePreview({
  style,
}: {
  style: 'solid' | 'dashed';
}) {
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

export function SettingsSelect<TValue extends string>({
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
