import { useCallback } from 'react';

import {
  isTaskAccountAddress,
  isTaskAccountCurrent,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
      expectedAccountAddress,
      isCurrent,
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
      expectedAccountAddress?: string;
      isCurrent?: () => boolean;
    }) => {
      const ensureCurrent = () => {
        if (isCurrent && !isCurrent())
          throw new OneKeyLocalError('Task intent changed before signing');
      };
      ensureCurrent();
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      ensureCurrent();
      if (
        expectedAccountAddress !== undefined &&
        (!expectedAccountAddress ||
          !isTaskAccountAddress(
            { networkId, accountAddress: expectedAccountAddress },
            account.address,
          ))
      ) {
        throw new OneKeyLocalError('Task account changed before signing');
      }

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
      ensureCurrent();

      const { autoFixPersonalSignMessage } =
        await import('@onekeyhq/shared/src/utils/messageUtils');
      ensureCurrent();
      const fixedMessage = autoFixPersonalSignMessage({
        message: unsignedMessage.message,
      });
      const message = `0x${Buffer.from(fixedMessage, 'utf8').toString('hex')}`;

      if (
        expectedAccountAddress !== undefined &&
        !(await isTaskAccountCurrent({
          accountId,
          networkId,
          accountAddress: expectedAccountAddress,
        }))
      ) {
        throw new OneKeyLocalError('Task account changed before signing');
      }

      ensureCurrent();
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
