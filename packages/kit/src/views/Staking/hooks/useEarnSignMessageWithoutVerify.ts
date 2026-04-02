import { useCallback } from 'react';

import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useEarnSignMessageWithoutVerify() {
  return useCallback(
    async ({
      accountId,
      networkId,
      provider,
      symbol,
      amount,
      action,
      identity,
    }: {
      networkId: string;
      accountId: string;
      provider: string;
      symbol: string;
      // Stakefish: action is required
      action: 'stake' | 'unstake';
      // stake: amount required
      amount?: string;
      // unstake: identity required
      identity?: string;
    }) => {
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
          amount,
          action,
          identity,
        });

      let message = autoFixPersonalSignMessage({
        message: unsignedMessage.message,
      });
      message = `0x${Buffer.from(message, 'utf8').toString('hex')}`;

      const signature =
        (await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId,
          networkId,
          request: { origin: 'https://stake.fish/', scope: 'ethereum' },
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message,
            payload: [message, account.address],
          },
          walletInternalSign: true,
        })) as string;

      return { signature, message: unsignedMessage.message };
    },
    [],
  );
}
