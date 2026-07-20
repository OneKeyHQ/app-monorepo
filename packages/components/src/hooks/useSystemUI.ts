import type { ISystemUIAppearance } from './systemUIState';

export const setSystemUIBaseAppearance: (
  appearance: ISystemUIAppearance,
) => void = (_appearance) => {};

export const useAndroidDarkSystemUIOverride = () => {};

export type {
  ISystemUIAppearance,
  ISystemUIThemeVariant,
} from './systemUIState';
