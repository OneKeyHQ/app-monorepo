import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';

export const OKX_CHART_BG = '$bg';
export const OKX_CHART_SIDE_ACTIVE_BG = '$bgActive';
export const OKX_CHART_BORDER = '$borderSubdued';
export const OKX_CHART_DIVIDER = '$borderSubdued';
export const OKX_CHART_TEXT = '$text';
export const OKX_CHART_TEXT_SUBDUED = '$textSubdued';
export const OKX_CHART_UP = '#219D46';
export const OKX_CHART_DOWN = '#C33759';
export const OKX_CHART_SELECT_BG = '$bgStrong';
export const OKX_CHART_SELECT_BORDER = '$borderSubdued';
export const OKX_LINE_PREVIEW_DASHES = [0, 1, 2, 3, 4, 5];

function OkxChartLinePreview({
  variant,
  color,
  mr,
}: {
  variant: string;
  color: string;
  mr?: number;
}) {
  if (variant === '虚线') {
    return (
      <XStack w={24} h={1} mr={mr} gap={2} alignItems="center">
        {OKX_LINE_PREVIEW_DASHES.map((dash) => (
          <Stack key={dash} w={2} h={1} bg={color} />
        ))}
      </XStack>
    );
  }

  return <Stack w={24} h={1} mr={mr} bg={color} />;
}

export function OkxChartSelectMock({
  value,
  width,
  height = 28,
  showLinePreview,
  options,
  open,
  onOpenChange,
  onChange,
}: {
  value: string;
  width: number;
  height?: number;
  showLinePreview?: boolean;
  options: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange?: (value: string) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <Stack position="relative" zIndex={isOpen ? 20 : 1}>
      <XStack
        h={height}
        w={width}
        px={9}
        alignItems="center"
        borderRadius={6}
        borderWidth={1}
        borderColor={isOpen ? '$borderActive' : OKX_CHART_SELECT_BORDER}
        bg={OKX_CHART_SELECT_BG}
        cursor="pointer"
        onPress={() => setIsOpen(!isOpen)}
      >
        {showLinePreview ? (
          <OkxChartLinePreview variant={value} mr={9} color={OKX_CHART_TEXT} />
        ) : null}
        <SizableText
          flex={1}
          minWidth={0}
          fontSize={12}
          lineHeight={12}
          color={OKX_CHART_TEXT}
          numberOfLines={1}
        >
          {value}
        </SizableText>
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$4"
          color="$icon"
        />
      </XStack>

      {isOpen ? (
        <YStack
          position="absolute"
          top={height + 8}
          left={0}
          w={width}
          overflow="hidden"
          borderRadius={6}
          bg="$bgSubdued"
          zIndex={100}
        >
          {options.map((option) => {
            return (
              <XStack
                key={option}
                h={36}
                px={12}
                gap={10}
                alignItems="center"
                bg="$bgSubdued"
                hoverStyle={{ bg: '$bgStrongHover' }}
                cursor="pointer"
                onPress={() => {
                  onChange?.(option);
                  setIsOpen(false);
                }}
              >
                {showLinePreview ? (
                  <OkxChartLinePreview variant={option} color="$text" />
                ) : null}
                <SizableText
                  fontSize={13}
                  lineHeight={18}
                  color={OKX_CHART_TEXT}
                >
                  {option}
                </SizableText>
              </XStack>
            );
          })}
        </YStack>
      ) : null}
    </Stack>
  );
}

const OKX_COLOR_PALETTE = [
  [
    '#FFFFFF',
    '#F02F3C',
    '#FF8D00',
    '#FFE834',
    '#43A646',
    '#088E76',
    '#00B4CE',
    '#2457FF',
    '#5C33AE',
    '#9123A7',
    '#E61C58',
  ],
  [
    '#CCCED7',
    '#FCC4C6',
    '#FFDBA8',
    '#FFF8BC',
    '#C1E2C2',
    '#A2E1D7',
    '#A9E8F0',
    '#B3D4FA',
    '#CBBCE6',
    '#DDB6E3',
    '#F7B3CA',
  ],
  [
    '#9FA2AC',
    '#F9979A',
    '#FFC575',
    '#FFF392',
    '#9BD09D',
    '#66C5B5',
    '#76D9E7',
    '#85B7F8',
    '#AA92D6',
    '#C788D2',
    '#F284A8',
  ],
  [
    '#62656F',
    '#F67175',
    '#FFAE44',
    '#FFEE6B',
    '#76C079',
    '#3BB59F',
    '#45CADD',
    '#5191F5',
    '#8A6AC6',
    '#B15DC1',
    '#EE5788',
  ],
  [
    '#34363E',
    '#F74855',
    '#FF9D22',
    '#FFEB4E',
    '#5BB35F',
    '#20A189',
    '#23BFD5',
    '#2C6EF3',
    '#734DBA',
    '#A13EB4',
    '#E9386F',
  ],
  [
    '#252932',
    '#A9242D',
    '#F27206',
    '#FAB828',
    '#318335',
    '#0B5B4C',
    '#008C9D',
    '#183FC5',
    '#47289E',
    '#701C98',
    '#BA1751',
  ],
  [
    '#000000',
    '#751920',
    '#E24600',
    '#F37416',
    '#19531D',
    '#042D25',
    '#075559',
    '#0F2C8E',
    '#2B1A87',
    '#411481',
    '#7C1046',
  ],
];

type ISettingsValueUpdater<TValue> = (currentValue: TValue) => TValue;

export function useSettingsDraftValue<TValue>({
  value,
  defaultValue,
  createDefaultValue,
  onChange,
}: {
  value?: TValue;
  defaultValue?: TValue;
  createDefaultValue: () => TValue;
  onChange?: (value: TValue) => void;
}) {
  const [innerCommittedValue, setInnerCommittedValue] = useState<TValue>(
    () => defaultValue ?? createDefaultValue(),
  );
  const committedValue = value ?? innerCommittedValue;
  const committedValueRef = useRef(committedValue);
  const draftValueRef = useRef(committedValue);
  const isDraftDirtyRef = useRef(false);
  const [draftValue, setDraftValue] = useState(committedValue);

  useEffect(() => {
    if (
      isDraftDirtyRef.current ||
      Object.is(committedValueRef.current, committedValue)
    ) {
      return;
    }

    committedValueRef.current = committedValue;
    draftValueRef.current = committedValue;
    setDraftValue(committedValue);
  }, [committedValue]);

  const updateDraftValue = useCallback(
    (updater: ISettingsValueUpdater<TValue>) => {
      const nextValue = updater(draftValueRef.current);
      if (Object.is(nextValue, draftValueRef.current)) {
        return;
      }
      isDraftDirtyRef.current = true;
      draftValueRef.current = nextValue;
      setDraftValue(nextValue);
      onChange?.(nextValue);
    },
    [onChange],
  );

  const commitDraftValue = useCallback(() => {
    isDraftDirtyRef.current = false;
    committedValueRef.current = draftValueRef.current;
    if (value === undefined) {
      setInnerCommittedValue(draftValueRef.current);
    }
  }, [value]);

  const cancelDraftValue = useCallback(() => {
    const restoredValue = committedValueRef.current;
    isDraftDirtyRef.current = false;
    draftValueRef.current = restoredValue;
    setDraftValue(restoredValue);
    onChange?.(restoredValue);
  }, [onChange]);

  return [
    draftValue,
    updateDraftValue,
    commitDraftValue,
    cancelDraftValue,
  ] as const;
}

export function OkxChartCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Stack
      w={16}
      h={16}
      alignItems="center"
      justifyContent="center"
      borderRadius={3}
      bg={checked ? '$bgInverse' : OKX_CHART_BG}
      borderWidth={checked ? 0 : 1}
      borderColor="$borderStrong"
      hoverStyle={{ opacity: 0.78 }}
      pressStyle={{ opacity: 0.62 }}
      cursor="pointer"
      onPress={() => onChange(!checked)}
    >
      {checked ? (
        <Icon name="CheckLargeOutline" size="$3" color="$iconInverse" />
      ) : null}
    </Stack>
  );
}

export function OkxChartColorPicker({
  value,
  placement = 'bottom',
  align = 'left',
  pattern,
  bare = false,
  testID,
  onChange,
}: {
  value: string;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
  pattern?: 'checker';
  bare?: boolean;
  testID?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const themeName = useThemeName();
  const checkerColor =
    themeName === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
  let popoverPlacement: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
  if (placement === 'bottom') {
    popoverPlacement = align === 'left' ? 'bottom-start' : 'bottom-end';
  } else {
    popoverPlacement = align === 'left' ? 'top-start' : 'top-end';
  }

  return (
    <Popover
      title=""
      showHeader={false}
      usingSheet={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      placement={popoverPlacement}
      allowFlip={false}
      offset={8}
      floatingPanelProps={{
        w: 'auto',
        minWidth: 0,
        p: 0,
        bg: 'transparent',
        borderRadius: 0,
        outlineWidth: 0,
        boxShadow: 'none',
      }}
      renderTrigger={
        <Stack
          testID={testID}
          w={bare ? 24 : 30}
          h={bare ? 24 : 30}
          alignItems="center"
          justifyContent="center"
          borderRadius={bare ? 0 : 5}
          borderWidth={bare ? 0 : 1}
          borderColor="$borderSubdued"
          bg="$bgStrong"
          hoverStyle={{ borderColor: '$borderStrong', opacity: 0.86 }}
          pressStyle={{ opacity: 0.7 }}
          cursor="pointer"
          onPress={() => setIsOpen(true)}
        >
          <Stack
            w={bare ? 24 : 22}
            h={bare ? 24 : 22}
            borderRadius={bare ? 0 : 2}
            bg={value}
            style={
              pattern === 'checker'
                ? {
                    background: `repeating-conic-gradient(${value} 0% 25%, ${checkerColor} 0% 50%) 50% / 6px 6px`,
                  }
                : undefined
            }
          />
        </Stack>
      }
      renderContent={
        <OkxChartColorPalette
          placement={placement}
          align={align}
          offset={bare ? 32 : 38}
          inPopover
          selectedColor={value}
          onSelect={(color) => {
            onChange(color);
            setIsOpen(false);
          }}
        />
      }
    />
  );
}

export function OkxChartColorPalette({
  placement,
  align,
  offset = 38,
  inPopover = false,
  selectedColor,
  onSelect,
}: {
  placement: 'bottom' | 'top';
  align: 'left' | 'right';
  offset?: number;
  inPopover?: boolean;
  selectedColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <YStack
      position={inPopover ? 'relative' : 'absolute'}
      top={!inPopover && placement === 'bottom' ? offset : undefined}
      bottom={!inPopover && placement === 'top' ? offset : undefined}
      left={!inPopover && align === 'left' ? 0 : undefined}
      right={!inPopover && align === 'right' ? 0 : undefined}
      p={12}
      gap={6}
      zIndex={100}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius={6}
      bg={OKX_CHART_BG}
    >
      {OKX_COLOR_PALETTE.map((row) => (
        <XStack key={row.join('-')} gap={6}>
          {row.map((color) => {
            const selected = color === selectedColor;
            return (
              <Stack
                key={color}
                w={18}
                h={18}
                position="relative"
                cursor="pointer"
                hoverStyle={{ opacity: 0.76 }}
                pressStyle={{ opacity: 0.6 }}
                onPress={() => onSelect(color)}
              >
                <Stack
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  borderWidth={color === '#000000' ? 1 : 0}
                  borderColor="$borderStrong"
                  bg={color}
                />
                {selected ? (
                  <Stack
                    position="absolute"
                    top={-3}
                    right={-3}
                    bottom={-3}
                    left={-3}
                    borderWidth={2}
                    borderColor="$borderActive"
                    pointerEvents="none"
                  />
                ) : null}
              </Stack>
            );
          })}
        </XStack>
      ))}
    </YStack>
  );
}

export function OkxChartSolidSwatch({
  color,
  placement = 'bottom',
  align = 'left',
  bare = false,
  onChange,
}: {
  color: string;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
  bare?: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <OkxChartColorPicker
      value={color}
      placement={placement}
      align={align}
      bare={bare}
      onChange={onChange}
    />
  );
}
