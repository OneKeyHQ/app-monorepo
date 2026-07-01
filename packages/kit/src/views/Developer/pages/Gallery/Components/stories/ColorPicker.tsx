import { useCallback, useState } from 'react';

import {
  Button,
  ColorPicker,
  ColorPickerPalette,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IColorPickerRenderTriggerProps } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const customColors = [
  '#111827',
  '#2563EB',
  '#0891B2',
  '#059669',
  '#65A30D',
  '#EAB308',
  '#EA580C',
  '#DC2626',
  '#DB2777',
  '#7C3AED',
];

const customColorOptions = customColors.map((color, index) => ({
  value: color,
  label: `Custom color ${index + 1}`,
  disabled: index === 2 || index === 6,
}));

function ColorValue({ value }: { value: string }) {
  return (
    <XStack gap="$2" alignItems="center">
      <Stack
        width="$5"
        height="$5"
        borderRadius="$1"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor="$borderSubdued"
        backgroundColor={value}
      />
      <SizableText size="$bodySm" color="$textSubdued">
        Selected: {value}
      </SizableText>
    </XStack>
  );
}

function DefaultColorPickerDemo() {
  const [value, setValue] = useState('#D64073');

  return (
    <YStack gap="$3">
      <ColorPicker value={value} onChange={setValue} />
      <ColorValue value={value} />
    </YStack>
  );
}

function CustomPaletteColorPickerDemo() {
  const [value, setValue] = useState(customColors[1]);

  return (
    <YStack gap="$3">
      <ColorPicker
        value={value}
        onChange={setValue}
        colors={customColors}
        columns={5}
      />
      <ColorValue value={value} />
    </YStack>
  );
}

function CustomTriggerColorPickerDemo() {
  const [value, setValue] = useState('#059669');
  const renderTrigger = useCallback(
    ({ color, disabled }: IColorPickerRenderTriggerProps) => (
      <XStack
        gap="$2"
        alignItems="center"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius="$2"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor="$borderSubdued"
        opacity={disabled ? 0.5 : 1}
      >
        <Stack
          width="$5"
          height="$5"
          borderRadius="$1"
          borderCurve="continuous"
          backgroundColor={color}
        />
        <SizableText size="$bodyMdMedium">Pick color</SizableText>
      </XStack>
    ),
    [],
  );

  return (
    <YStack gap="$3">
      <ColorPicker
        value={value}
        onChange={setValue}
        colors={customColors}
        columns={5}
        renderTrigger={renderTrigger}
      />
      <ColorValue value={value} />
    </YStack>
  );
}

function ControlledOpenColorPickerDemo() {
  const [value, setValue] = useState(customColors[3]);
  const [open, setOpen] = useState(false);

  return (
    <YStack gap="$3">
      <XStack gap="$2" alignItems="center">
        <ColorPicker
          value={value}
          onChange={setValue}
          open={open}
          onOpenChange={setOpen}
          closeOnSelect={false}
          colors={customColors}
          columns={5}
        />
        <Button size="small" onPress={() => setOpen((prev) => !prev)}>
          {open ? 'Close' : 'Open'}
        </Button>
      </XStack>
      <ColorValue value={value} />
      <SizableText size="$bodySm" color="$textSubdued">
        Open: {open ? 'Yes' : 'No'} | closeOnSelect: false
      </SizableText>
    </YStack>
  );
}

function DisabledOptionColorPickerDemo() {
  const [value, setValue] = useState(customColorOptions[1].value);

  return (
    <YStack gap="$3">
      <ColorPickerPalette
        value={value}
        onChange={setValue}
        colors={customColorOptions}
        columns={5}
      />
      <ColorValue value={value} />
    </YStack>
  );
}

function ColorPickerPaletteDemo() {
  const [value, setValue] = useState('#3D63DD');

  return (
    <YStack gap="$3">
      <ColorPickerPalette value={value} onChange={setValue} columns={6} />
      <ColorValue value={value} />
    </YStack>
  );
}

function DisabledColorPickerDemo() {
  return <ColorPicker value="#83858F" disabled />;
}

function DisabledCustomTriggerColorPickerDemo() {
  const renderTrigger = useCallback(
    ({ color, disabled }: IColorPickerRenderTriggerProps) => (
      <XStack
        gap="$2"
        alignItems="center"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius="$2"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor="$borderSubdued"
        opacity={disabled ? 0.5 : 1}
      >
        <Stack
          width="$5"
          height="$5"
          borderRadius="$1"
          borderCurve="continuous"
          backgroundColor={color}
        />
        <SizableText size="$bodyMdMedium">Disabled trigger</SizableText>
      </XStack>
    ),
    [],
  );

  return (
    <ColorPicker
      value="#7C3AED"
      disabled
      colors={customColors}
      renderTrigger={renderTrigger}
    />
  );
}

function ColorPickerGallery() {
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="ColorPicker"
      elements={[
        {
          title: 'Default',
          element: <DefaultColorPickerDemo />,
        },
        {
          title: 'Custom palette',
          element: <CustomPaletteColorPickerDemo />,
        },
        {
          title: 'Custom trigger',
          element: <CustomTriggerColorPickerDemo />,
        },
        {
          title: 'Controlled open',
          element: <ControlledOpenColorPickerDemo />,
        },
        {
          title: 'Disabled options',
          element: <DisabledOptionColorPickerDemo />,
        },
        {
          title: 'Palette only',
          element: <ColorPickerPaletteDemo />,
        },
        {
          title: 'Disabled',
          element: <DisabledColorPickerDemo />,
        },
        {
          title: 'Disabled custom trigger',
          element: <DisabledCustomTriggerColorPickerDemo />,
        },
      ]}
    />
  );
}

export default ColorPickerGallery;
