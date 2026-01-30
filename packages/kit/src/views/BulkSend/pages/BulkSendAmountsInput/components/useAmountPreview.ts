import { useCallback } from "react";

import type { ITransferInfo } from "@onekeyhq/kit-bg/src/vaults/types";
import { EAmountInputMode, type IAmountInputValues } from "@onekeyhq/shared/types/bulkSend";
import type { IToken } from "@onekeyhq/shared/types/token";

import { generateAmountsFromSpecifiedAmount, generateRandomAmountsFromRange } from "../../../utils";

import type { IPreviewState } from "./Context";

type IUseAmountPreviewParams = {
  tokenInfo: IToken;
  transfersInfo: ITransferInfo[];
  setTransfersInfo: (transfersInfo: ITransferInfo[]) => void;
  previewState: IPreviewState;
  setPreviewState: (state: IPreviewState) => void;
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
      let newTransfersInfo = [...transfersInfo];

      if (mode === EAmountInputMode.Range) {
        const amounts = generateRandomAmountsFromRange({
          transfersInfo,
          rangeMin: values.rangeMin,
          rangeMax: values.rangeMax,
          decimals: tokenInfo.decimals,
        });
        newTransfersInfo = transfersInfo.map((transfer, index) => ({
          ...transfer,
          amount: amounts[index],
        }));
      } else if (mode === EAmountInputMode.Specified) {
        const amounts = generateAmountsFromSpecifiedAmount({
          specifiedAmount: values.specifiedAmount ?? "0",
          transfersInfo,
        });
        newTransfersInfo = transfersInfo.map((transfer, index) => ({
          ...transfer,
          amount: amounts[index],
        }));
      }

      setTransfersInfo(newTransfersInfo);
    },
    [tokenInfo?.decimals, transfersInfo, setTransfersInfo],
  );

  const handlePreview = useCallback(
    (mode: EAmountInputMode, values: IAmountInputValues) => {
      updateTransfersInfoWithAmounts(mode, values);

      if (mode === EAmountInputMode.Specified) {
        setPreviewState({ ...previewState, specifiedPreviewed: true });
      } else if (mode === EAmountInputMode.Range) {
        setPreviewState({ ...previewState, rangePreviewed: true });
      }
    },
    [updateTransfersInfoWithAmounts, previewState, setPreviewState],
  );

  const shouldShowTxDetails = useCallback(
    (mode: EAmountInputMode) => {
      if (mode === EAmountInputMode.Custom) {
        return true;
      }
      if (mode === EAmountInputMode.Specified) {
        return previewState.specifiedPreviewed;
      }
      if (mode === EAmountInputMode.Range) {
        return previewState.rangePreviewed;
      }
      return false;
    },
    [previewState],
  );

  const hidePreview = useCallback(
    (mode: EAmountInputMode) => {
      if (mode === EAmountInputMode.Specified) {
        setPreviewState({ ...previewState, specifiedPreviewed: false });
      } else if (mode === EAmountInputMode.Range) {
        setPreviewState({ ...previewState, rangePreviewed: false });
      }
    },
    [previewState, setPreviewState],
  );

  return {
    handlePreview,
    shouldShowTxDetails,
    hidePreview,
    updateTransfersInfoWithAmounts,
  };
}
