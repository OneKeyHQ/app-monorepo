import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
} from '@onekeyhq/shared/src/consts/addresses';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { IEarnPermit2ApproveSignData } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useSignatureConfirm } from '../../../hooks/useSignatureConfirm';

interface IUseEarnPermitApproveParams {
  networkId: string;
  accountId: string;
  token: IToken;
  amountValue: string;
  providerName: string;
  vaultAddress: string;
}

export interface IPermitSignatureResult {
  signature: string;
  unsignedMessage: IEarnPermit2ApproveSignData;
}

export function useEarnPermitApprove() {
  const { navigationToMessageConfirmAsync } = useSignatureConfirm({
    accountId: '',
    networkId: '',
  });

  const getPermitSignature = useCallback(
    async ({
      networkId,
      accountId,
      token,
      amountValue,
      providerName,
      vaultAddress,
    }: IUseEarnPermitApproveParams): Promise<IPermitSignatureResult> => {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });

      const permit2Data =
        await backgroundApiProxy.serviceStaking.buildPermit2ApproveSignData({
          networkId,
          provider: providerName,
          symbol: token.symbol,
          accountAddress: account.address,
          vault: vaultAddress,
          amount: new BigNumber(amountValue).toFixed(),
        });

      // check spender address
      if (
        (networkId === getNetworkIdsMap().eth &&
          permit2Data.message.spender.toLowerCase() !==
            MorphoBundlerContract.toLowerCase()) ||
        (networkId === getNetworkIdsMap().base &&
          permit2Data.message.spender.toLowerCase() !==
            MorphoBaseBundlerContract.toLowerCase())
      ) {
        const error = new Error(
          `Invalid spender address. Expected: ${MorphoBundlerContract}, Got: ${permit2Data.message.spender}`,
        );
        defaultLogger.staking.page.permitSignError({
          error: error.message,
        });
        throw error;
      }

      const unsignedMessage = JSON.stringify(permit2Data);

      const signHash = await navigationToMessageConfirmAsync({
        accountId,
        networkId,
        unsignedMessage: {
          type: EMessageTypesEth.TYPED_DATA_V4,
          message: unsignedMessage,
          payload: [account.address, unsignedMessage],
        },
        walletInternalSign: true,
      });

      return {
        signature: signHash,
        unsignedMessage: permit2Data,
      };
    },
    [navigationToMessageConfirmAsync],
  );

  return { getPermitSignature };
}
