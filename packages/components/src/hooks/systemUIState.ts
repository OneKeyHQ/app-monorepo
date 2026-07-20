export type ISystemUIThemeVariant = 'light' | 'dark';

export type ISystemUIAppearance = {
  themeVariant: ISystemUIThemeVariant;
  backgroundColor: string;
  themeSetting?: 'light' | 'dark' | 'system';
};

type IOverrideEntry = {
  appearance: ISystemUIAppearance;
  sequence: number;
};

/**
 * Resolves the single Activity/Window appearance from an app-level base and
 * focused route overrides. This state intentionally lives outside React: the
 * Android system bars and decor background are Window-owned singleton state,
 * while several React Navigation trees can remain mounted at the same time.
 */
export class SystemUIAppearanceRegistry {
  private baseAppearance: ISystemUIAppearance | undefined;

  private readonly overrides = new Map<symbol, IOverrideEntry>();

  private sequence = 0;

  setBaseAppearance(appearance: ISystemUIAppearance) {
    this.baseAppearance = appearance;
  }

  setOverride(owner: symbol, appearance: ISystemUIAppearance) {
    this.sequence += 1;
    this.overrides.set(owner, {
      appearance,
      sequence: this.sequence,
    });
  }

  deleteOverride(owner: symbol) {
    this.overrides.delete(owner);
  }

  getEffectiveAppearance(): ISystemUIAppearance | undefined {
    let latestOverride: IOverrideEntry | undefined;
    this.overrides.forEach((entry) => {
      if (!latestOverride || entry.sequence > latestOverride.sequence) {
        latestOverride = entry;
      }
    });
    return latestOverride?.appearance ?? this.baseAppearance;
  }
}
