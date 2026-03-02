import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { validateTokenAmount } from '@onekeyhq/shared/src/utils/tokenUtils';
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

  // Ref to access latest errors in debounced callback without dependency churn
  const transferInfoErrorsRef = useRef(transferInfoErrors);
  transferInfoErrorsRef.current = transferInfoErrors;

  const handleDeleteTransfer = useCallback(
    (index: number) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo.splice(index, 1);
      setTransfersInfo(newTransfersInfo);

      // Remove the error at the deleted index and shift subsequent indices down
      const shiftedErrors: ITransferInfoErrors = {};
      for (const [key, value] of Object.entries(transferInfoErrors)) {
        const keyNum = Number(key);
        if (keyNum < index) {
          shiftedErrors[keyNum] = value;
        } else if (keyNum > index) {
          shiftedErrors[keyNum - 1] = value;
        }
      }
      setTransferInfoErrors(shiftedErrors);
    },
    [
      transfersInfo,
      setTransfersInfo,
      transferInfoErrors,
      setTransferInfoErrors,
    ],
  );

  const debouncedValidate = useDebouncedCallback(
    (index: number, value: string) => {
      const { isValid, error } = validateTokenAmount({
        token: tokenInfo,
        amount: value,
        allowZero: false,
        customErrorMessages: {
          emptyAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_invalid_amount,
          }),
          invalidAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_invalid_amount,
          }),
          negativeAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
          zeroAmount: intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_amount_zero,
          }),
          decimalPlaces: intl.formatMessage(
            {
              id: ETranslations.wallet_bulk_send_error_max_decimal_places,
            },
            { decimals: tokenInfo.decimals },
          ),
        },
      });

      const newErrors = { ...transferInfoErrorsRef.current };
      if (!isValid && error) {
        newErrors[index] = { ...newErrors[index], amount: error };
      } else {
        const existing = newErrors[index];
        if (existing) {
          const { amount: _, ...rest } = existing;
          if (Object.keys(rest).length === 0) {
            delete newErrors[index];
          } else {
            newErrors[index] = rest as ITransferInfoError;
          }
        }
      }
      setTransferInfoErrors(newErrors);
    },
    150,
  );

  // Update amount immediately for responsive typing; validation is debounced
  const handleAmountChange = useCallback(
    (index: number, value: string) => {
      const newTransfersInfo = [...transfersInfo];
      newTransfersInfo[index] = {
        ...newTransfersInfo[index],
        amount: value,
      };
      setTransfersInfo(newTransfersInfo);
      debouncedValidate(index, value);
    },
    [transfersInfo, setTransfersInfo, debouncedValidate],
  );

  return {
    handleDeleteTransfer,
    handleAmountChange,
  };
}
