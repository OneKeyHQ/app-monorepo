import type { ComponentType } from 'react';

export type ScreensListItem<T extends string> = {
  name: T;
  component: ComponentType<any>;
  alwaysShowBackButton?: boolean;
} & HeaderTitleProps;
export type ScreensList<T extends string> = ScreensListItem<T>[];
