import { useIntl } from 'react-intl';

import {
  Button,
  ColorPicker,
  IconButton,
  Input,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TRADING_VIEW_SETTINGS_COLOR_PALETTE } from '../TradingViewChartControls/chartSettings/TradingViewSettingsShared';

import type { IMobileIndicatorNumberField } from './mobileIndicatorSettingsUtils';
import type {
  ITradingViewIndicatorSettingsLine,
  ITradingViewIndicatorSettingsLineStyle,
} from '../TradingViewChartControls/chartSettings';

export function MobileIndicatorNumberInput({
  field,
  value,
  disabled,
  onChange,
  onCommit,
  onStep,
}: {
  field: IMobileIndicatorNumberField;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onStep: (direction: -1 | 1) => void;
}) {
  const testID = `mobile-indicator-number-${field.key}`;
  return (
    <XStack
      width={164}
      height={48}
      alignItems="center"
      bg="$bgSubdued"
      borderRadius="$3"
      flexShrink={0}
    >
      <IconButton
        testID={`${testID}-decrement`}
        icon="MinusSmallOutline"
        accessibilityLabel={`${field.label} −`}
        variant="tertiary"
        m={0}
        width={48}
        height={48}
        disabled={disabled}
        onPress={() => onStep(-1)}
      />
      <Input
        testID={testID}
        accessibilityLabel={field.label}
        value={value}
        disabled={disabled}
        size="large"
        height={48}
        pl="$0"
        pr="$0"
        textAlign="center"
        containerProps={{ flex: 1, borderWidth: 0, bg: '$transparent' }}
        keyboardType={field.min < 0 ? 'default' : 'decimal-pad'}
        returnKeyType="done"
        autoCorrect={false}
        selectTextOnFocus
        onChangeText={onChange}
        onBlur={onCommit}
        onSubmitEditing={onCommit}
      />
      <IconButton
        testID={`${testID}-increment`}
        icon="PlusSmallOutline"
        accessibilityLabel={`${field.label} +`}
        variant="tertiary"
        m={0}
        width={48}
        height={48}
        disabled={disabled}
        onPress={() => onStep(1)}
      />
    </XStack>
  );
}

export function MobileIndicatorColorPicker({
  value,
  testID,
  disabled,
  onChange,
}: {
  value: string;
  testID: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <ColorPicker
      testID={testID}
      value={value}
      colors={TRADING_VIEW_SETTINGS_COLOR_PALETTE}
      columns={5}
      triggerSize={44}
      swatchSize={44}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

const LINE_WIDTHS = [
  ['solid', 1],
  ['medium', 2],
  ['bold', 3],
  ['extraBold', 4],
] as const satisfies readonly (readonly [
  ITradingViewIndicatorSettingsLineStyle,
  number,
])[];

export function MobileIndicatorLineStyle({
  line,
  disabled,
  onChange,
}: {
  line: ITradingViewIndicatorSettingsLine;
  disabled?: boolean;
  onChange: (patch: Partial<ITradingViewIndicatorSettingsLine>) => void;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({
    id: ETranslations.market_chart_settings__line_style,
  });
  return (
    <YStack gap="$3" py="$3">
      <SizableText size="$bodyMdMedium">{line.label}</SizableText>
      {line.showStyle !== false ? (
        <XStack gap="$2">
          {LINE_WIDTHS.map(([style, width]) => (
            <Button
              key={style}
              testID={`mobile-indicator-style-${line.id}-${style}`}
              accessibilityLabel={`${line.label} ${title} ${width}`}
              accessibilityState={{ selected: line.style === style }}
              flex={1}
              height={48}
              childrenAsText={false}
              borderWidth={1}
              borderColor={
                line.style === style ? '$borderActive' : '$borderSubdued'
              }
              bg={line.style === style ? '$bgActive' : '$bgSubdued'}
              disabled={disabled}
              onPress={() => onChange({ style })}
            >
              <Stack width={28} height={width} bg="$text" />
            </Button>
          ))}
        </XStack>
      ) : null}
      {line.showSecondaryStyle ? (
        <XStack gap="$2">
          {(['solid', 'dashed'] as const).map((secondaryStyle) => (
            <Button
              key={secondaryStyle}
              testID={`mobile-indicator-secondary-style-${line.id}-${secondaryStyle}`}
              accessibilityState={{
                selected: (line.secondaryStyle ?? 'solid') === secondaryStyle,
              }}
              flex={1}
              minHeight={48}
              borderWidth={1}
              borderColor={
                (line.secondaryStyle ?? 'solid') === secondaryStyle
                  ? '$borderActive'
                  : '$borderSubdued'
              }
              disabled={disabled}
              onPress={() => onChange({ secondaryStyle })}
            >
              {intl.formatMessage({
                id:
                  secondaryStyle === 'solid'
                    ? ETranslations.market_chart_settings__solid_line
                    : ETranslations.market_chart_indicator_dashed_line__label,
              })}
            </Button>
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}
