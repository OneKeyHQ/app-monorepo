// import { useEffect, useRef } from 'react';

// import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
// import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
// import type { ISwapApproveTransaction } from '@onekeyhq/shared/types/swap/types';
// import { ESwapApproveTransactionStatus } from '@onekeyhq/shared/types/swap/types';

// import { useSwapBuildTxFetchingAtom } from '../../../states/jotai/contexts/swap';

// import { useSwapBuildTx } from './useSwapBuiltTx';

// export function useSwapApproving() {
//   const [{ swapApprovingTransaction }, setInAppNotificationAtom] =
//     useInAppNotificationAtom();
//   const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
//   const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>(
//     undefined,
//   );
//   if (swapApprovingTxRef.current !== swapApprovingTransaction) {
//     swapApprovingTxRef.current = swapApprovingTransaction;
//   }
//   const { approveTx } = useSwapBuildTx();
//   const approveTxRef = useRef(approveTx);
//   if (approveTxRef.current !== approveTx) {
//     approveTxRef.current = approveTx;
//   }
//   const isFocused = useIsFocused();
//   const isFocusRef = useRef(isFocused);
//   if (isFocusRef.current !== isFocused) {
//     isFocusRef.current = isFocused;
//   }
//   useEffect(() => {
//     if (!isFocusRef.current) return;
//     if (
//       swapApprovingTransaction?.status === ESwapApproveTransactionStatus.SUCCESS
//     ) {
//       if (
//         swapApprovingTransaction?.resetApproveValue &&
//         Number(swapApprovingTransaction?.resetApproveValue) > 0
//       ) {
//         void approveTxRef.current?.(
//           swapApprovingTransaction?.resetApproveValue,
//           !!swapApprovingTransaction?.resetApproveIsMax,
//         );
//       }
//     } else if (
//       swapApprovingTransaction?.status === ESwapApproveTransactionStatus.FAILED
//     ) {
//       setSwapBuildTxFetching(false);
//     }
//   }, [
//     setInAppNotificationAtom,
//     setSwapBuildTxFetching,
//     swapApprovingTransaction?.resetApproveIsMax,
//     swapApprovingTransaction?.resetApproveValue,
//     swapApprovingTransaction?.status,
//     swapApprovingTransaction?.txId,
//   ]);
// }
