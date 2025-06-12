import { useCallback } from 'react';

import { BundlerAction } from '@morpho-org/bundler-sdk-ethers';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethersV6';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MorphoBundlerContract } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
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
    }: IUseEarnPermitApproveParams) => {
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
        permit2Data.message.spender.toLowerCase() !==
        MorphoBundlerContract.toLowerCase()
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

      let permitBundlerAction;
      if (token.symbol === 'USDC') {
        permitBundlerAction = BundlerAction.permit(
          permit2Data.domain.verifyingContract,
          permit2Data.message.value,
          permit2Data.message.deadline,
          // @ts-expect-error
          ethers.Signature.from(signHash),
          true,
        );
      } else if (token.symbol === 'DAI') {
        if (!permit2Data.message.expiry) {
          throw new OneKeyLocalError('Expiry is required for DAI');
        }
        permitBundlerAction = BundlerAction.permitDai(
          permit2Data.message.nonce,
          permit2Data.message.expiry,
          true,
          // @ts-expect-error
          ethers.Signature.from(signHash),
          false,
        );
      } else {
        throw new OneKeyLocalError('Unsupported token');
      }

      return permitBundlerAction;
    },
    [navigationToMessageConfirmAsync],
  );

  return { getPermitSignature };
}
