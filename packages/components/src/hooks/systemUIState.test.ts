import { SystemUIAppearanceState } from './systemUIState';

const lightAppearance = {
  themeVariant: 'light' as const,
  backgroundColor: '#ffffff',
};
const darkAppearance = {
  themeVariant: 'dark' as const,
  backgroundColor: '#0f0f0f',
};

describe('SystemUIAppearanceState', () => {
  it('resolves the app theme and multiple fixed-dark owners', () => {
    const state = new SystemUIAppearanceState();
    state.setBaseAppearance(lightAppearance);
    expect(state.getEffectiveAppearance(darkAppearance)).toBe(lightAppearance);
    const firstOwner = Symbol('onboarding');
    const secondOwner = Symbol('prime');
    const updatedLightAppearance = {
      ...lightAppearance,
      backgroundColor: '#f5f5f5',
    };
    state.addDarkOverride(firstOwner);
    state.addDarkOverride(secondOwner);
    state.setBaseAppearance(updatedLightAppearance);
    expect(state.getEffectiveAppearance(darkAppearance)).toBe(darkAppearance);
    state.deleteDarkOverride(firstOwner);
    expect(state.getEffectiveAppearance(darkAppearance)).toBe(darkAppearance);
    state.deleteDarkOverride(secondOwner);
    expect(state.getEffectiveAppearance(darkAppearance)).toBe(
      updatedLightAppearance,
    );
  });

  it('does not restore the app theme between fixed-dark routes', async () => {
    const state = new SystemUIAppearanceState();
    const firstOwner = Symbol('dashboard');
    const secondOwner = Symbol('features');
    const onRestore = jest.fn();
    state.addDarkOverride(firstOwner);

    state.deleteDarkOverride(firstOwner);
    state.scheduleBaseRestore(onRestore);
    state.addDarkOverride(secondOwner);
    await Promise.resolve();

    expect(onRestore).not.toHaveBeenCalled();

    state.deleteDarkOverride(secondOwner);
    state.scheduleBaseRestore(onRestore);
    await Promise.resolve();
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});
