import { resolvePassphraseEntryUi } from './HardwareEnterPhase.utils';

describe('resolvePassphraseEntryUi', () => {
  it('uses device entry without rendering the host input in device-only mode', () => {
    expect(
      resolvePassphraseEntryUi({
        deviceOnly: true,
        isVerifyMode: false,
        passphrase: '',
      }),
    ).toEqual({
      showHostInput: false,
      primaryAction: 'device',
      primaryDisabled: false,
    });
  });

  it('shows Host input when Pro2 explicitly sets deviceOnly=false', () => {
    expect(
      resolvePassphraseEntryUi({
        deviceOnly: false,
        isVerifyMode: false,
        passphrase: '',
      }),
    ).toEqual({
      showHostInput: true,
      primaryAction: 'host',
      primaryDisabled: true,
    });
  });

  it('does not submit an empty Host passphrase while recovering a hidden wallet', () => {
    expect(
      resolvePassphraseEntryUi({
        deviceOnly: false,
        isVerifyMode: true,
        passphrase: '',
      }),
    ).toEqual({
      showHostInput: true,
      primaryAction: 'host',
      primaryDisabled: true,
    });
  });
});
