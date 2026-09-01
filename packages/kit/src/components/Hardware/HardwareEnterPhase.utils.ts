export function resolvePassphraseEntryUi({
  deviceOnly,
  passphrase,
}: {
  deviceOnly: boolean;
  isVerifyMode: boolean;
  passphrase: string;
}) {
  if (deviceOnly) {
    return {
      showHostInput: false,
      primaryAction: 'device' as const,
      primaryDisabled: false,
    };
  }

  return {
    showHostInput: true,
    primaryAction: 'host' as const,
    primaryDisabled: !passphrase,
  };
}
