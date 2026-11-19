import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  ColorPicker,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TRADING_VIEW_SETTINGS_COLOR_PALETTE } from '../../TradingViewChartControls/chartSettings/TradingViewSettingsShared';

import { getDefaultDrawingLevels } from './fibonacci';
import {
  DRAWING_FONT_SIZES,
  DRAWING_TOOLS,
  isFibonacciTool,
  isRangeTool,
  isTextDrawingTool,
} from './model';

import type { IDrawingLevel, IDrawingStyle, IDrawingTool } from './model';

const STAMP_LABEL_IDS: Record<
  NonNullable<IDrawingStyle['stamp']>,
  ETranslations
> = {
  smile: ETranslations.market_drawing_smile__title,
  heart: ETranslations.market_drawing_heart__title,
  star: ETranslations.market_drawing_star__title,
  check: ETranslations.market_drawing_check__title,
  cross: ETranslations.market_drawing_cross__title,
  arrowUp: ETranslations.market_drawing_arrow_up__title,
  arrowDown: ETranslations.market_drawing_arrow_down__title,
};

const LABEL_POSITION_LABEL_IDS: Record<
  NonNullable<IDrawingStyle['labelPosition']>,
  ETranslations
> = {
  left: ETranslations.market_drawing_left__title,
  center: ETranslations.market_drawing_center__title,
  right: ETranslations.market_drawing_right__title,
};

function NumberField({
  name,
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const number = Number(text);
    if (
      text.trim() &&
      Number.isFinite(number) &&
      number >= min &&
      number <= max
    ) {
      if (number !== value) onChange(number);
    } else setText(String(value));
  };
  return (
    <Input
      testID={`drawing-style-${name}`}
      accessibilityLabel={label}
      value={text}
      disabled={disabled}
      size="small"
      width={88}
      keyboardType={min < 0 ? 'default' : 'decimal-pad'}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
    />
  );
}

function StyleColor({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <ColorPicker
      testID={`drawing-style-${label}`}
      value={value}
      colors={TRADING_VIEW_SETTINGS_COLOR_PALETTE}
      columns={5}
      triggerSize={28}
      swatchSize={32}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

export function DrawingStyleOptions({
  tool,
  style,
  disabled,
  onChange,
}: {
  tool: IDrawingTool | 'cursor';
  style: IDrawingStyle;
  disabled: boolean;
  onChange: (patch: Partial<IDrawingStyle>) => void;
}) {
  const intl = useIntl();
  if (tool === 'cursor' || tool === 'measure') return null;
  const group = DRAWING_TOOLS[tool].group;
  const fibonacci =
    isFibonacciTool(tool) ||
    group === 'Gann' ||
    group === 'Pitchforks' ||
    tool === 'pitchfan';
  const range = isRangeTool(tool);
  const shape =
    [
      'rectangle',
      'ellipse',
      'triangle',
      'channel',
      'circle',
      'rotatedRectangle',
      'flatChannel',
      'disjointChannel',
      'regression',
      'projection',
      'longPosition',
      'shortPosition',
    ].includes(tool) || group === 'Patterns';
  const bubble =
    isTextDrawingTool(tool) &&
    tool !== 'text' &&
    tool !== 'anchoredText' &&
    tool !== 'table' &&
    tool !== 'flag';
  const text = isTextDrawingTool(tool);
  const hasFill =
    shape ||
    range ||
    bubble ||
    tool === 'text' ||
    tool === 'anchoredText' ||
    (fibonacci && tool !== 'fibTime' && tool !== 'fibSpiral');
  const hasLabels =
    text ||
    range ||
    (fibonacci &&
      tool !== 'fibSpiral' &&
      group !== 'Pitchforks' &&
      tool !== 'pitchfan') ||
    [
      'info',
      'angle',
      'longPosition',
      'shortPosition',
      'forecast',
      'volumeProfile',
    ].includes(tool) ||
    group === 'Patterns' ||
    group === 'Elliott Waves';
  const hasExtension = [
    'trend',
    'arrow',
    'info',
    'channel',
    'fib',
    'fibExtension',
    'fibChannel',
    'priceRange',
    'dateRange',
    'flatChannel',
    'disjointChannel',
    'regression',
    'pitchfork',
    'schiffPitchfork',
    'modifiedPitchfork',
    'insidePitchfork',
  ].includes(tool);
  const toggles: {
    key: keyof IDrawingStyle;
    label: string;
    fallback: boolean;
  }[] = [];
  if (hasFill)
    toggles.push({
      key: 'showBackground',
      label: intl.formatMessage({
        id: ETranslations.market_chart_settings__background,
      }),
      fallback: tool !== 'text',
    });
  if (
    [
      'rectangle',
      'ellipse',
      'triangle',
      'circle',
      'rotatedRectangle',
      'projection',
      'text',
      'anchoredText',
    ].includes(tool) ||
    range ||
    bubble
  )
    toggles.push({
      key: 'showBorder',
      label: intl.formatMessage({
        id: ETranslations.market_chart_settings__border,
      }),
      fallback: !range && tool !== 'text',
    });
  if (tool === 'gannSquare' || tool === 'gannSquareFixed')
    toggles.push(
      {
        key: 'showFans',
        label: intl.formatMessage({
          id: ETranslations.market_drawing_fans__title,
        }),
        fallback: true,
      },
      {
        key: 'showArcs',
        label: intl.formatMessage({
          id: ETranslations.market_drawing_arcs__title,
        }),
        fallback: true,
      },
    );
  if (hasExtension)
    toggles.push(
      {
        key: 'extendLeft',
        label: intl.formatMessage({
          id:
            tool === 'dateRange'
              ? ETranslations.market_drawing_extend_top__title
              : ETranslations.market_drawing_extend_left__title,
        }),
        fallback: false,
      },
      {
        key: 'extendRight',
        label: intl.formatMessage({
          id:
            tool === 'dateRange'
              ? ETranslations.market_drawing_extend_bottom__title
              : ETranslations.market_drawing_extend_right__title,
        }),
        fallback: group === 'Pitchforks',
      },
    );
  if (
    tool === 'channel' ||
    tool === 'flatChannel' ||
    tool === 'disjointChannel'
  )
    toggles.push({
      key: 'showMiddleLine',
      label: intl.formatMessage({
        id: ETranslations.market_drawing_middle_line__title,
      }),
      fallback: true,
    });
  if (hasLabels && !text && tool !== 'angle')
    toggles.push({
      key: 'showLabels',
      label: intl.formatMessage({
        id: ETranslations.market_drawing_labels__title,
      }),
      fallback: true,
    });
  if (tool === 'fib' || tool === 'fibExtension')
    toggles.push({
      key: 'showPrices',
      label: intl.formatMessage({
        id: ETranslations.market_drawing_prices__title,
      }),
      fallback: true,
    });
  if (
    (isFibonacciTool(tool) && !['fibCircles', 'fibWedge'].includes(tool)) ||
    group === 'Gann' ||
    tool === 'barsPattern'
  )
    toggles.push({
      key: 'reverse',
      label: intl.formatMessage({
        id: ETranslations.market_drawing_reverse__title,
      }),
      fallback: false,
    });
  if (tool === 'dateRange' || tool === 'datePriceRange')
    toggles.push({
      key: 'showVolume',
      label: intl.formatMessage({
        id: ETranslations.market_chart_indicator_vol__title,
      }),
      fallback: true,
    });
  let defaultFillOpacity = 0.2;
  if (bubble) defaultFillOpacity = 1;
  else if (range || group === 'Patterns') defaultFillOpacity = 0.15;
  const levels = fibonacci
    ? (style.levels ?? getDefaultDrawingLevels(tool))
    : [];
  const changeLevel = (index: number, patch: Partial<IDrawingLevel>) =>
    onChange({
      levels: levels.map((level, i) =>
        i === index ? { ...level, ...patch } : level,
      ),
    });
  return (
    <YStack gap="$2" py="$3" testID="drawing-style-options">
      {toggles.map(({ key, label, fallback }) => (
        <Checkbox
          key={key}
          testID={`drawing-style-${key}`}
          label={label}
          value={Boolean(style[key] ?? fallback)}
          disabled={disabled}
          labelProps={{ variant: '$bodySm' }}
          labelContainerProps={{ py: '$0', my: '$0' }}
          onChange={(checked) => onChange({ [key]: Boolean(checked) })}
        />
      ))}
      {[
        'longPosition',
        'shortPosition',
        'regression',
        'volumeProfile',
        'ghostFeed',
      ].includes(tool) ? (
        <YStack gap="$2">
          {(tool === 'longPosition' || tool === 'shortPosition'
            ? [
                {
                  key: 'accountSize' as const,
                  name: 'Account size',
                  label: intl.formatMessage({
                    id: ETranslations.market_drawing_account_size__title,
                  }),
                  value: style.accountSize ?? 1000,
                  min: 1,
                  max: 1e12,
                },
                {
                  key: 'riskPercent' as const,
                  name: 'Risk (%)',
                  label: intl.formatMessage({
                    id: ETranslations.market_drawing_risk_percent__title,
                  }),
                  value: style.riskPercent ?? 25,
                  min: 0.01,
                  max: 100,
                },
              ]
            : []
          ).map((field) => (
            <XStack
              key={field.key}
              justifyContent="space-between"
              alignItems="center"
            >
              <SizableText size="$bodySm">{field.label}</SizableText>
              <NumberField
                key={field.value}
                name={field.name}
                label={field.label}
                value={field.value}
                min={field.min}
                max={field.max}
                disabled={disabled}
                onChange={(value) => onChange({ [field.key]: value })}
              />
            </XStack>
          ))}
          {tool === 'regression' ? (
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.market_drawing_standard_deviations__title,
                })}
              </SizableText>
              <NumberField
                key={style.deviation}
                name="Deviation"
                label={intl.formatMessage({
                  id: ETranslations.market_drawing_deviation__title,
                })}
                value={style.deviation ?? 2}
                min={0.1}
                max={100}
                disabled={disabled}
                onChange={(deviation) => onChange({ deviation })}
              />
            </XStack>
          ) : null}
          {tool === 'ghostFeed'
            ? (['candleRange', 'candleVariance'] as const).map((key) => {
                const label = intl.formatMessage({
                  id:
                    key === 'candleRange'
                      ? ETranslations.market_drawing_avg_hl_ticks__title
                      : ETranslations.market_drawing_variance_ticks__title,
                });
                return (
                  <XStack
                    key={key}
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <SizableText size="$bodySm">{label}</SizableText>
                    <NumberField
                      key={style[key]}
                      name={key}
                      label={label}
                      value={style[key] ?? 50}
                      min={0}
                      max={1e9}
                      disabled={disabled}
                      onChange={(value) => onChange({ [key]: value })}
                    />
                  </XStack>
                );
              })
            : null}
          {tool === 'volumeProfile' ? (
            <>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$bodySm">
                  {intl.formatMessage({
                    id: ETranslations.market_drawing_rows__title,
                  })}
                </SizableText>
                <NumberField
                  key={style.profileRows}
                  name="Profile rows"
                  label={intl.formatMessage({
                    id: ETranslations.market_drawing_profile_rows__title,
                  })}
                  value={style.profileRows ?? 24}
                  min={1}
                  max={100}
                  disabled={disabled}
                  onChange={(profileRows) =>
                    onChange({ profileRows: Math.round(profileRows) })
                  }
                />
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$bodySm">
                  {intl.formatMessage({
                    id: ETranslations.market_drawing_value_area_percent__title,
                  })}
                </SizableText>
                <NumberField
                  key={style.valueAreaPercent}
                  name="Value area"
                  label={intl.formatMessage({
                    id: ETranslations.market_drawing_value_area__title,
                  })}
                  value={style.valueAreaPercent ?? 70}
                  min={1}
                  max={100}
                  disabled={disabled}
                  onChange={(valueAreaPercent) =>
                    onChange({ valueAreaPercent })
                  }
                />
              </XStack>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.market_drawing_volume_profile_data_source__desc,
                })}
              </SizableText>
            </>
          ) : null}
        </YStack>
      ) : null}
      {group === 'Icons' ? (
        <XStack gap="$1" flexWrap="wrap">
          {(
            [
              'smile',
              'heart',
              'star',
              'check',
              'cross',
              'arrowUp',
              'arrowDown',
            ] as const
          ).map((stamp) => (
            <Button
              key={stamp}
              testID={`drawing-stamp-${stamp}`}
              size="small"
              disabled={disabled}
              onPress={() => onChange({ stamp })}
            >
              {intl.formatMessage({ id: STAMP_LABEL_IDS[stamp] })}
            </Button>
          ))}
        </XStack>
      ) : null}
      {hasFill ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.market_drawing_background_opacity_percent__title,
            })}
          </SizableText>
          <NumberField
            key={style.fillOpacity ?? 'default'}
            name="Background opacity"
            label={intl.formatMessage({
              id: ETranslations.market_drawing_background_opacity__title,
            })}
            value={Math.round((style.fillOpacity ?? defaultFillOpacity) * 100)}
            min={0}
            max={100}
            disabled={disabled}
            onChange={(value) => onChange({ fillOpacity: value / 100 })}
          />
          {!fibonacci && !['longPosition', 'shortPosition'].includes(tool) ? (
            <StyleColor
              label="Background color"
              value={style.fillColor ?? style.color}
              disabled={disabled}
              onChange={(fillColor) => onChange({ fillColor })}
            />
          ) : null}
        </XStack>
      ) : null}
      {tool === 'brush' || tool === 'highlighter' ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.market_drawing_opacity_percent__title,
            })}
          </SizableText>
          <NumberField
            key={style.opacity ?? 'default'}
            name="Opacity"
            label={intl.formatMessage({
              id: ETranslations.market_drawing_opacity__title,
            })}
            value={Math.round(
              (style.opacity ?? (tool === 'highlighter' ? 0.5 : 1)) * 100,
            )}
            min={0}
            max={100}
            disabled={disabled}
            onChange={(value) => onChange({ opacity: value / 100 })}
          />
        </XStack>
      ) : null}
      {(hasLabels && !text) || group === 'Icons' ? (
        <>
          <XStack alignItems="center" justifyContent="space-between">
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.market_drawing_text_color__title,
              })}
            </SizableText>
            <StyleColor
              label="Text color"
              value={
                style.textColor ??
                (range || tool === 'info' ? '#FFFFFF' : style.color)
              }
              disabled={disabled}
              onChange={(textColor) => onChange({ textColor })}
            />
          </XStack>
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.market_drawing_font_size__title,
            })}
          </SizableText>
          <XStack gap="$1" flexWrap="wrap">
            {DRAWING_FONT_SIZES.map((fontSize) => (
              <Button
                key={fontSize}
                testID={`drawing-style-font-${fontSize}`}
                size="small"
                disabled={disabled}
                variant={
                  (style.fontSize ?? 12) === fontSize ? 'primary' : 'secondary'
                }
                onPress={() => onChange({ fontSize })}
              >
                {fontSize}
              </Button>
            ))}
          </XStack>
        </>
      ) : null}
      {['fib', 'fibExtension', 'fibChannel'].includes(tool) ? (
        <>
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.market_drawing_label_position__title,
            })}
          </SizableText>
          <XStack gap="$1">
            {(['left', 'center', 'right'] as const).map((labelPosition) => (
              <Button
                key={labelPosition}
                testID={`drawing-style-label-${labelPosition}`}
                size="small"
                disabled={disabled}
                variant={
                  (style.labelPosition ?? 'left') === labelPosition
                    ? 'primary'
                    : 'secondary'
                }
                onPress={() => onChange({ labelPosition })}
              >
                {intl.formatMessage({
                  id: LABEL_POSITION_LABEL_IDS[labelPosition],
                })}
              </Button>
            ))}
          </XStack>
        </>
      ) : null}
      {fibonacci && tool !== 'fibSpiral' ? (
        <>
          <SizableText size="$bodySmMedium">
            {intl.formatMessage({
              id: ETranslations.market_drawing_levels__title,
            })}
          </SizableText>
          {levels.map((level, index) => {
            const levelLabel = intl.formatMessage(
              { id: ETranslations.market_drawing_level_index__title },
              { index: index + 1 },
            );
            return (
              <XStack
                key={index}
                gap="$2"
                alignItems="center"
                justifyContent="space-between"
              >
                <Checkbox
                  testID={`drawing-level-visible-${index}`}
                  accessibilityLabel={levelLabel}
                  value={level.visible}
                  disabled={disabled}
                  onChange={(visible) =>
                    changeLevel(index, { visible: Boolean(visible) })
                  }
                />
                <NumberField
                  key={level.value}
                  name={`Level ${index + 1}`}
                  label={levelLabel}
                  value={level.value}
                  min={-1000}
                  max={1000}
                  disabled={disabled}
                  onChange={(value) => changeLevel(index, { value })}
                />
                <StyleColor
                  label={`Level ${index + 1} color`}
                  value={level.color}
                  disabled={disabled}
                  onChange={(color) => changeLevel(index, { color })}
                />
              </XStack>
            );
          })}
          <Button
            testID="drawing-style-add-level"
            size="small"
            disabled={disabled || levels.length >= 24}
            onPress={() =>
              onChange({
                levels: [
                  ...levels,
                  { value: 1, color: '#2962FF', visible: true },
                ],
              })
            }
          >
            {intl.formatMessage({
              id: ETranslations.market_drawing_add_level__action,
            })}
          </Button>
        </>
      ) : null}
    </YStack>
  );
}

export function DrawingAnchorFields({
  anchor,
  disabled,
  onChange,
}: {
  anchor: { x: number; y: number };
  disabled: boolean;
  onChange: (patch: { x?: number; y?: number }) => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$2">
      {(['x', 'y'] as const).map((axis) => (
        <XStack key={axis} alignItems="center" justifyContent="space-between">
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id:
                axis === 'x'
                  ? ETranslations.market_drawing_horizontal_position_percent__title
                  : ETranslations.market_drawing_vertical_position_percent__title,
            })}
          </SizableText>
          <NumberField
            key={anchor[axis]}
            name={`Anchor ${axis}`}
            label={intl.formatMessage(
              { id: ETranslations.market_drawing_anchor_axis__title },
              { axis },
            )}
            value={Math.round(anchor[axis] * 10_000) / 100}
            min={0}
            max={100}
            disabled={disabled}
            onChange={(value) => onChange({ [axis]: value / 100 })}
          />
        </XStack>
      ))}
    </YStack>
  );
}
