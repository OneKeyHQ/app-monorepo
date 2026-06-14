import { sanitizeTrezorThpModuleLogData } from './trezorThpLogRedact';

describe('sanitizeTrezorThpModuleLogData', () => {
  it('redacts THP secret keys at the top level', () => {
    expect(
      sanitizeTrezorThpModuleLogData({
        packetHex: 'deadbeef',
        credential: 'abc',
        host_static_key: '00112233',
        pin: '1234',
        passphrase: 'hunter2',
        sendNonce: 7,
      }),
    ).toEqual({
      packetHex: '[redacted]',
      credential: '[redacted]',
      host_static_key: '[redacted]',
      pin: '[redacted]',
      passphrase: '[redacted]',
      sendNonce: '[redacted]',
    });
  });

  it('recurses into nested objects and arrays', () => {
    expect(
      sanitizeTrezorThpModuleLogData({
        message: { packetHex: 'aa', protocol: 'thp' },
        items: [{ pin: '0000' }, { ok: 1 }],
      }),
    ).toEqual({
      message: { packetHex: '[redacted]', protocol: 'thp' },
      items: [{ pin: '[redacted]' }, { ok: 1 }],
    });
  });

  it('drops sensitive field NAMES from dataKeys/messageKeys arrays', () => {
    expect(
      sanitizeTrezorThpModuleLogData({
        dataKeys: ['address_n', 'passphrase', 'show_display'],
        messageKeys: ['pin', 'foo'],
      }),
    ).toEqual({
      dataKeys: ['address_n', 'show_display'],
      messageKeys: ['foo'],
    });
  });

  it('leaves non-sensitive values untouched', () => {
    expect(
      sanitizeTrezorThpModuleLogData({
        protocol: 'thp',
        event: 'thp.pair.done',
        count: 3,
        ok: true,
      }),
    ).toEqual({
      protocol: 'thp',
      event: 'thp.pair.done',
      count: 3,
      ok: true,
    });
  });

  it('returns undefined for empty input', () => {
    expect(sanitizeTrezorThpModuleLogData(undefined)).toBeUndefined();
  });
});
