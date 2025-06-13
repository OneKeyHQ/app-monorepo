import { useCallback } from 'react';

import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useFalconUSDfRegister() {
  return useCallback(
    async ({
      accountId,
      networkId,
      details,
    }: {
      networkId: string;
      accountId: string;
      details: IStakeProtocolDetails | undefined;
    }) => {
      if (!details) {
        throw new OneKeyLocalError('details is required');
      }
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      const unsignedMessage =
        await backgroundApiProxy.serviceStaking.buildRegisterSignMessageData({
          networkId,
          provider: details.provider.name,
          symbol: details.token.info.symbol,
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
          request: { origin: 'https://app.falcon.finance/', scope: 'ethereum' },
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
          provider: details.provider.name,
          symbol: details.token.info.symbol,
          accountAddress: account.address,
          signature: signHash,
          message: unsignedMessage.message,
        });

      return verifyResult;
    },
    [],
  );
}
