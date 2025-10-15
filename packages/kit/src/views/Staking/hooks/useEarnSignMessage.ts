import { useCallback } from 'react';

import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function useEarnSignMessage() {
  return useCallback(
    async ({
      accountId,
      networkId,
      provider,
      symbol,
      request,
    }: {
      networkId: string;
      accountId: string;
      request: IJsBridgeMessagePayload;
      provider: string | undefined;
      symbol: string | undefined;
    }) => {
      if (!provider || !symbol) {
        throw new OneKeyLocalError('provider and symbol is required');
      }
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      const unsignedMessage =
        await backgroundApiProxy.serviceStaking.buildRegisterSignMessageData({
          networkId,
          provider,
          symbol,
          accountAddress: account.address,
        });

      // Ensure newline characters are escaped for signing,
      // but avoid extra quotes from JSON.stringify.
      const escapedMessage = unsignedMessage.message.replace(/\n/g, '\\n');
      let message = autoFixPersonalSignMessage({
        message: escapedMessage,
      });
      message = `0x${Buffer.from(message, 'utf8').toString('hex')}`;

      const signHash =
        (await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId,
          networkId,
          request,
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message,
            payload: [message, account.address],
          },
          walletInternalSign: true,
        })) as string;

      const verifyResult =
        await backgroundApiProxy.serviceStaking.verifyRegisterSignMessage({
          networkId,
          provider,
          symbol,
          accountAddress: account.address,
          signature: signHash,
          message: unsignedMessage.message,
        });

      return verifyResult;
    },
    [],
  );
}
