export function shouldAbortWalletConnectPairingOnModalClose({
  wasNativeModalOpen,
  isProgrammaticClose,
  pairingTopic,
  connectedPairingTopic,
}: {
  wasNativeModalOpen: boolean;
  isProgrammaticClose: boolean;
  pairingTopic: string;
  connectedPairingTopic: string;
}) {
  return (
    wasNativeModalOpen &&
    !isProgrammaticClose &&
    pairingTopic !== connectedPairingTopic
  );
}
