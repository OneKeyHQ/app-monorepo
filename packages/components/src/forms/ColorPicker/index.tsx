import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Popover, Trigger } from '../../actions';
import { DialogContainer } from '../../composite/Dialog';
import { Portal } from '../../hocs';
import { useMedia } from '../../hooks';
import { Stack, XStack, YStack } from '../../primitives';

import type { IPopoverContent, IPopoverProps } from '../../actions';
import type { IYStackProps } from '../../primitives';

export interface IColorPickerOption {
  value: string;
  label?: string;
  disabled?: boolean;
}

export type IColorPickerColor = string | IColorPickerOption;

export interface IColorPickerPaletteProps extends Omit<
  IYStackProps,
  'children' | 'onChange'
> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  colors?: readonly IColorPickerColor[];
  columns?: number;
  swatchSize?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface IColorPickerRenderTriggerProps {
  value?: string;
  color: string;
  disabled?: boolean;
}

export interface IColorPickerProps extends Omit<
  IColorPickerPaletteProps,
  'testID'
> {
  open?: IPopoverProps['open'];
  onOpenChange?: IPopoverProps['onOpenChange'];
  placement?: IPopoverProps['placement'];
  floatingPanelProps?: IPopoverProps['floatingPanelProps'];
  sheetProps?: IPopoverProps['sheetProps'];
  renderTrigger?: (props: IColorPickerRenderTriggerProps) => ReactElement;
  closeOnSelect?: boolean;
  triggerSize?: number;
  testID?: string;
}

export const DEFAULT_COLOR_PICKER_COLUMNS = 11;
const DEFAULT_COLOR_PICKER_SWATCH_SIZE = 28;
const DEFAULT_COLOR_PICKER_GAP = '$0.5';
const DEFAULT_COLOR_PICKER_TRIGGER_COLOR = '#FFFFFF';
const DIALOG_CLOSE_DELAY_MS = 300;

export const DEFAULT_COLOR_PICKER_COLORS: readonly string[] = [
  '#FFFFFF',
  '#E5484D',
  '#FBA43A',
  '#FDEB5B',
  '#6AAF63',
  '#4E9F8A',
  '#5CB8D1',
  '#3D63DD',
  '#6747C7',
  '#953EA8',
  '#D64073',
  '#D4D8E1',
  '#F4C7C7',
  '#F8DDB4',
  '#FBF4C4',
  '#CDE7CE',
  '#B9E1D9',
  '#B8E7EF',
  '#BDD2F0',
  '#CFC4E8',
  '#D9BBE1',
  '#E7B7C8',
  '#B2B5BF',
  '#E99AA2',
  '#F4C37D',
  '#FBEEA6',
  '#A8D2AA',
  '#86C9BA',
  '#8ED4E0',
  '#90B6E8',
  '#B19AD8',
  '#C28FD0',
  '#DE8AAA',
  '#83858F',
  '#E08188',
  '#F2BE63',
  '#F9EA86',
  '#8FBE8F',
  '#70B9A7',
  '#75CBD9',
  '#6D9BE5',
  '#967CCF',
  '#AD6BC1',
  '#D96A96',
  '#555966',
  '#E05261',
  '#F8AA3E',
  '#FBE764',
  '#75B56F',
  '#56AA93',
  '#5DBFD1',
  '#4575E6',
  '#7B5BC6',
  '#9642B6',
  '#D8427A',
  '#2B2E38',
  '#A33A43',
  '#E7862B',
  '#F1C54A',
  '#4D8A48',
  '#306957',
  '#3D96A6',
  '#3149B9',
  '#5733A5',
  '#72289C',
  '#B12C65',
  '#0F1013',
  '#7C202A',
  '#DB5524',
  '#EC7F32',
  '#2D652C',
  '#123F37',
  '#276774',
  '#1F2F91',
  '#36208A',
  '#471B80',
  '#8C1E59',
];

const swatchHoverStyle = { bg: '$bgHover' } as const;
const swatchPressStyle = { bg: '$bgActive' } as const;
const triggerHoverStyle = { backgroundColor: '$bgHover' } as const;
const triggerPressStyle = { backgroundColor: '$bgActive' } as const;
const swatchFocusVisibleStyle = {
  outlineWidth: 2,
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
} as const;
const defaultFloatingPanelProps = {
  width: 'auto',
  minWidth: 0,
} as const;
const defaultDialogContentContainerProps = {
  pt: '$2',
} as const;
const allowTriggerPress = () => undefined;
const preventTriggerPress = () => false;
const swatchAccessibilityStateSelectedEnabled = {
  checked: true,
  disabled: false,
} as const;
const swatchAccessibilityStateSelectedDisabled = {
  checked: true,
  disabled: true,
} as const;
const swatchAccessibilityStateUnselectedEnabled = {
  checked: false,
  disabled: false,
} as const;
const swatchAccessibilityStateUnselectedDisabled = {
  checked: false,
  disabled: true,
} as const;
const triggerAccessibilityStateEnabled = { disabled: false } as const;
const triggerAccessibilityStateDisabled = { disabled: true } as const;

function normalizeColorValue(value: string | undefined) {
  return value?.toLowerCase();
}

function normalizeColorOption(color: IColorPickerColor): IColorPickerOption {
  return typeof color === 'string' ? { value: color } : color;
}

function getColorOptionValue(color: IColorPickerColor | undefined) {
  if (!color) {
    return DEFAULT_COLOR_PICKER_TRIGGER_COLOR;
  }
  return normalizeColorOption(color).value;
}

function normalizeColumns(columns: number) {
  const nextColumns = Math.floor(columns);
  if (!Number.isFinite(nextColumns) || nextColumns < 1) {
    return DEFAULT_COLOR_PICKER_COLUMNS;
  }
  return nextColumns;
}

function getSwatchAccessibilityState({
  selected,
  disabled,
}: {
  selected: boolean;
  disabled: boolean;
}) {
  if (selected) {
    return disabled
      ? swatchAccessibilityStateSelectedDisabled
      : swatchAccessibilityStateSelectedEnabled;
  }
  return disabled
    ? swatchAccessibilityStateUnselectedDisabled
    : swatchAccessibilityStateUnselectedEnabled;
}

function chunkColorOptions(
  colors: readonly IColorPickerOption[],
  columns: number,
) {
  const rows: IColorPickerOption[][] = [];
  for (let index = 0; index < colors.length; index += columns) {
    rows.push(colors.slice(index, index + columns));
  }
  return rows;
}

const ColorSwatch = memo(
  ({
    option,
    selected,
    size,
    fullWidth,
    disabled,
    onSelect,
    testID,
  }: {
    option: IColorPickerOption;
    selected: boolean;
    size: number;
    fullWidth?: boolean;
    disabled?: boolean;
    onSelect: (value: string) => void;
    testID?: string;
  }) => {
    const isDisabled = !!(disabled || option.disabled);
    const label = option.label ?? option.value;
    const accessibilityState = getSwatchAccessibilityState({
      selected,
      disabled: isDisabled,
    });

    const handlePress = useCallback(() => {
      if (isDisabled) {
        return;
      }
      onSelect(option.value);
    }, [isDisabled, onSelect, option.value]);

    return (
      <YStack
        width={fullWidth ? undefined : size}
        height={fullWidth ? undefined : size}
        flex={fullWidth ? 1 : undefined}
        aspectRatio={fullWidth ? 1 : undefined}
        minWidth={fullWidth ? 0 : undefined}
        padding={2}
        alignItems="center"
        justifyContent="center"
        borderRadius="$2"
        borderCurve="continuous"
        borderWidth={2}
        borderColor={selected ? '$borderActive' : '$transparent'}
        opacity={isDisabled ? 0.5 : 1}
        userSelect="none"
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
        focusable={!isDisabled}
        focusVisibleStyle={swatchFocusVisibleStyle}
        hoverStyle={isDisabled ? undefined : swatchHoverStyle}
        pressStyle={isDisabled ? undefined : swatchPressStyle}
        onPress={handlePress}
        role={!platformEnv.isNative ? 'radio' : undefined}
        aria-checked={!platformEnv.isNative ? selected : undefined}
        aria-disabled={!platformEnv.isNative ? isDisabled : undefined}
        aria-label={!platformEnv.isNative ? label : undefined}
        accessibilityRole={platformEnv.isNative ? 'radio' : undefined}
        accessibilityLabel={platformEnv.isNative ? label : undefined}
        accessibilityState={
          platformEnv.isNative ? accessibilityState : undefined
        }
        testID={testID}
      >
        <Stack
          width="100%"
          height="100%"
          borderRadius="$1"
          borderCurve="continuous"
          borderWidth="$px"
          borderColor="$borderSubdued"
          backgroundColor={option.value}
        />
      </YStack>
    );
  },
);

ColorSwatch.displayName = 'ColorSwatch';

const DefaultColorPickerTrigger = memo(
  ({
    color,
    disabled,
    onPress,
    size,
    testID,
  }: {
    color: string;
    disabled?: boolean;
    onPress?: IYStackProps['onPress'];
    size: number;
    testID?: string;
  }) => {
    const accessibilityState = disabled
      ? triggerAccessibilityStateDisabled
      : triggerAccessibilityStateEnabled;
    const handlePress = disabled
      ? preventTriggerPress
      : (onPress ?? allowTriggerPress);
    return (
      <YStack
        width={size}
        height={size}
        padding="$1"
        alignItems="center"
        justifyContent="center"
        borderRadius="$2"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor="$borderSubdued"
        backgroundColor="$bgStrong"
        opacity={disabled ? 0.5 : 1}
        userSelect="none"
        cursor={disabled ? 'not-allowed' : 'pointer'}
        focusable={!disabled}
        focusVisibleStyle={swatchFocusVisibleStyle}
        hoverStyle={disabled ? undefined : triggerHoverStyle}
        pressStyle={disabled ? undefined : triggerPressStyle}
        onPress={handlePress}
        role={!platformEnv.isNative ? 'button' : undefined}
        aria-disabled={!platformEnv.isNative ? disabled : undefined}
        aria-label={
          !platformEnv.isNative ? `Color picker, ${color}` : undefined
        }
        accessibilityRole={platformEnv.isNative ? 'button' : undefined}
        accessibilityLabel={
          platformEnv.isNative ? `Color picker, ${color}` : undefined
        }
        accessibilityState={
          platformEnv.isNative ? accessibilityState : undefined
        }
        testID={testID}
      >
        <Stack
          width="100%"
          height="100%"
          borderRadius="$1"
          borderCurve="continuous"
          borderWidth="$px"
          borderColor="$borderSubdued"
          backgroundColor={color}
        />
      </YStack>
    );
  },
);

DefaultColorPickerTrigger.displayName = 'DefaultColorPickerTrigger';

type IColorPickerContentProps = Omit<
  IColorPickerPaletteProps,
  'defaultValue' | 'onChange'
> & {
  closeOverlay: () => void;
  closeOnSelect?: boolean;
  onValueChange: (value: string) => void;
};

function ColorPickerContent({
  closeOverlay,
  closeOnSelect,
  fullWidth,
  onValueChange,
  ...paletteProps
}: IColorPickerContentProps) {
  const handlePaletteChange = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      if (closeOnSelect) {
        closeOverlay();
      }
    },
    [closeOnSelect, closeOverlay, onValueChange],
  );

  return (
    <YStack
      width={fullWidth ? '100%' : undefined}
      padding="$2"
      alignItems={fullWidth ? 'stretch' : 'center'}
    >
      <ColorPickerPalette
        {...paletteProps}
        fullWidth={fullWidth}
        onChange={handlePaletteChange}
      />
    </YStack>
  );
}

export function ColorPickerPalette({
  value,
  defaultValue,
  onChange,
  colors = DEFAULT_COLOR_PICKER_COLORS,
  columns = DEFAULT_COLOR_PICKER_COLUMNS,
  swatchSize = DEFAULT_COLOR_PICKER_SWATCH_SIZE,
  gap = DEFAULT_COLOR_PICKER_GAP,
  fullWidth,
  disabled,
  testID,
  ...rest
}: IColorPickerPaletteProps) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const selectedValue = value ?? innerValue;
  const selectedNormalizedValue = normalizeColorValue(selectedValue);

  const normalizedColumns = useMemo(() => normalizeColumns(columns), [columns]);

  const normalizedColors = useMemo(
    () => colors.map(normalizeColorOption),
    [colors],
  );

  const colorRows = useMemo(
    () => chunkColorOptions(normalizedColors, normalizedColumns),
    [normalizedColors, normalizedColumns],
  );

  const handleSelect = useCallback(
    (nextValue: string) => {
      setInnerValue(nextValue);
      onChange?.(nextValue);
    },
    [onChange],
  );

  return (
    <YStack
      width={fullWidth ? '100%' : undefined}
      gap={gap}
      testID={testID}
      role={!platformEnv.isNative ? 'radiogroup' : undefined}
      accessibilityRole={platformEnv.isNative ? 'radiogroup' : undefined}
      {...rest}
    >
      {colorRows.map((row, rowIndex) => (
        <XStack key={rowIndex} width={fullWidth ? '100%' : undefined} gap={gap}>
          {row.map((option, optionIndex) => {
            const optionNormalizedValue = normalizeColorValue(option.value);
            return (
              <ColorSwatch
                key={`${option.value}-${optionIndex}`}
                option={option}
                selected={selectedNormalizedValue === optionNormalizedValue}
                size={swatchSize}
                fullWidth={fullWidth}
                disabled={disabled}
                onSelect={handleSelect}
                testID={testID ? `${testID}-${option.value}` : undefined}
              />
            );
          })}
          {fullWidth && row.length < normalizedColumns
            ? Array.from({ length: normalizedColumns - row.length }).map(
                (_, placeholderIndex) => (
                  <Stack
                    key={`placeholder-${rowIndex}-${placeholderIndex}`}
                    flex={1}
                    aspectRatio={1}
                    minWidth={0}
                  />
                ),
              )
            : null}
        </XStack>
      ))}
    </YStack>
  );
}

export function ColorPicker({
  value,
  defaultValue,
  onChange,
  colors = DEFAULT_COLOR_PICKER_COLORS,
  columns,
  swatchSize,
  gap = DEFAULT_COLOR_PICKER_GAP,
  fullWidth,
  disabled,
  testID,
  open,
  onOpenChange,
  placement = 'bottom-start',
  floatingPanelProps,
  sheetProps,
  renderTrigger,
  closeOnSelect = true,
  triggerSize = 36,
  ...paletteProps
}: IColorPickerProps) {
  const { md } = useMedia();
  const [innerValue, setInnerValue] = useState(defaultValue);
  const [innerOpen, setInnerOpen] = useState(false);
  const [shouldRenderMobileDialog, setShouldRenderMobileDialog] =
    useState(false);
  const selectedValue = value ?? innerValue;
  const isOpenControlled = open !== undefined;
  const usedOpen = isOpenControlled ? !!open : innerOpen;
  const effectiveOpen = disabled ? false : usedOpen;

  useEffect(() => {
    if (!disabled) {
      return;
    }
    if (!isOpenControlled) {
      setInnerOpen(false);
    }
    if (isOpenControlled && open) {
      onOpenChange?.(false);
    }
  }, [disabled, isOpenControlled, onOpenChange, open]);

  const resolvedColumns = useMemo(
    () => normalizeColumns(columns ?? DEFAULT_COLOR_PICKER_COLUMNS),
    [columns],
  );

  const resolvedSwatchSize = useMemo(
    () => swatchSize ?? DEFAULT_COLOR_PICKER_SWATCH_SIZE,
    [swatchSize],
  );

  const resolvedFullWidth = fullWidth ?? (md && swatchSize === undefined);

  useEffect(() => {
    if (!md) {
      setShouldRenderMobileDialog(false);
      return undefined;
    }
    if (effectiveOpen) {
      setShouldRenderMobileDialog(true);
      return undefined;
    }
    const timer = setTimeout(() => {
      setShouldRenderMobileDialog(false);
    }, DIALOG_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [effectiveOpen, md]);

  const fallbackColor = useMemo(() => getColorOptionValue(colors[0]), [colors]);
  const triggerColor = selectedValue ?? fallbackColor;

  const handleChange = useCallback(
    (nextValue: string) => {
      setInnerValue(nextValue);
      onChange?.(nextValue);
    },
    [onChange],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      const nextEffectiveOpen = disabled ? false : nextOpen;
      if (!isOpenControlled) {
        setInnerOpen(nextEffectiveOpen);
      }
      if (disabled && nextOpen) {
        if (open) {
          onOpenChange?.(false);
        }
        return;
      }
      onOpenChange?.(nextEffectiveOpen);
    },
    [disabled, isOpenControlled, onOpenChange, open],
  );

  const handleOpenPicker = useCallback(() => {
    handleOpenChange(true);
  }, [handleOpenChange]);

  const handleClosePicker = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleDialogClose = useCallback(async () => {
    handleClosePicker();
  }, [handleClosePicker]);

  const trigger = useMemo(
    () =>
      renderTrigger ? (
        renderTrigger({ value: selectedValue, color: triggerColor, disabled })
      ) : (
        <DefaultColorPickerTrigger
          color={triggerColor}
          disabled={disabled}
          size={triggerSize}
          testID={testID ? `${testID}-trigger` : undefined}
        />
      ),
    [disabled, renderTrigger, selectedValue, testID, triggerColor, triggerSize],
  );

  const mergedFloatingPanelProps = useMemo(
    () => ({
      ...defaultFloatingPanelProps,
      ...floatingPanelProps,
    }),
    [floatingPanelProps],
  );

  const renderPaletteContent = useCallback(
    (closeOverlay: () => void) => (
      <ColorPickerContent
        {...paletteProps}
        value={selectedValue}
        closeOverlay={closeOverlay}
        closeOnSelect={closeOnSelect}
        onValueChange={handleChange}
        colors={colors}
        columns={resolvedColumns}
        swatchSize={resolvedSwatchSize}
        gap={gap}
        fullWidth={resolvedFullWidth}
        disabled={disabled}
        testID={testID ? `${testID}-palette` : undefined}
      />
    ),
    [
      closeOnSelect,
      colors,
      disabled,
      gap,
      handleChange,
      paletteProps,
      resolvedColumns,
      resolvedFullWidth,
      resolvedSwatchSize,
      selectedValue,
      testID,
    ],
  );

  const renderContent = useCallback(
    ({ closePopover }: IPopoverContent) => renderPaletteContent(closePopover),
    [renderPaletteContent],
  );

  const dialogContent = useMemo(
    () => renderPaletteContent(handleClosePicker),
    [handleClosePicker, renderPaletteContent],
  );

  const mobileDialog = useMemo(
    () => (
      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        <DialogContainer
          title="Color"
          showHeader={false}
          showFooter={false}
          open={effectiveOpen}
          onClose={handleDialogClose}
          renderContent={dialogContent}
          contentContainerProps={defaultDialogContentContainerProps}
          sheetProps={sheetProps}
          floatingPanelProps={mergedFloatingPanelProps}
          testID={testID ? `${testID}-dialog` : undefined}
        />
      </Portal.Body>
    ),
    [
      dialogContent,
      effectiveOpen,
      handleDialogClose,
      mergedFloatingPanelProps,
      sheetProps,
      testID,
    ],
  );

  if (md) {
    return (
      <>
        <Trigger
          testID={testID ? `${testID}-trigger-wrapper` : undefined}
          disabled={disabled}
          onPress={handleOpenPicker}
        >
          {trigger}
        </Trigger>
        {shouldRenderMobileDialog ? mobileDialog : null}
      </>
    );
  }

  return (
    <Popover
      title="Color"
      showHeader={false}
      open={effectiveOpen}
      onOpenChange={handleOpenChange}
      placement={placement}
      renderTrigger={trigger}
      renderContent={renderContent}
      floatingPanelProps={mergedFloatingPanelProps}
      sheetProps={sheetProps}
    />
  );
}
