import { classifyNativeAppInstallation } from './launchStateNativeInstallClassifier';

describe('classifyNativeAppInstallation', () => {
  it('short-circuits a new Android package install', () => {
    expect(
      classifyNativeAppInstallation({
        installationTime: 1000,
        lastUpdateTime: 1000,
        platform: 'android',
      }),
    ).toBe('freshInstall');
  });

  it('keeps an Android update ambiguous so Home can paint first', () => {
    expect(
      classifyNativeAppInstallation({
        installationTime: 1000,
        lastUpdateTime: 5000,
        platform: 'android',
      }),
    ).toBe('unknown');
  });

  it('keeps iOS ambiguous because bundle dates also change on update', () => {
    expect(
      classifyNativeAppInstallation({
        installationTime: 1000,
        platform: 'ios',
      }),
    ).toBe('unknown');
  });
});
