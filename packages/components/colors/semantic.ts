import * as primitiveColors from './primitive';

type IPrimitiveColors = typeof primitiveColors;
type IPrimitiveTheme = keyof IPrimitiveColors;

type IEnumerate<
  N extends number,
  Acc extends number[] = [],
> = Acc['length'] extends N
  ? Acc[number]
  : IEnumerate<N, [...Acc, Acc['length']]>;

type IRange<F extends number, T extends number> = Exclude<
  IEnumerate<T>,
  IEnumerate<F>
>;

function generateSemanticColors<
  T extends IPrimitiveTheme,
  E extends string,
  F extends IRange<13, 101>,
>(
  primitiveColorName: keyof IPrimitiveColors[T],
  semanticKey: E,
  theme: T,
  count: F,
) {
  const colors = primitiveColors[theme];
  const colorBase = colors[primitiveColorName];
  type IRangeNumber = IRange<1, typeof count>;

  type ISemanticColorKey = `${E}${IRangeNumber}`;
  const semanticColors = {} as Record<ISemanticColorKey, string>;

  Object.keys(colorBase as Record<string, string>).forEach((colorBaseKey) => {
    const matches = colorBaseKey.match(/(\d+)/);
    const i = matches?.[0];
    if (i) {
      const colorKey = colorBaseKey as unknown as keyof typeof colorBase;
      const key = `${semanticKey}${i}` as ISemanticColorKey;
      semanticColors[key] = colorBase[colorKey] as unknown as string;
    }
  });
  return semanticColors;
}

function generateSemanticColorsWithDefaultCount<
  T extends IPrimitiveTheme,
  E extends string,
>(primitiveColorName: keyof IPrimitiveColors[T], semanticKey: E, theme: T) {
  return generateSemanticColors(primitiveColorName, semanticKey, theme, 13);
}

/* 
  Light color theme
*/
export const brand = generateSemanticColorsWithDefaultCount(
  'brandA',
  'brand',
  'light',
);

export const primary = generateSemanticColorsWithDefaultCount(
  'grayA',
  'primary',
  'light',
);

export const neutral = generateSemanticColorsWithDefaultCount(
  'grayA',
  'neutral',
  'light',
);

export const caution = generateSemanticColorsWithDefaultCount(
  'yellowA',
  'caution',
  'light',
);

export const success = generateSemanticColorsWithDefaultCount(
  'greenA',
  'success',
  'light',
);

export const critical = generateSemanticColorsWithDefaultCount(
  'redA',
  'critical',
  'light',
);

export const info = generateSemanticColorsWithDefaultCount(
  'blueA',
  'info',
  'light',
);

/* 
  Dark color theme
*/
export const brandDark = generateSemanticColorsWithDefaultCount(
  'brandDarkA',
  'brand',
  'dark',
);

export const primaryDark = generateSemanticColorsWithDefaultCount(
  'grayDarkA',
  'primary',
  'dark',
);

export const neutralDark = generateSemanticColorsWithDefaultCount(
  'grayDarkA',
  'neutral',
  'dark',
);

export const cautionDark = generateSemanticColorsWithDefaultCount(
  'yellowDarkA',
  'caution',
  'dark',
);

export const successDark = generateSemanticColorsWithDefaultCount(
  'greenDarkA',
  'success',
  'dark',
);

export const infoDark = generateSemanticColorsWithDefaultCount(
  'blueDarkA',
  'info',
  'dark',
);

export const criticalDark = generateSemanticColorsWithDefaultCount(
  'redDarkA',
  'critical',
  'dark',
);
