import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

export function navigateModalFromBackground(
  payload: IAppEventBusPayload[EAppEventBusNames.NavigateModalFromBackgroundThread],
) {
  const params = payload.params as
    | { screen?: unknown; params?: { screen?: unknown } }
    | undefined;
  if (
    platformEnv.isNative &&
    (payload.screen === ERootRoutes.Modal ||
      payload.screen === ERootRoutes.iOSFullScreen) &&
    params?.screen === EModalRoutes.DAppConnectionModal &&
    params.params?.screen ===
      EDAppConnectionModal.WalletConnectSessionProposalModal
  ) {
    // Dismiss in the main runtime without blocking approval navigation, even
    // if loading the helper or closing the dialog fails or never settles.
    void import('../components/WalletConnect/connectWalletConnectToDapp')
      .then(({ closeWalletConnectConnectionProgress }) =>
        closeWalletConnectConnectionProgress(),
      )
      .catch(() => undefined);
    // Close any open DApp-side WalletConnect modal programmatically so its
    // overlay/backdrop does not cover the incoming proposal without aborting
    // the pending pairing.
    void Promise.resolve()
      .then(() =>
        appEventBus.emit(EAppEventBusNames.WalletConnectCloseModal, undefined),
      )
      .catch(() => undefined);
  }
  appGlobals.$navigationRef.current?.navigate(payload.screen, payload.params);
}
