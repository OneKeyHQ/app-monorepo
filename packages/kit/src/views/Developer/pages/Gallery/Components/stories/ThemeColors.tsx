import {
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import { Layout } from './utils/Layout';

type IColorSwatch = {
  name: string;
  value: string;
  variableName?: boolean;
};

function ColorBlock({ name }: IColorSwatch) {
  return (
    <YStack
      mb="$4"
      alignItems="center"
      justifyContent="center"
      width="$10"
      ml="$2"
      gap="$1"
    >
      <Stack
        width="$12"
        height="$12"
        bg={`$${name}`}
        borderRadius="$2"
        borderWidth={1}
        borderColor="$borderColor"
      />
      <SizableText size="$bodySm">{name}</SizableText>
    </YStack>
  );
}

function ThemeColorCategory({
  title,
  colors,
}: {
  title: string;
  colors: IColorSwatch[];
}) {
  return (
    <YStack>
      <SizableText size="$headingMd" mb="$1">
        {title}
      </SizableText>
      <XStack mb="$1" flexWrap="wrap" gap="$2">
        {colors.map((color) => (
          <ColorBlock
            key={color.name}
            name={color.name}
            value={color.value}
            variableName
          />
        ))}
      </XStack>
    </YStack>
  );
}

const ThemeColorsGallery = () => {
  const theme = useTheme();
  const themeVariant = useThemeVariant();

  console.log('theme', Object.entries(theme));

  // Helper function to process color values
  const createColorSwatches = (prefix: string): IColorSwatch[] => {
    return Object.entries(theme)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => {
        // Attempt to get a meaningful representation of the color value
        let colorValue: string;

        if (typeof value === 'string') {
          colorValue = value;
        } else if (typeof value === 'object' && value !== null) {
          try {
            colorValue = JSON.stringify(value);
          } catch (e) {
            colorValue = String(value);
          }
        } else {
          colorValue = String(value);
        }

        return {
          name: key,
          value: colorValue,
          variableName: true,
        };
      });
  };

  // Extract color values from theme
  const themeColors: Record<string, IColorSwatch[]> = {
    Brand: createColorSwatches('brand'),
    Neutral: createColorSwatches('neutral'),
    Gray: createColorSwatches('gray'),
    Primary: createColorSwatches('primary'),
    Success: createColorSwatches('success'),
    Critical: createColorSwatches('critical'),
    Caution: createColorSwatches('caution'),
    Info: createColorSwatches('info'),
    Color: createColorSwatches('color'),
    Background: createColorSwatches('bg'),
    Text: createColorSwatches('text'),
  };

  return (
    <Layout filePath={__CURRENT_FILE_PATH__} componentName="Theme Colors">
      <YStack mb="$4">
        <SizableText size="$heading2xl" mb="$1">
          Current Theme: {themeVariant}
        </SizableText>
        <SizableText color="$textSubdued">
          This gallery showcases all available theme colors in the current
          theme.
        </SizableText>
      </YStack>

      {Object.entries(themeColors).map(([category, colors]) => (
        <ThemeColorCategory key={category} title={category} colors={colors} />
      ))}
    </Layout>
  );
};

export default ThemeColorsGallery;
