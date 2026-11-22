// Non-native platforms cannot tell a fresh install from an upgrade
// synchronously, so they rely on the wallet presence hint alone.
export function isFreshInstallSync(): boolean {
  return false;
}
