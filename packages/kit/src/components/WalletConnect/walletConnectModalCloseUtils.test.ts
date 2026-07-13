import {
  shouldAbortWalletConnectPairingOnModalClose,
  shouldMarkWalletHandoffStarted,
} from './walletConnectModalCloseUtils';

describe('shouldMarkWalletHandoffStarted', () => {
  it('marks a prepared deeplink when the modal hands off to another app', () => {
    expect(
      shouldMarkWalletHandoffStarted({
        nextAppState: 'inactive',
        isNativeModalOpen: true,
        isWalletHandoffPrepared: true,
      }),
    ).toBe(true);
  });

  it('does not mark a handoff while the app remains active', () => {
    expect(
      shouldMarkWalletHandoffStarted({
        nextAppState: 'active',
        isNativeModalOpen: true,
        isWalletHandoffPrepared: true,
      }),
    ).toBe(false);
  });

  it('does not mark backgrounding before a deeplink is prepared', () => {
    expect(
      shouldMarkWalletHandoffStarted({
        nextAppState: 'background',
        isNativeModalOpen: true,
        isWalletHandoffPrepared: false,
      }),
    ).toBe(false);
  });
});

describe('shouldAbortWalletConnectPairingOnModalClose', () => {
  it('aborts when the user closes an incomplete pairing', () => {
    expect(
      shouldAbortWalletConnectPairingOnModalClose({
        wasNativeModalOpen: true,
        isProgrammaticClose: false,
        hasStartedWalletHandoff: false,
        pairingTopic: 'pairing-topic',
        connectedPairingTopic: '',
      }),
    ).toBe(true);
  });

  it('keeps a pairing after the matching session connects', () => {
    expect(
      shouldAbortWalletConnectPairingOnModalClose({
        wasNativeModalOpen: true,
        isProgrammaticClose: false,
        hasStartedWalletHandoff: false,
        pairingTopic: 'pairing-topic',
        connectedPairingTopic: 'pairing-topic',
      }),
    ).toBe(false);
  });

  it('does not abort for a programmatic close', () => {
    expect(
      shouldAbortWalletConnectPairingOnModalClose({
        wasNativeModalOpen: true,
        isProgrammaticClose: true,
        hasStartedWalletHandoff: false,
        pairingTopic: 'pairing-topic',
        connectedPairingTopic: '',
      }),
    ).toBe(false);
  });

  it('keeps a pairing during a deeplink handoff before session approval', () => {
    expect(
      shouldAbortWalletConnectPairingOnModalClose({
        wasNativeModalOpen: true,
        isProgrammaticClose: false,
        hasStartedWalletHandoff: true,
        pairingTopic: 'pairing-topic',
        connectedPairingTopic: '',
      }),
    ).toBe(false);
  });
});
