import type { IPro2FirmwareUpdateTarget } from '@onekeyhq/shared/types/device';

import type { IFirmwareUpdateDevSettings } from './devSettings';

export type IPro2FirmwareForceTargetMode = 'force' | 'once';

function addTarget(
  items: IPro2FirmwareUpdateTarget[],
  target: IPro2FirmwareUpdateTarget,
): IPro2FirmwareUpdateTarget[] {
  return items.includes(target) ? items : [...items, target];
}

function removeTarget(
  items: IPro2FirmwareUpdateTarget[],
  target: IPro2FirmwareUpdateTarget,
): IPro2FirmwareUpdateTarget[] {
  return items.filter((item) => item !== target);
}

export function applyPro2FirmwareForceTargetChange({
  enabled,
  mode,
  onceTargets,
  target,
  targets,
}: {
  enabled: boolean;
  mode: IPro2FirmwareForceTargetMode;
  onceTargets: IPro2FirmwareUpdateTarget[];
  target: IPro2FirmwareUpdateTarget;
  targets: IPro2FirmwareUpdateTarget[];
}): Pick<
  IFirmwareUpdateDevSettings,
  'pro2ForceUpdateOnceTargets' | 'pro2ForceUpdateTargets'
> {
  if (mode === 'force') {
    return {
      pro2ForceUpdateOnceTargets: enabled
        ? removeTarget(onceTargets, target)
        : onceTargets,
      pro2ForceUpdateTargets: enabled
        ? addTarget(targets, target)
        : removeTarget(targets, target),
    };
  }

  return {
    pro2ForceUpdateOnceTargets: enabled
      ? addTarget(onceTargets, target)
      : removeTarget(onceTargets, target),
    pro2ForceUpdateTargets: enabled ? removeTarget(targets, target) : targets,
  };
}
