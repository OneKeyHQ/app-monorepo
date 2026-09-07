const TRAVEL_MODE_CONTROL_PLANE_METHODS: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  $root: new Set(['getAtomStates', 'setAtomValue']),
  serviceApp: new Set(['isAppLocked', 'restartApp']),
  servicePassword: new Set([
    'cancelPasswordPromptDialog',
    'checkLockStatus',
    'encodeSensitiveText',
    'lockApp',
    'promptPasswordVerify',
    'rejectPasswordPromptDialog',
    'resetPasswordStatus',
    'resolvePasswordPromptDialog',
    'setAppLockDuration',
    'setEnableSystemIdleLock',
    'unLockApp',
    'verifyPassword',
    'waitPasswordEncryptorReady',
  ]),
  serviceSetting: new Set([
    'refreshLastActivity',
    'setCurrency',
    'setHapticFeedbackEnabled',
    'setLocale',
    'setTheme',
  ]),
  serviceTravelMode: new Set([
    'enterPage',
    'leavePage',
    'requestPageAdmission',
    'retryRestart',
    'setEnabled',
  ]),
};

function normalizeServiceName(serviceName: string): string | undefined {
  if (serviceName === '') {
    return '$root';
  }
  const parts = serviceName.split('@');
  if (parts.length === 1) {
    return parts[0] || undefined;
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return parts[1];
  }
  return undefined;
}

export function shouldRejectTravelModeServiceCall({
  methodName,
  serviceName,
}: {
  methodName: string;
  serviceName: string;
}): boolean {
  const normalizedServiceName = normalizeServiceName(serviceName);
  if (!normalizedServiceName) {
    return true;
  }
  const allowedMethods =
    TRAVEL_MODE_CONTROL_PLANE_METHODS[normalizedServiceName];
  return !allowedMethods?.has(methodName);
}

export function isTravelModeRecoveryServiceCall({
  methodName,
  serviceName,
}: {
  methodName: string;
  serviceName: string;
}): boolean {
  return (
    normalizeServiceName(serviceName) === 'serviceTravelMode' &&
    methodName === 'retryRestart'
  );
}
