import { Suspense, lazy } from 'react';

import { useWcPayDialogState } from '../../../views/WalletConnectPay/dialog/wcPayDialogStore';

// Lazy on purpose: the flow chunk carries DialogV2 (@base-ui/react on web)
// and must stay out of the startup graph (see the vendor-crypto splitChunks
// history) — it loads on the first payment link only.
const WcPayDialogFlow = lazy(
  () => import('../../../views/WalletConnectPay/dialog/WcPayDialogFlow'),
);

/**
 * Global host for the WalletConnect Pay dialog. The dialog is not a
 * navigation route: entry points write the payment link into
 * wcPayDialogStore and this container renders the flow while it is open.
 * The instanceId key remounts the flow per open(), so every payment link
 * starts from a clean machine and closing aborts the in-flight attempt via
 * the flow's unmount cleanup.
 */
export function WalletConnectPayDialogContainer() {
  const { isOpen, paymentLink, instanceId } = useWcPayDialogState();
  if (!isOpen) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <WcPayDialogFlow key={instanceId} paymentLink={paymentLink} />
    </Suspense>
  );
}
