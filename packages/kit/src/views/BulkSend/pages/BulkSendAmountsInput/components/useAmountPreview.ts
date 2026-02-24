import { useCallback } from 'react';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAmountInputMode,
  type IAmountInputValues,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  generateAmountsFromSpecifiedAmount,
  generateRandomAmountsFromRange,
} from '../../../utils';

import type { IPreviewState } from './Context';

type IUseAmountPreviewParams = {
  tokenInfo: IToken | undefined;
  transfersInfo: ITransferInfo[];
  setTransfersInfo: (transfersInfo: ITransferInfo[]) => void;
  previewState: IPreviewState;
  setPreviewState: React.Dispatch<React.SetStateAction<IPreviewState>>;
  balance?: string;
};

export function useAmountPreview({
  tokenInfo,
  transfersInfo,
  setTransfersInfo,
  previewState,
  setPreviewState,
  balance,
}: IUseAmountPreviewParams) {
  const updateTransfersInfoWithAmounts = useCallback(
    (
      mode: EAmountInputMode,
      values: IAmountInputValues,
      preGeneratedAmounts?: string[],
    ) => {
      if (!tokenInfo) return;

      let amounts: string[] = [];

      switch (mode) {
        case EAmountInputMode.Range:
          // Use pre-generated amounts if available, otherwise generate new ones
          if (preGeneratedAmounts && preGeneratedAmounts.length > 0) {
            amounts = preGeneratedAmounts;
          } else {
            amounts = generateRandomAmountsFromRange({
              transfersInfo,
              rangeMin: values.rangeMin,
              rangeMax: values.rangeMax,
              decimals: tokenInfo.decimals,
              balance: balance ? [balance] : undefined,
            });
          }
          break;
        case EAmountInputMode.Specified:
          amounts = generateAmountsFromSpecifiedAmount({
            specifiedAmount: values.specifiedAmount ?? '0',
            transfersInfo,
          });
          break;
        default:
          return;
      }

      const newTransfersInfo = transfersInfo.map((transfer, index) => ({
        ...transfer,
        amount: amounts[index],
      }));

      setTransfersInfo(newTransfersInfo);
    },
    [tokenInfo, transfersInfo, setTransfersInfo, balance],
  );

  const handlePreview = useCallback(
    (
      mode: EAmountInputMode,
      values: IAmountInputValues,
      preGeneratedAmounts?: string[],
    ) => {
      updateTransfersInfoWithAmounts(mode, values, preGeneratedAmounts);

      if (mode === EAmountInputMode.Specified) {
        setPreviewState((prev) => ({ ...prev, specifiedPreviewed: true }));
      } else if (mode === EAmountInputMode.Range) {
        setPreviewState((prev) => ({ ...prev, rangePreviewed: true }));
      }
    },
    [updateTransfersInfoWithAmounts, setPreviewState],
  );

  const shouldShowTxDetails = useCallback(
    (mode: EAmountInputMode): boolean => {
      if (mode === EAmountInputMode.Custom) return true;
      if (mode === EAmountInputMode.Specified)
        return previewState.specifiedPreviewed;
      if (mode === EAmountInputMode.Range) return previewState.rangePreviewed;
      return false;
    },
    [previewState],
  );

  const hidePreview = useCallback(
    (mode: EAmountInputMode) => {
      if (mode === EAmountInputMode.Specified) {
        setPreviewState((prev) => ({ ...prev, specifiedPreviewed: false }));
      } else if (mode === EAmountInputMode.Range) {
        setPreviewState((prev) => ({ ...prev, rangePreviewed: false }));
      }
    },
    [setPreviewState],
  );

  return {
    handlePreview,
    shouldShowTxDetails,
    hidePreview,
    updateTransfersInfoWithAmounts,
  };
}
