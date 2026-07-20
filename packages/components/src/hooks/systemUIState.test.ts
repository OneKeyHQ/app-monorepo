import { SystemUIAppearanceRegistry } from './systemUIState';

const lightAppearance = {
  themeVariant: 'light' as const,
  backgroundColor: '#ffffff',
};
const darkAppearance = {
  themeVariant: 'dark' as const,
  backgroundColor: '#0f0f0f',
};

describe('SystemUIAppearanceRegistry', () => {
  it('uses the app appearance when no route owns the window', () => {
    const registry = new SystemUIAppearanceRegistry();

    registry.setBaseAppearance(lightAppearance);

    expect(registry.getEffectiveAppearance()).toBe(lightAppearance);
  });

  it('keeps the latest route override above app theme changes', () => {
    const registry = new SystemUIAppearanceRegistry();
    const owner = Symbol('onboarding');
    registry.setBaseAppearance(lightAppearance);
    registry.setOverride(owner, darkAppearance);

    registry.setBaseAppearance({
      ...lightAppearance,
      backgroundColor: '#f5f5f5',
    });

    expect(registry.getEffectiveAppearance()).toBe(darkAppearance);
  });

  it('restores the previous owner and then the latest app appearance', () => {
    const registry = new SystemUIAppearanceRegistry();
    const firstOwner = Symbol('first-modal');
    const secondOwner = Symbol('second-modal');
    const updatedLightAppearance = {
      ...lightAppearance,
      backgroundColor: '#f5f5f5',
    };
    registry.setBaseAppearance(lightAppearance);
    registry.setOverride(firstOwner, darkAppearance);
    registry.setOverride(secondOwner, lightAppearance);
    registry.setBaseAppearance(updatedLightAppearance);

    expect(registry.getEffectiveAppearance()).toBe(lightAppearance);

    registry.deleteOverride(secondOwner);
    expect(registry.getEffectiveAppearance()).toBe(darkAppearance);

    registry.deleteOverride(firstOwner);
    expect(registry.getEffectiveAppearance()).toBe(updatedLightAppearance);
  });
});
