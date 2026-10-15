import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Divider,
  Keyboard,
  Page,
  SegmentSlider,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import {
  applyMobileIndicatorNumberDrafts,
  createMobileIndicatorNumberDrafts,
  getMobileIndicatorLineNumberField,
  getMobileIndicatorNumberFields,
  normalizeMobileIndicatorNumber,
} from './mobileIndicatorSettingsUtils';
import {
  MobileIndicatorColorPicker,
  MobileIndicatorLineStyle,
  MobileIndicatorNumberInput,
} from './TradingViewMobileIndicatorFields';

import type { IMobileIndicatorNumberField } from './mobileIndicatorSettingsUtils';
import type {
  ITradingViewIndicatorSettingsItem,
  ITradingViewIndicatorSettingsLine,
} from '../TradingViewChartControls/chartSettings';

export function TradingViewMobileIndicatorEditor({
  indicator,
  defaultIndicator,
  onSave,
  onClose,
}: {
  indicator: ITradingViewIndicatorSettingsItem;
  defaultIndicator: ITradingViewIndicatorSettingsItem;
  onSave: (value: ITradingViewIndicatorSettingsItem) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const intl = useIntl();
  const [draft, setDraft] = useState(indicator);
  const draftRef = useRef(draft);
  const [numbers, setNumbers] = useState(() =>
    createMobileIndicatorNumberDrafts(indicator),
  );
  const numbersRef = useRef(numbers);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateDraft = useCallback((next: ITradingViewIndicatorSettingsItem) => {
    draftRef.current = next;
    setDraft(next);
  }, []);
  const updateNumbers = useCallback((next: Record<string, string>) => {
    // Save and Reset must see the latest text even before blur/state updates.
    numbersRef.current = next;
    setNumbers(next);
  }, []);
  const updateLine = useCallback(
    (id: string, patch: Partial<ITradingViewIndicatorSettingsLine>) => {
      const current = draftRef.current;
      updateDraft({
        ...current,
        lines: current.lines.map((line) =>
          line.id === id ? { ...line, ...patch } : line,
        ),
      });
    },
    [updateDraft],
  );
  const commitNumber = useCallback(
    (key: string, direction?: -1 | 1) => {
      const current = draftRef.current;
      const field = getMobileIndicatorNumberFields(current).find(
        (item) => item.key === key,
      );
      if (!field) {
        return;
      }
      let value = normalizeMobileIndicatorNumber(
        numbersRef.current[key] ?? '',
        field,
      );
      if (direction) {
        value = normalizeMobileIndicatorNumber(
          String(value + direction * (field.step ?? 1)),
          field,
        );
      }
      const nextNumbers = { ...numbersRef.current, [key]: String(value) };
      updateNumbers(nextNumbers);
      updateDraft({
        ...current,
        parameters: current.parameters?.map((parameter) =>
          field.target === 'parameter' && parameter.id === field.id
            ? { ...parameter, value }
            : parameter,
        ),
        lines: current.lines.map((line) =>
          field.target === 'line' && line.id === field.id
            ? { ...line, period: value }
            : line,
        ),
      });
    },
    [updateDraft, updateNumbers],
  );
  const handleReset = useCallback(() => {
    const next = { ...defaultIndicator, active: draftRef.current.active };
    updateDraft(next);
    updateNumbers(createMobileIndicatorNumberDrafts(next));
    Keyboard.dismiss();
  }, [defaultIndicator, updateDraft, updateNumbers]);
  const handleSave = useCallback(async () => {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const next = applyMobileIndicatorNumberDrafts(
      draftRef.current,
      numbersRef.current,
    );
    updateDraft(next);
    updateNumbers(createMobileIndicatorNumberDrafts(next));
    Keyboard.dismiss();
    try {
      await onSave(next);
      if (mountedRef.current) {
        onClose();
      }
    } catch {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      });
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [intl, onClose, onSave, updateDraft, updateNumbers]);

  const fields = getMobileIndicatorNumberFields(draft);
  const pairedFields = new Set(
    draft.lines.map(
      (line) => getMobileIndicatorLineNumberField(line, fields)?.key,
    ),
  );
  const parameters = fields.filter((field) => !pairedFields.has(field.key));
  const styledLines = draft.lines.filter(
    (line) => line.showStyle !== false || line.showSecondaryStyle,
  );
  const renderNumber = (field: IMobileIndicatorNumberField) => (
    <MobileIndicatorNumberInput
      field={field}
      value={numbers[field.key] ?? String(field.value)}
      disabled={saving}
      onChange={(text) =>
        updateNumbers({ ...numbersRef.current, [field.key]: text })
      }
      onCommit={() => commitNumber(field.key)}
      onStep={(direction) => commitNumber(field.key, direction)}
    />
  );

  return (
    <Page
      testID={`trading-view-mobile-indicator-editor-${indicator.id}`}
      scrollEnabled
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'on-drag',
        contentContainerStyle: { pb: '$6' },
      }}
    >
      <Page.Header title={indicator.label} />
      <Page.Body px="$5" pt="$4">
        {parameters.map((field) => (
          <XStack
            key={field.key}
            minHeight={64}
            py="$2"
            gap="$3"
            alignItems="center"
            justifyContent="space-between"
          >
            <SizableText flex={1} size="$bodyLg" flexShrink={1}>
              {field.label}
            </SizableText>
            {renderNumber(field)}
          </XStack>
        ))}
        {parameters.length &&
        draft.lines.some((line) => line.showCheckbox !== false) ? (
          <Divider my="$4" />
        ) : null}
        {draft.lines.map((line) => {
          const field = getMobileIndicatorLineNumberField(line, fields);
          if (
            line.showCheckbox === false &&
            line.showColor === false &&
            !field
          ) {
            return null;
          }
          return (
            <XStack
              key={line.id}
              testID={`mobile-indicator-line-${line.id}`}
              minHeight={68}
              py="$2"
              gap="$3"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
            >
              {line.showCheckbox !== false ? (
                <Checkbox
                  testID={`mobile-indicator-enabled-${line.id}`}
                  value={line.enabled}
                  label={line.label}
                  disabled={saving}
                  labelProps={{ variant: '$bodyLg' }}
                  labelContainerProps={{
                    flex: 1,
                    minWidth: 0,
                    py: '$0',
                    my: '$0',
                  }}
                  containerProps={{
                    flex: 1,
                    minWidth: 84,
                    minHeight: 48,
                    alignItems: 'center',
                  }}
                  onChange={(enabled) =>
                    updateLine(line.id, { enabled: enabled === true })
                  }
                />
              ) : (
                <SizableText flex={1} minWidth={84} size="$bodyLg">
                  {line.label}
                </SizableText>
              )}
              <XStack gap="$2" alignItems="center" marginLeft="auto">
                {line.showColor !== false ? (
                  <MobileIndicatorColorPicker
                    testID={`mobile-indicator-color-${line.id}`}
                    value={line.color}
                    disabled={saving}
                    onChange={(color) => updateLine(line.id, { color })}
                  />
                ) : null}
                {field ? renderNumber(field) : null}
              </XStack>
            </XStack>
          );
        })}
        {draft.showOpacity !== false ? (
          <YStack gap="$4" py="$4">
            <Divider />
            <XStack gap="$5">
              {(['up', 'down'] as const).map((role) => (
                <XStack
                  key={role}
                  flex={1}
                  gap="$3"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <SizableText size="$bodyLg">
                    {intl.formatMessage({
                      id:
                        role === 'up'
                          ? ETranslations.market_chart_settings__up
                          : ETranslations.market_chart_settings__down,
                    })}
                  </SizableText>
                  <MobileIndicatorColorPicker
                    testID={`mobile-indicator-color-${role}`}
                    disabled={saving}
                    value={
                      draft.opacityColors?.[`${role}Color`] ??
                      TRADING_VIEW_NATIVE_THEME_COLORS[
                        role === 'up' ? 'positive' : 'negative'
                      ]
                    }
                    onChange={(color) => {
                      const current = draftRef.current;
                      updateDraft({
                        ...current,
                        opacityColors: {
                          upColor:
                            current.opacityColors?.upColor ??
                            TRADING_VIEW_NATIVE_THEME_COLORS.positive,
                          downColor:
                            current.opacityColors?.downColor ??
                            TRADING_VIEW_NATIVE_THEME_COLORS.negative,
                          [`${role}Color`]: color,
                        },
                      });
                    }}
                  />
                </XStack>
              ))}
            </XStack>
            <XStack justifyContent="space-between" gap="$3">
              <SizableText size="$bodyLg">
                {intl.formatMessage({
                  id: ETranslations.market_chart_indicator_transparency__label,
                })}
              </SizableText>
              <SizableText size="$bodyLgMedium">{draft.opacity}%</SizableText>
            </XStack>
            <SegmentSlider
              min={0}
              max={100}
              segments={4}
              value={draft.opacity}
              disabled={saving}
              onChange={(opacity) =>
                updateDraft({
                  ...draftRef.current,
                  opacity: Math.round(opacity),
                })
              }
            />
          </YStack>
        ) : null}
        {styledLines.length ? (
          <YStack mt="$4">
            <Divider />
            <Button
              testID="mobile-indicator-advanced"
              variant="tertiary"
              minHeight={56}
              justifyContent="space-between"
              px="$0"
              m="$0"
              iconAfter={advanced ? 'ChevronTopOutline' : 'ChevronDownOutline'}
              accessibilityState={{ expanded: advanced }}
              onPress={() => setAdvanced((current) => !current)}
            >
              {intl.formatMessage({
                id: ETranslations.global_advanced_settings,
              })}
            </Button>
            {advanced
              ? styledLines.map((line) => (
                  <MobileIndicatorLineStyle
                    key={line.id}
                    line={line}
                    disabled={saving}
                    onChange={(patch) => updateLine(line.id, patch)}
                  />
                ))
              : null}
          </YStack>
        ) : null}
        {indicator.description ? (
          <SizableText size="$bodyMd" color="$textSubdued" mt="$5">
            {indicator.description}
          </SizableText>
        ) : null}
      </Page.Body>
      <Page.Footer>
        <XStack
          px="$5"
          py="$4"
          gap="$3"
          bg="$bgApp"
          borderTopWidth={1}
          borderTopColor="$borderSubdued"
        >
          <Button
            testID="mobile-indicator-reset"
            flex={1}
            size="large"
            disabled={saving}
            onPress={handleReset}
          >
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </Button>
          <Button
            testID="mobile-indicator-save"
            flex={1}
            size="large"
            variant="primary"
            loading={saving}
            onPress={handleSave}
          >
            {intl.formatMessage({ id: ETranslations.action_save })}
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}
