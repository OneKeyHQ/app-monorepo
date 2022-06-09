// @ts-nocheck
/* eslint-disable  */
import { useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Box } from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';

import { useManageTokens } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import { useDecodedTx } from '../../hooks/useDecodedTx';
import { useOnboardingFinished } from '../../hooks/useOnboardingFinished';
import { wait } from '../../utils/helper';
import { SwapQuoteTx } from '../Swap/typings';


import { SendConfirmModal } from './confirmViews/SendConfirmModal';
import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import SendConfirmLegacy from './SendConfirmLegacy';
import {
  SendConfirmParams,
  SendConfirmPayloadBase,
  SendRoutes,
  SendRoutesParams,
} from './types';

import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

function useReloadAccountBalance() {
  // do not remove this line, call account balance fetch
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { balances } = useManageTokens({
    fetchTokensOnMount: true,
  });
}

// TODO move to Vault / Service
async function prepareEncodedTx({
  encodedTx,
  networkImpl,
  sendConfirmParams,
}: {
  encodedTx: IEncodedTx;
  networkImpl: string;
  sendConfirmParams: SendConfirmParams;
}): Promise<IEncodedTx> {
  if (networkImpl === IMPL_EVM) {
    const tx = encodedTx as IEncodedTxEvm;
    // remove gas price if encodedTx build by DAPP
    if (sendConfirmParams.sourceInfo) {
      // *** DO NOT delete gasLimit here, fetchFeeInfo() will use it to calculate max limit
      // delete encodedTx.gas;
      // delete encodedTx.gasLimit;

      // *** DELETE gasPrice and use wallet re-calculated fee price
      delete tx.gasPrice;
      delete tx.maxPriorityFeePerGas;
      delete tx.maxFeePerGas;

      return Promise.resolve(tx);
    }
  }
  return Promise.resolve(encodedTx);
}

function useSendConfirmEncodedTx({
  sendConfirmParams,
  networkImpl,
}: {
  networkImpl: string;
  sendConfirmParams: SendConfirmParams;
}): IEncodedTx | null {
  const [encodedTx, setEncodedTx] = useState<IEncodedTx | null>(null);
  useEffect(() => {
    prepareEncodedTx({
      encodedTx: sendConfirmParams.encodedTx,
      sendConfirmParams,
      networkImpl,
    }).then((tx) => setEncodedTx(tx));
  }, [networkImpl, sendConfirmParams, sendConfirmParams.encodedTx]);
  return encodedTx;
}

function SendConfirm() {
  useOnboardingFinished();
  useReloadAccountBalance();
  const { accountId, networkId, walletId, networkImpl } =
    useActiveWalletAccount();

  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const isFromDapp = !!route.params.sourceInfo;
  const feeInfoEditable = route.params.feeInfoEditable ?? true;
  const feeInfoUseFeeInTx = route.params.feeInfoUseFeeInTx ?? false;
  const isSpeedUpOrCancel =
    route.params.actionType === 'cancel' ||
    route.params.actionType === 'speedUp';
  const payload = useMemo(
    // TODO refactor SendConfirmPayloadBase type like decodedTxAction
    () => (route.params.payload || {}) as SendConfirmPayloadBase,
    [route.params.payload],
  );

  const dappApprove = useDappApproveAction({
    id: route.params.sourceInfo?.id ?? '',
    closeOnError: true,
  });

  const encodedTx = useSendConfirmEncodedTx({
    sendConfirmParams: route.params,
    networkImpl,
  });

  const { decodedTx } = useDecodedTx({ encodedTx, payload });

  return (
    <SendConfirmModal>
      <DecodeTxButtonTest encodedTx={encodedTx} />
      <Box>{JSON.stringify(decodedTx?.actions)}</Box>
    </SendConfirmModal>
  );
}

function SendConfirmProxy() {
  const { accountId, networkId, walletId, networkImpl } =
    useActiveWalletAccount();
  if (networkImpl === IMPL_EVM) {
    return <SendConfirmLegacy />;
  }
  return <SendConfirmLegacy />;
  // return <SendConfirm />;
}

// export default SendConfirm;
export default SendConfirmProxy;
export { SendConfirm };
