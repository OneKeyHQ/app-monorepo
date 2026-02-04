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
  tokenInfo: IToken;
  transfersInfo: ITransferInfo[];
  setTransfersInfo: (transfersInfo: ITransferInfo[]) => void;
  previewState: IPreviewState;
  setPreviewState: React.Dispatch<React.SetStateAction<IPreviewState>>;
};

export function useAmountPreview({
  tokenInfo,
  transfersInfo,
  setTransfersInfo,
  previewState,
  setPreviewState,
}: IUseAmountPreviewParams) {
  const updateTransfersInfoWithAmounts = useCallback(
    (mode: EAmountInputMode, values: IAmountInputValues) => {
      let amounts: string[] = [];

      switch (mode) {
        case EAmountInputMode.Range:
          amounts = generateRandomAmountsFromRange({
            transfersInfo,
            rangeMin: values.rangeMin,
            rangeMax: values.rangeMax,
            decimals: tokenInfo.decimals,
          });
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
    [tokenInfo?.decimals, transfersInfo, setTransfersInfo],
  );

  const handlePreview = useCallback(
    (mode: EAmountInputMode, values: IAmountInputValues) => {
      updateTransfersInfoWithAmounts(mode, values);

      switch (mode) {
        case EAmountInputMode.Specified:
          setPreviewState((prev) => ({ ...prev, specifiedPreviewed: true }));
          break;
        case EAmountInputMode.Range:
          setPreviewState((prev) => ({ ...prev, rangePreviewed: true }));
          break;
        default:
          break;
      }
    },
    [updateTransfersInfoWithAmounts, setPreviewState],
  );

  const shouldShowTxDetails = useCallback(
    (mode: EAmountInputMode) => {
      switch (mode) {
        case EAmountInputMode.Custom:
          return true;
        case EAmountInputMode.Specified:
          return previewState.specifiedPreviewed;
        case EAmountInputMode.Range:
          return previewState.rangePreviewed;
        default:
          return false;
      }
    },
    [previewState],
  );

  const hidePreview = useCallback(
    (mode: EAmountInputMode) => {
      switch (mode) {
        case EAmountInputMode.Specified:
          setPreviewState((prev) => ({ ...prev, specifiedPreviewed: false }));
          break;
        case EAmountInputMode.Range:
          setPreviewState((prev) => ({ ...prev, rangePreviewed: false }));
          break;
        default:
          break;
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
