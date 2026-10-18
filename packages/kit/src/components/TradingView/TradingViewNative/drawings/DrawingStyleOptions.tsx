import { useState } from 'react';

import {
  Button,
  Checkbox,
  ColorPicker,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

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

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
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
      testID={`drawing-style-${label}`}
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
      label: 'Background',
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
      label: 'Border',
      fallback: !range && tool !== 'text',
    });
  if (tool === 'gannSquare' || tool === 'gannSquareFixed')
    toggles.push(
      { key: 'showFans', label: 'Fans', fallback: true },
      { key: 'showArcs', label: 'Arcs', fallback: true },
    );
  if (hasExtension)
    toggles.push(
      {
        key: 'extendLeft',
        label: tool === 'dateRange' ? 'Extend top' : 'Extend left',
        fallback: false,
      },
      {
        key: 'extendRight',
        label: tool === 'dateRange' ? 'Extend bottom' : 'Extend right',
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
      label: 'Middle line',
      fallback: true,
    });
  if (hasLabels && !text && tool !== 'angle')
    toggles.push({ key: 'showLabels', label: 'Labels', fallback: true });
  if (tool === 'fib' || tool === 'fibExtension')
    toggles.push({ key: 'showPrices', label: 'Prices', fallback: true });
  if (
    (isFibonacciTool(tool) && !['fibCircles', 'fibWedge'].includes(tool)) ||
    group === 'Gann' ||
    tool === 'barsPattern'
  )
    toggles.push({ key: 'reverse', label: 'Reverse', fallback: false });
  if (tool === 'dateRange' || tool === 'datePriceRange')
    toggles.push({ key: 'showVolume', label: 'Volume', fallback: true });
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
                  label: 'Account size',
                  value: style.accountSize ?? 1000,
                  min: 1,
                  max: 1e12,
                },
                {
                  key: 'riskPercent' as const,
                  label: 'Risk (%)',
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
              <SizableText size="$bodySm">Standard deviations</SizableText>
              <NumberField
                key={style.deviation}
                label="Deviation"
                value={style.deviation ?? 2}
                min={0.1}
                max={100}
                disabled={disabled}
                onChange={(deviation) => onChange({ deviation })}
              />
            </XStack>
          ) : null}
          {tool === 'ghostFeed'
            ? (['candleRange', 'candleVariance'] as const).map((key) => (
                <XStack
                  key={key}
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <SizableText size="$bodySm">
                    {key === 'candleRange'
                      ? 'Avg HL (ticks)'
                      : 'Variance (ticks)'}
                  </SizableText>
                  <NumberField
                    key={style[key]}
                    label={key}
                    value={style[key] ?? 50}
                    min={0}
                    max={1e9}
                    disabled={disabled}
                    onChange={(value) => onChange({ [key]: value })}
                  />
                </XStack>
              ))
            : null}
          {tool === 'volumeProfile' ? (
            <>
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$bodySm">Rows</SizableText>
                <NumberField
                  key={style.profileRows}
                  label="Profile rows"
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
                <SizableText size="$bodySm">Value area (%)</SizableText>
                <NumberField
                  key={style.valueAreaPercent}
                  label="Value area"
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
                Volume distribution uses available lower timeframe candles, with
                chart candles as a fallback.
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
              {stamp}
            </Button>
          ))}
        </XStack>
      ) : null}
      {hasFill ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <SizableText size="$bodySm">Background opacity (%)</SizableText>
          <NumberField
            key={style.fillOpacity ?? 'default'}
            label="Background opacity"
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
          <SizableText size="$bodySm">Opacity (%)</SizableText>
          <NumberField
            key={style.opacity ?? 'default'}
            label="Opacity"
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
            <SizableText size="$bodySm">Text color</SizableText>
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
          <SizableText size="$bodySm">Font size</SizableText>
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
          <SizableText size="$bodySm">Label position</SizableText>
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
                {labelPosition}
              </Button>
            ))}
          </XStack>
        </>
      ) : null}
      {fibonacci && tool !== 'fibSpiral' ? (
        <>
          <SizableText size="$bodySmMedium">Levels</SizableText>
          {levels.map((level, index) => (
            <XStack
              key={index}
              gap="$2"
              alignItems="center"
              justifyContent="space-between"
            >
              <Checkbox
                testID={`drawing-level-visible-${index}`}
                accessibilityLabel={`Level ${index + 1}`}
                value={level.visible}
                disabled={disabled}
                onChange={(visible) =>
                  changeLevel(index, { visible: Boolean(visible) })
                }
              />
              <NumberField
                key={level.value}
                label={`Level ${index + 1}`}
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
          ))}
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
            Add level
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
  return (
    <YStack gap="$2">
      {(['x', 'y'] as const).map((axis) => (
        <XStack key={axis} alignItems="center" justifyContent="space-between">
          <SizableText size="$bodySm">
            {axis === 'x' ? 'Horizontal position (%)' : 'Vertical position (%)'}
          </SizableText>
          <NumberField
            key={anchor[axis]}
            label={`Anchor ${axis}`}
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
