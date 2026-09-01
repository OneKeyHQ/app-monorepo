import { applyPro2FirmwareForceTargetChange } from './applyPro2FirmwareForceTargetChange';

describe('applyPro2FirmwareForceTargetChange', () => {
  it('enabling force adds the target and clears the once flag', () => {
    expect(
      applyPro2FirmwareForceTargetChange({
        enabled: true,
        mode: 'force',
        onceTargets: ['resource', 'boot'],
        target: 'resource',
        targets: ['boot'],
      }),
    ).toEqual({
      pro2ForceUpdateOnceTargets: ['boot'],
      pro2ForceUpdateTargets: ['boot', 'resource'],
    });
  });

  it('disabling force only removes that target', () => {
    expect(
      applyPro2FirmwareForceTargetChange({
        enabled: false,
        mode: 'force',
        onceTargets: ['boot'],
        target: 'resource',
        targets: ['boot', 'resource'],
      }),
    ).toEqual({
      pro2ForceUpdateOnceTargets: ['boot'],
      pro2ForceUpdateTargets: ['boot'],
    });
  });

  it('enabling once adds the target and clears the force flag', () => {
    expect(
      applyPro2FirmwareForceTargetChange({
        enabled: true,
        mode: 'once',
        onceTargets: [],
        target: 'app_v1',
        targets: ['app_v1', 'boot'],
      }),
    ).toEqual({
      pro2ForceUpdateOnceTargets: ['app_v1'],
      pro2ForceUpdateTargets: ['boot'],
    });
  });

  it('does not duplicate an already-enabled target', () => {
    expect(
      applyPro2FirmwareForceTargetChange({
        enabled: true,
        mode: 'force',
        onceTargets: [],
        target: 'boot',
        targets: ['boot'],
      }),
    ).toEqual({
      pro2ForceUpdateOnceTargets: [],
      pro2ForceUpdateTargets: ['boot'],
    });
  });
});
