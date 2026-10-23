// cspell:ignore heikin Ashi
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  ColorPicker,
  Divider,
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const LINE_STYLE_WIDTHS: Partial<Record<string, number>> = {
  solid: 1,
  medium: 2,
  bold: 3,
  extraBold: 4,
};
const LINE_PREVIEW_FLOATING_PANEL_PROPS = { width: 144 };

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
// Chart display selects share a width so their boxes line up in the group.
export const CHART_DISPLAY_SELECT_WIDTH = 160;

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
  controlsIndent = SETTINGS_ROW_CHECKBOX_LABEL_INDENT,
  onChange,
}: {
  label: string;
  testID?: string;
  value: boolean;
  disabled: boolean;
  children?: ReactNode;
  controlsIndent?: number;
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
        <XStack ml={controlsIndent} flexShrink={1}>
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
  lineWidth = 1,
}: {
  style: 'solid' | 'dashed';
  lineWidth?: number;
}) {
  return (
    <XStack width="100%" height="$5" alignItems="center" gap="$1">
      {Array.from({ length: style === 'dashed' ? 5 : 1 }).map((_, index) => (
        <XStack key={index} flex={1} height={lineWidth} bg="$iconSubdued" />
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
  width = 128,
  showLinePreview = false,
  renderOptionLabel,
  optionLabels,
  optionTranslationIds,
  optionIcons,
}: {
  testID: string;
  title: string;
  value: TValue;
  options: readonly TValue[];
  disabled: boolean;
  onChange: (value: TValue) => void;
  width?: number;
  showLinePreview?: boolean;
  renderOptionLabel?: (value: TValue) => ReactNode;
  optionLabels?: Partial<Record<TValue, string>>;
  optionTranslationIds?: Partial<Record<TValue, ETranslations>>;
  optionIcons?: Partial<Record<TValue, IKeyOfIcons>>;
}) {
  const intl = useIntl();
  const items = useMemo(
    () =>
      options.map((option) => ({
        value: option,
        label:
          optionLabels?.[option] ??
          formatOptionLabel(intl, option, optionTranslationIds),
        labelComponent:
          renderOptionLabel?.(option) ??
          (showLinePreview ? (
            <SettingsLineStylePreview
              style={option === 'dashed' ? 'dashed' : 'solid'}
              lineWidth={LINE_STYLE_WIDTHS[option] ?? 1}
            />
          ) : undefined),
        leading: optionIcons?.[option] ? (
          <Icon name={optionIcons[option]} size="$5" color="$iconSubdued" />
        ) : undefined,
      })),
    [
      intl,
      optionIcons,
      optionLabels,
      optionTranslationIds,
      options,
      renderOptionLabel,
      showLinePreview,
    ],
  );

  return (
    <Select
      testID={`trading-view-settings-select-${testID}`}
      title={title}
      value={value}
      disabled={disabled}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={
        showLinePreview ? LINE_PREVIEW_FLOATING_PANEL_PROPS : undefined
      }
      defaultTriggerInputProps={{
        size: 'small',
        width,
        pr: '$8',
        // The default trigger sets flex: 1 on the input. Native resolves that
        // to a zero flex basis that ignores `width`, so the input shrinks to
        // its padding and hides the value. flex: 0 keeps `width` as the basis.
        flex: 0,
        leftIconName: optionIcons?.[value],
      }}
      items={items}
    />
  );
}
