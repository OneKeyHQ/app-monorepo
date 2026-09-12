import platformEnv from '../platformEnv';

type ITravelModeRuntimeLaunchGateGlobal = typeof globalThis & {
  __onekeyTravelModeRuntimeLaunchGate?: Promise<boolean>;
};

export function installTravelModeRuntimeLaunchGate(gate: Promise<boolean>) {
  const runtimeGlobal = globalThis as ITravelModeRuntimeLaunchGateGlobal;
  if (runtimeGlobal.__onekeyTravelModeRuntimeLaunchGate) {
    return false;
  }
  runtimeGlobal.__onekeyTravelModeRuntimeLaunchGate = gate;
  return true;
}

export async function waitForTravelModeRuntimeLaunchGate(): Promise<boolean> {
  if (
    !platformEnv.isNativeBackgroundThread ||
    !platformEnv.enableNativeBackgroundThread
  ) {
    return true;
  }
  const gate = (globalThis as ITravelModeRuntimeLaunchGateGlobal)
    .__onekeyTravelModeRuntimeLaunchGate;
  if (!gate) {
    return false;
  }
  try {
    return (await gate) === true;
  } catch {
    return false;
  }
}

export function resetTravelModeRuntimeLaunchGateForTesting() {
  delete (globalThis as ITravelModeRuntimeLaunchGateGlobal)
    .__onekeyTravelModeRuntimeLaunchGate;
}
