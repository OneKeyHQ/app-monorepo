import {
  buildHardwareUiEventLogPayload,
  buildHardwareUiStateLogPayload,
} from './sdk';

describe('hardware SDK log payload', () => {
  test('keeps UI event diagnostics without wallet session identifiers', () => {
    expect(
      buildHardwareUiEventLogPayload({
        type: 'ui-request_passphrase',
        passphraseState: 'hidden-wallet-state',
        expectedPassphraseState: 'expected-hidden-wallet-state',
        rawPayload: { passphrase: 'secret' },
        device: {
          deviceType: 'pro2',
          deviceId: 'device-id',
          features: { passphrase_protection: true },
        },
        source: 'wallet-session-coordinator',
        reason: 'session-recovery',
        deviceOnly: false,
      }),
    ).toEqual({
      eventType: 'ui-request_passphrase',
      deviceType: 'pro2',
      source: 'wallet-session-coordinator',
      reason: 'session-recovery',
      deviceOnly: false,
    });
  });

  test('keeps UI state diagnostics without raw or derived wallet data', () => {
    expect(
      buildHardwareUiStateLogPayload({
        uiRequestType: 'ui-request_passphrase',
        eventType: 'request-passphrase',
        deviceType: 'pro2',
        deviceMode: 'normal',
        passphraseState: 'hidden-wallet-state',
        expectedPassphraseState: 'expected-hidden-wallet-state',
        rawPayload: { passphrase: 'secret' },
        source: 'wallet-session-coordinator',
        reason: 'session-recovery',
        existsAttachPinUser: true,
      }),
    ).toEqual({
      uiRequestType: 'ui-request_passphrase',
      eventType: 'request-passphrase',
      deviceType: 'pro2',
      deviceMode: 'normal',
      source: 'wallet-session-coordinator',
      reason: 'session-recovery',
      existsAttachPinUser: true,
    });
  });
});
