export type ITravelModeRuntimeProfile = Readonly<{
  dappRequests: 'allowed' | 'blocked';
  kind: 'standard' | 'travel-mode';
  persistence: 'real' | 'masked';
  walletEffects: 'enabled' | 'suppressed';
}>;

const STANDARD_RUNTIME_PROFILE: ITravelModeRuntimeProfile = Object.freeze({
  dappRequests: 'allowed',
  kind: 'standard',
  persistence: 'real',
  walletEffects: 'enabled',
});

const TRAVEL_MODE_RUNTIME_PROFILE: ITravelModeRuntimeProfile = Object.freeze({
  dappRequests: 'blocked',
  kind: 'travel-mode',
  persistence: 'masked',
  walletEffects: 'suppressed',
});

export function getTravelModeRuntimeProfile(
  maskingData: boolean,
): ITravelModeRuntimeProfile {
  return maskingData ? TRAVEL_MODE_RUNTIME_PROFILE : STANDARD_RUNTIME_PROFILE;
}
