import { shouldAbortWalletConnectPairingOnModalClose } from './walletConnectModalCloseUtils';

describe('shouldAbortWalletConnectPairingOnModalClose', () => {
  it('aborts when the user closes an incomplete pairing', () => {
    expect(
      shouldAbortWalletConnectPairingOnModalClose({
        wasNativeModalOpen: true,
        isProgrammaticClose: false,
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
        pairingTopic: 'pairing-topic',
        connectedPairingTopic: '',
      }),
    ).toBe(false);
  });
});
