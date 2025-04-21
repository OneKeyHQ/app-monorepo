import { useCallback } from 'react';

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
        throw new Error('details is required');
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

      const msg = `0x${Buffer.from(unsignedMessage.message, 'utf8').toString(
        'hex',
      )}`;
      const signHash =
        (await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId,
          networkId,
          request: { origin: 'https://app.falcon.finance/', scope: 'ethereum' },
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message: msg,
            payload: [msg, account.address],
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
          expiredAt: unsignedMessage.expiredAt,
        });

      return verifyResult;
    },
    [],
  );
}
