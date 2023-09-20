import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { WalletConnectClientForDapp } from '../WalletConnectClientForDapp';

export async function terminateWcConnection({
  client,
  walletUrl,
}: {
  client?: WalletConnectClientForDapp | null;
  walletUrl?: string;
}) {
  const { serviceWalletConnect } = backgroundApiProxy;
  try {
    client?.offAllEvents();
    await serviceWalletConnect.removeWalletSession(walletUrl);
    if (client?.connector?.peerId) {
      client?.connector?.killSession();
    }
    client?.disconnect(); // seems not working
  } catch (error) {
    debugLogger.common.error('terminateWcConnection ERROR: ', error);
  }
}
