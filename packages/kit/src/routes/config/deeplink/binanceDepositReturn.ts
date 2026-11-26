import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  getBinanceDepositEventContext,
  parseBinanceDepositReturnNonce,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// Reached from the OS entry only (handler.native.ts). Neither the URL nor the
// nonce is logged; the background decides whether a session is waiting for
// this return and drops it otherwise. Nothing navigates from here. The
// launch URL means the system had closed the app while the user was away.
export async function handleBinanceDepositReturn(
  url: string,
  isLaunchUrl: boolean,
): Promise<void> {
  const returnNonce = parseBinanceDepositReturnNonce(url);
  if (!returnNonce) {
    return;
  }
  try {
    const session =
      await backgroundApiProxy.serviceBinanceDeposit.handleDepositReturn({
        returnNonce,
      });
    if (session) {
      defaultLogger.transaction.send.binanceDepositReturn({
        ...getBinanceDepositEventContext(session),
        returnType: isLaunchUrl ? 'relaunch' : 'deepLink',
      });
    }
  } catch {
    // Dropped on purpose: what was caught may describe the request.
  }
}
