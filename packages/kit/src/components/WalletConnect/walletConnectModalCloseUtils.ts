import type { AppStateStatus } from 'react-native';

export function shouldMarkWalletHandoffStarted({
  nextAppState,
  isNativeModalOpen,
  isWalletHandoffPrepared,
}: {
  nextAppState: AppStateStatus;
  isNativeModalOpen: boolean;
  isWalletHandoffPrepared: boolean;
}) {
  return (
    nextAppState !== 'active' && isNativeModalOpen && isWalletHandoffPrepared
  );
}

export function shouldAbortWalletConnectPairingOnModalClose({
  wasNativeModalOpen,
  isProgrammaticClose,
  hasStartedWalletHandoff,
  pairingTopic,
  connectedPairingTopic,
}: {
  wasNativeModalOpen: boolean;
  isProgrammaticClose: boolean;
  hasStartedWalletHandoff: boolean;
  pairingTopic: string;
  connectedPairingTopic: string;
}) {
  return (
    wasNativeModalOpen &&
    !isProgrammaticClose &&
    !hasStartedWalletHandoff &&
    pairingTopic !== connectedPairingTopic
  );
}
