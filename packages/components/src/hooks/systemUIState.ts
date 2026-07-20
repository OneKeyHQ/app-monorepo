export type ISystemUIThemeVariant = 'light' | 'dark';

export type ISystemUIAppearance = {
  themeVariant: ISystemUIThemeVariant;
  backgroundColor: string;
  themeSetting?: 'light' | 'dark' | 'system';
};

/**
 * The app theme owns the Window by default. A fixed-dark route owns it while
 * focused; multiple owners are reference-counted because they all request the
 * same appearance.
 */
export class SystemUIAppearanceState {
  private baseAppearance: ISystemUIAppearance | undefined;

  private readonly darkOverrideOwners = new Set<symbol>();

  private revision = 0;

  setBaseAppearance(appearance: ISystemUIAppearance) {
    this.baseAppearance = appearance;
  }

  addDarkOverride(owner: symbol) {
    this.darkOverrideOwners.add(owner);
    this.revision += 1;
  }

  deleteDarkOverride(owner: symbol) {
    this.darkOverrideOwners.delete(owner);
  }

  scheduleBaseRestore(onRestore: () => void) {
    this.revision += 1;
    const revision = this.revision;
    void Promise.resolve().then(() => {
      if (revision === this.revision && this.darkOverrideOwners.size === 0) {
        onRestore();
      }
    });
  }

  getEffectiveAppearance(darkAppearance: ISystemUIAppearance) {
    return this.darkOverrideOwners.size > 0
      ? darkAppearance
      : this.baseAppearance;
  }
}
