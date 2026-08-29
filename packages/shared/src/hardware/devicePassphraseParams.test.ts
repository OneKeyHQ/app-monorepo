import { devicePassphraseParamsFromWallet } from './devicePassphraseParams';

describe('devicePassphraseParamsFromWallet', () => {
  it('binds a hidden wallet without empty-passphrase', () => {
    expect(devicePassphraseParamsFromWallet('hidden-state')).toEqual({
      passphraseState: 'hidden-state',
    });
  });

  it('binds a standard wallet as empty-passphrase only', () => {
    expect(devicePassphraseParamsFromWallet()).toEqual({
      useEmptyPassphrase: true,
    });
    expect(devicePassphraseParamsFromWallet('')).toEqual({
      useEmptyPassphrase: true,
    });
  });
});
