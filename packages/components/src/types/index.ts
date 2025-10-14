import type { PropsWithChildren } from 'react';

import type { ColorTokens, TamaguiElement } from '@tamagui/web';

export type IPropsWithTestId<T = unknown> = T & {
  testID?: string;
} & PropsWithChildren;

export type IElement = TamaguiElement;
export type IColorTokens = ColorTokens;
