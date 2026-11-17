export type IWalletSelectionMode = 'host' | 'device' | 'attach-pin';

export function buildPassphraseUiResponsePayload({
  mode,
  passphrase = '',
}: {
  mode: IWalletSelectionMode;
  passphrase?: string;
}) {
  return {
    value: mode === 'host' ? passphrase : '',
    passphraseOnDevice: mode === 'device',
    attachPinOnDevice: mode === 'attach-pin',
    save: false as const,
  };
}
