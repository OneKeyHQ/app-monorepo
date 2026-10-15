import { parseBinanceDepositReturnNonce } from '@onekeyhq/shared/src/utils/binanceDepositUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// Reached from the OS entry only (handler.native.ts). Neither the URL nor the
// nonce is logged; the background decides whether a session is waiting for
// this return and drops it otherwise. Nothing navigates from here.
export async function handleBinanceDepositReturn(url: string): Promise<void> {
  const returnNonce = parseBinanceDepositReturnNonce(url);
  if (!returnNonce) {
    return;
  }
  try {
    await backgroundApiProxy.serviceBinanceDeposit.handleDepositReturn({
      returnNonce,
    });
  } catch {
    // Dropped on purpose: what was caught may describe the request.
  }
}
