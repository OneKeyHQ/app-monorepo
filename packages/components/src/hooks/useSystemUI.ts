import type { ISystemUIAppearance } from './systemUIState';

export type ISystemUIAppearanceOverride = ISystemUIAppearance & {
  enabled?: boolean;
};

export const setSystemUIBaseAppearance: (
  appearance: ISystemUIAppearance,
) => void = (_appearance) => {};

export const useSystemUIAppearanceOverride: (
  override: ISystemUIAppearanceOverride,
) => void = (_override) => {};

export type {
  ISystemUIAppearance,
  ISystemUIThemeVariant,
} from './systemUIState';
