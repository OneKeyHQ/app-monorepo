import {
  HardwareSDKScene,
  buildHardwareUiEventLogPayload,
  buildHardwareUiStateLogPayload,
} from './sdk';

describe('hardware SDK log payload', () => {
  test('logs whitelisted firmware progress in production and keeps other UI events masked', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const scene = new HardwareSDKScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    try {
      const progress = {
        progress: 42,
        progressType: 'installingFirmware',
        installTargetId: 5,
        installPhase: 'install',
        installPhaseProgress: 60,
      };
      const metrics = {
        transferredBytes: 420_000,
        totalBytes: 1_000_000,
        rateBytesPerSecond: 16_760,
        elapsedMs: 25_060,
      };
      scene.uiEvent('ui-firmware-progress', {
        ...progress,
        ...metrics,
        rawPayload: { walletState: 'excluded' },
        device: { deviceType: 'pro2', features: { walletState: 'excluded' } },
      });
      expect(emitLog).toHaveBeenLastCalledWith(
        'uiEvent',
        [
          'ui-firmware-progress',
          { deviceType: 'pro2', ...progress, ...metrics },
        ],
        [expect.objectContaining({ type: 'console' })],
      );
      const stateProgress = {
        firmwareProgress: 42,
        firmwareProgressType: 'installingFirmware',
        firmwareInstallTargetId: 5,
        firmwareInstallPhase: 'install',
        firmwareInstallPhaseProgress: 60,
      };
      scene.updateHardwareUiStateAtom({
        action: 'ui-firmware-progress',
        connectId: 'test-device',
        payload: {
          ...stateProgress,
          firmwareTransferMetrics: { ...metrics, rawPayload: 'excluded' },
          rawPayload: { walletState: 'excluded' },
        },
      });
      expect(emitLog).toHaveBeenLastCalledWith(
        'updateHardwareUiStateAtom',
        [
          'ui-firmware-progress',
          'test-device',
          { ...stateProgress, firmwareTransferMetrics: metrics },
        ],
        [expect.objectContaining({ type: 'local' })],
      );
      const masked = '❃❃❃❃ sensitive information ❃❃❃❃';
      scene.uiEvent('ui-request_passphrase', {
        progress: 42,
        rawPayload: 'excluded',
      });
      expect(emitLog).toHaveBeenLastCalledWith(
        'uiEvent',
        ['ui-request_passphrase', masked],
        expect.anything(),
      );
      scene.updateHardwareUiStateAtom({
        action: 'ui-request_passphrase',
        connectId: 'test-device',
        payload: { firmwareProgress: 42, rawPayload: 'excluded' },
      });
      expect(emitLog).toHaveBeenLastCalledWith(
        'updateHardwareUiStateAtom',
        ['ui-request_passphrase', 'test-device', masked],
        expect.anything(),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      emitLog.mockRestore();
    }
  });

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

  test('keeps firmware transfer metrics in UI event diagnostics', () => {
    expect(
      buildHardwareUiEventLogPayload({
        type: 'ui-firmware-progress',
        progress: 42,
        progressType: 'transferData',
        transferredBytes: 420_000,
        totalBytes: 1_000_000,
        rateBytesPerSecond: 16_760,
        elapsedMs: 25_060,
        device: {
          deviceType: 'pro2',
        },
      }),
    ).toEqual({
      eventType: 'ui-firmware-progress',
      deviceType: 'pro2',
      progress: 42,
      progressType: 'transferData',
      transferredBytes: 420_000,
      totalBytes: 1_000_000,
      rateBytesPerSecond: 16_760,
      elapsedMs: 25_060,
    });
  });
});
