import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  ITransferInfoError,
  ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

type IUseTransferInfoActionsParams = {
  tokenInfo: IToken;
  transfersInfo: ITransferInfo[];
  setTransfersInfo: (transfersInfo: ITransferInfo[]) => void;
  transferInfoErrors: ITransferInfoErrors;
  setTransferInfoErrors: (errors: ITransferInfoErrors) => void;
};

export function useTransferInfoActions({
  tokenInfo,
  transfersInfo,
  setTransfersInfo,
  transferInfoErrors,
  setTransferInfoErrors,
}: IUseTransferInfoActionsParams) {
  const intl = useIntl();

  const handleDeleteTransfer = useCallback(
    (index: number) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo.splice(index, 1);
      setTransfersInfo(newTransfersInfo);

      // Remove the error for the deleted index and shift subsequent indices
      const newErrors = { ...transferInfoErrors };
      delete newErrors[index];
      const shiftedErrors: ITransferInfoErrors = {};
      Object.keys(newErrors).forEach((key) => {
        const keyNum = Number(key);
        if (keyNum > index) {
          shiftedErrors[keyNum - 1] = newErrors[keyNum];
        } else {
          shiftedErrors[keyNum] = newErrors[keyNum];
        }
      });
      setTransferInfoErrors(shiftedErrors);
    },
    [
      transfersInfo,
      setTransfersInfo,
      transferInfoErrors,
      setTransferInfoErrors,
    ],
  );

  const handleAmountChange = useCallback(
    (index: number, value: string) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo[index] = {
        ...newTransfersInfo[index],
        amount: value,
      };
      setTransfersInfo(newTransfersInfo);

      // Validate and update errors
      const { isValid, error } = validateTokenAmount({
        token: tokenInfo,
        amount: value,
        allowZero: false,
        customErrorMessages: {
          zeroAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
        },
      });
      const newErrors = { ...transferInfoErrors };
      if (!isValid && error) {
        newErrors[index] = {
          ...newErrors[index],
          amount: error,
        };
      } else if (newErrors[index]) {
        const { amount: _, ...rest } = newErrors[index];
        if (Object.keys(rest).length === 0) {
          delete newErrors[index];
        } else {
          newErrors[index] = rest as ITransferInfoError;
        }
      }
      setTransferInfoErrors(newErrors);
    },
    [
      intl,
      transfersInfo,
      setTransfersInfo,
      tokenInfo,
      transferInfoErrors,
      setTransferInfoErrors,
    ],
  );

  return {
    handleDeleteTransfer,
    handleAmountChange,
  };
}
