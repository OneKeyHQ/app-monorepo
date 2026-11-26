import {
  type PropsWithChildren,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirmActions } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { calculateTxExtraFee } from '@onekeyhq/shared/src/utils/feeUtils';

type IDecodeParams = Pick<
  Parameters<
    typeof backgroundApiProxy.serviceSignatureConfirm.buildDecodedTxs
  >[0],
  'accountId' | 'networkId' | 'unsignedTxs' | 'transferPayload' | 'sourceInfo'
>;

export function TxConfirmState({
  unsignedTxs,
  children,
}: PropsWithChildren<Pick<IDecodeParams, 'unsignedTxs'>>) {
  const { updateUnsignedTxs, updateDecodedTxsInit } =
    useSignatureConfirmActions().current;
  const [boundTxs, setBoundTxs] = useState<typeof unsignedTxs>();

  // The editor and queue share this store. Seed the route before mounting
  // consumers, then let edits and queue navigation update the live transactions.
  useLayoutEffect(() => {
    dismissKeyboard();
    updateDecodedTxsInit(false);
    updateUnsignedTxs(unsignedTxs);
    setBoundTxs(unsignedTxs);
  }, [unsignedTxs, updateUnsignedTxs, updateDecodedTxsInit]);

  return boundTxs === unsignedTxs ? children : null;
}

export function useTxConfirmDecodedTxs({
  accountId,
  networkId,
  unsignedTxs,
  transferPayload,
  sourceInfo,
}: IDecodeParams) {
  const { updateDecodedTxs, updateDecodedTxsInit, updateExtraFeeInfo } =
    useSignatureConfirmActions().current;
  const request = useMemo(
    () => ({ accountId, networkId, unsignedTxs, transferPayload, sourceInfo }),
    [accountId, networkId, unsignedTxs, transferPayload, sourceInfo],
  );
  const { result } = usePromiseResult(async () => {
    if (!request.unsignedTxs.length) return undefined;
    const decodedTxs =
      await backgroundApiProxy.serviceSignatureConfirm.buildDecodedTxs(request);
    const extraFee = decodedTxs.reduce(
      (total, decodedTx, index) =>
        total.plus(
          calculateTxExtraFee({
            decodedTx,
            solanaRent: request.unsignedTxs[index]?.solanaRent,
          }),
        ),
      new BigNumber(0),
    );
    return { request, decodedTxs, feeNative: extraFee.toFixed() };
  }, [request]);

  // usePromiseResult discards superseded completions. Only publish its accepted
  // result, and invalidate the previous review immediately when the input changes.
  const current = result?.request === request ? result : undefined;
  useLayoutEffect(() => {
    updateDecodedTxs({
      decodedTxs: current?.decodedTxs ?? [],
      isBuildingDecodedTxs: !current,
    });
    updateDecodedTxsInit(Boolean(current?.decodedTxs.length));
    updateExtraFeeInfo({ feeNative: current?.feeNative ?? '0' });
  }, [current, updateDecodedTxs, updateDecodedTxsInit, updateExtraFeeInfo]);

  return { decodedTxs: current?.decodedTxs, isBuildingDecodedTxs: !current };
}
