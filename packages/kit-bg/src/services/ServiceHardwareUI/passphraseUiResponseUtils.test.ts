import { buildPassphraseUiResponsePayload } from './passphraseUiResponseUtils';

describe('buildPassphraseUiResponsePayload', () => {
  test.each([
    [
      'Host Passphrase',
      { mode: 'host' as const, passphrase: 'host hidden wallet' },
      {
        value: 'host hidden wallet',
        passphraseOnDevice: false,
        attachPinOnDevice: false,
        save: false,
      },
    ],
    [
      '设备输入',
      { mode: 'device' as const },
      {
        value: '',
        passphraseOnDevice: true,
        attachPinOnDevice: false,
        save: false,
      },
    ],
    [
      'Attach PIN',
      { mode: 'attach-pin' as const },
      {
        value: '',
        passphraseOnDevice: false,
        attachPinOnDevice: true,
        save: false,
      },
    ],
  ])('%s 只回传一个钱包选择入口', (_name, input, expected) => {
    expect(buildPassphraseUiResponsePayload(input)).toEqual(expected);
  });
});
