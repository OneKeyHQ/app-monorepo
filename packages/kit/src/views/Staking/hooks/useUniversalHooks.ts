import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type {
  EApproveType,
  IStakeTxResponse,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useShowClaimEstimateGasAlert } from '../components/EstimateNetworkFee';

const createStakeInfoWithOrderId = ({
  stakingInfo,
  orderId,
}: {
  stakingInfo: IStakingInfo | undefined;
  orderId: string;
}): IStakingInfo => ({
  ...(stakingInfo as IStakingInfo),
  orderId,
});

const handleStakeSuccess = async ({
  data,
  stakeInfo,
  networkId,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo: IStakingInfo;
  networkId: string;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  if (
    Array.isArray(data) &&
    data.length === 1 &&
    data[0].signedTx?.txid &&
    stakeInfo.orderId
  ) {
    await backgroundApiProxy.serviceStaking.addEarnOrder({
      orderId: stakeInfo.orderId,
      networkId,
      txId: data[0].signedTx.txid,
      status: data[0].decodedTx.status,
    });
  }
  onSuccess?.(data);
};

export function useUniversalStake({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  return useCallback(
    async ({
      amount,
      symbol,
      term,
      feeRate,
      protocolVault,
      approveType,
      permitSignature,
      provider,
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      amount: string;
      symbol: string;
      term?: number;
      feeRate?: number;
      protocolVault?: string;
      approveType?: EApproveType;
      permitSignature?: string;
      provider: string;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const stakeTx =
        await backgroundApiProxy.serviceStaking.buildStakeTransaction({
          amount,
          networkId,
          accountId,
          symbol,
          term,
          provider,
          feeRate,
          protocolVault,
          approveType,
          permitSignature,
        });

      const encodedTx = await backgroundApiProxy.serviceStaking.buildEarnTx({
        networkId,
        accountId,
        tx: stakeTx.tx,
      });

      let useFeeInTx;
      let feeInfoEditable;
      if (
        networkUtils.isBTCNetwork(networkId) &&
        (encodedTx as IEncodedTxBtc).fee
      ) {
        useFeeInTx = true;
        feeInfoEditable = false;
      }

      const stakeInfoWithOrderId = createStakeInfoWithOrderId({
        stakingInfo,
        orderId: stakeTx.orderId,
      });

      await navigationToTxConfirm({
        encodedTx,
        stakingInfo: stakeInfoWithOrderId,
        onSuccess: async (data) => {
          await handleStakeSuccess({
            data,
            stakeInfo: stakeInfoWithOrderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
        useFeeInTx,
        feeInfoEditable,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalWithdraw({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  return useCallback(
    async ({
      amount,
      symbol,
      provider,
      identity,
      protocolVault,
      withdrawAll,
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      amount: string;
      symbol: string;
      provider: string;
      identity?: string;
      protocolVault?: string;
      withdrawAll: boolean;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      let stakeTx: IStakeTxResponse | undefined;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }

      if (stakingConfig?.unstakeWithSignMessage) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const { message, deadline } =
          await backgroundApiProxy.serviceStaking.buildLidoEthPermitMessageData(
            {
              accountId,
              networkId,
              amount,
            },
          );

        const signHash =
          (await backgroundApiProxy.serviceDApp.openSignMessageModal({
            accountId,
            networkId,
            request: { origin: 'https://lido.fi/', scope: 'ethereum' },
            unsignedMessage: {
              type: EMessageTypesEth.TYPED_DATA_V4,
              message,
              payload: [account.address, message],
            },
            walletInternalSign: true,
          })) as string;

        stakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            networkId,
            accountId,
            symbol,
            provider,
            signature: signHash,
            deadline,
          });
      } else {
        stakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            identity,
            networkId,
            accountId,
            symbol,
            provider,
            protocolVault,
            withdrawAll,
          });
      }
      const encodedTx = await backgroundApiProxy.serviceStaking.buildEarnTx({
        networkId,
        accountId,
        tx: stakeTx.tx,
      });
      let useFeeInTx;
      let feeInfoEditable;
      if (
        networkUtils.isBTCNetwork(networkId) &&
        (encodedTx as IEncodedTxBtc).fee
      ) {
        useFeeInTx = true;
        feeInfoEditable = false;
      }

      const stakeInfoWithOrderId = createStakeInfoWithOrderId({
        stakingInfo,
        orderId: stakeTx.orderId,
      });

      await navigationToTxConfirm({
        encodedTx,
        stakingInfo,
        signOnly: stakingConfig?.withdrawSignOnly,
        useFeeInTx,
        feeInfoEditable,
        onSuccess: async (data) => {
          if (!stakingConfig?.withdrawSignOnly) {
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess,
            });
          } else {
            const psbtHex = data[0].signedTx.finalizedPsbtHex;
            if (psbtHex && identity) {
              await backgroundApiProxy.serviceStaking.unstakePush({
                txId: identity,
                networkId,
                accountId,
                symbol,
                provider,
                unstakeTxHex: psbtHex,
              });
              onSuccess?.(data);
            }
          }
        },
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalClaim({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const showClaimEstimateGasAlert = useShowClaimEstimateGasAlert();
  return useCallback(
    async ({
      identity,
      amount,
      provider,
      claimTokenAddress,
      protocolVault,
      vault,
      symbol,
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      identity?: string;
      amount: string;
      symbol: string;
      provider: string;
      claimTokenAddress?: string;
      protocolVault?: string;
      stakingInfo?: IStakingInfo;
      vault: string;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
    }) => {
      const continueClaim = async () => {
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildClaimTransaction({
            networkId,
            accountId,
            symbol,
            provider,
            amount,
            identity,
            claimTokenAddress,
            vault,
          });
        const encodedTx = await backgroundApiProxy.serviceStaking.buildEarnTx({
          networkId,
          accountId,
          tx: stakeTx.tx,
        });
        let useFeeInTx;
        let feeInfoEditable;
        if (
          networkUtils.isBTCNetwork(networkId) &&
          (encodedTx as IEncodedTxBtc).fee
        ) {
          useFeeInTx = true;
          feeInfoEditable = false;
        }

        const stakeInfoWithOrderId = createStakeInfoWithOrderId({
          stakingInfo,
          orderId: stakeTx.orderId,
        });

        await navigationToTxConfirm({
          encodedTx,
          stakingInfo,
          onSuccess: async (data) => {
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess,
            });
          },
          onFail,
          useFeeInTx,
          feeInfoEditable,
        });
      };
      if (Number(amount) > 0) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const estimateFeeResp =
          await backgroundApiProxy.serviceStaking.estimateFee({
            networkId,
            provider,
            symbol,
            action: 'claim',
            amount,
            protocolVault,
            identity,
            accountAddress: account.address,
          });
        const tokenFiatValueBN = BigNumber(
          estimateFeeResp.token.price,
        ).multipliedBy(amount);
        if (tokenFiatValueBN.lt(estimateFeeResp.feeFiatValue)) {
          showClaimEstimateGasAlert({
            claimTokenFiatValue: tokenFiatValueBN.toFixed(),
            estFiatValue: estimateFeeResp.feeFiatValue,
            onConfirm: continueClaim,
          });
          return;
        }
      }
      await continueClaim();
    },
    [navigationToTxConfirm, accountId, networkId, showClaimEstimateGasAlert],
  );
}
