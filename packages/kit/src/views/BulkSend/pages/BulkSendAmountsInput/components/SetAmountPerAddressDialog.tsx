import { useCallback, useMemo, useState } from 'react';

import { Dialog, Stack, YStack } from '@onekeyhq/components';
import {
  type EAmountInputMode,
  EBulkSendMode,
  type IAmountInputError,
  type IAmountInputValues,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import {
  BulkSendAmountsInputContext,
} from './Context';
import { AmountInputSection } from './AmountInput';
import { AmountPreview } from './AmountPreview';
import { calculateIsAmountValid, calculateTotalAmounts } from '../../../utils';

type ISetAmountPerAddressDialogProps = {
  accountId: string | undefined;
  networkId: string;
  tokenInfo: IToken;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  transfersInfo: ITransferInfo[];
  initialMode: EAmountInputMode;
  initialValues: IAmountInputValues;
  onConfirm: (mode: EAmountInputMode, values: IAmountInputValues) => void;
};

function DialogAmountPreview() {
  return <Stack mt="$6">
    <AmountPreview inDialog />
  </Stack>
}

function SetAmountPerAddressDialogContent({
  accountId,
  networkId,
  tokenInfo,
  tokenDetails,
  transfersInfo,
  initialMode,
  initialValues,
  onConfirm,
}: ISetAmountPerAddressDialogProps) {
  // Local state for the dialog (changes only apply on confirm)
  const [amountInputMode, setAmountInputMode] =
    useState<EAmountInputMode>(initialMode);
  const [amountInputValues, setAmountInputValues] =
    useState<IAmountInputValues>(initialValues);
  const [amountInputErrors, setAmountInputErrors] = useState<IAmountInputError>(
    {},
  );

  const isAmountValid = useMemo(
    () =>
      calculateIsAmountValid({
        amountInputMode,
        amountInputErrors,
        amountInputValues,
      }),
    [
      amountInputMode,
      amountInputErrors,
      amountInputValues,
    ],
  );

  // Calculate total amounts using shared logic
  const { totalTokenAmount, totalFiatAmount } = useMemo(
    () =>
      calculateTotalAmounts({
        transfersInfo,
        tokenPrice: tokenDetails?.price,
      }),
    [transfersInfo, tokenDetails?.price],
  );


  const handleConfirm = useCallback(() => {
    onConfirm(amountInputMode, amountInputValues);
  }, [amountInputMode, amountInputValues, onConfirm]);

  // Create context value for AmountInputSection to use
  const contextValue = useMemo(
    () => ({
      accountId,
      networkId,
      tokenInfo,
      tokenDetails,
      setTokenDetails: () => { },
      tokenDetailsState: {
        initialized: true,
        isRefreshing: false,
      },
      setTokenDetailsState: () => { },
      bulkSendMode: EBulkSendMode.OneToMany,
      transfersInfo,
      setTransfersInfo: () => { },
      amountInputMode,
      setAmountInputMode,
      amountInputValues,
      setAmountInputValues,
      amountInputErrors,
      setAmountInputErrors,
      isAmountValid,
      totalTokenAmount,
      totalFiatAmount,
    }),
    [
      accountId,
      networkId,
      tokenInfo,
      tokenDetails,
      transfersInfo,
      amountInputMode,
      amountInputValues,
      amountInputErrors,
      isAmountValid,
      totalTokenAmount,
      totalFiatAmount,
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={contextValue}>
      <YStack>
        <AmountInputSection inDialog />
        <DialogAmountPreview />
        <Dialog.Footer
          onConfirm={handleConfirm}
          onConfirmText="Confirm"
          onCancelText="Cancel"
          confirmButtonProps={{
            disabled: !isAmountValid,
          }}
        />
      </YStack>
    </BulkSendAmountsInputContext.Provider>
  );
}

export function showSetAmountPerAddressDialog(
  props: ISetAmountPerAddressDialogProps,
) {
  Dialog.show({
    title: 'Set amount per address',
    renderContent: <SetAmountPerAddressDialogContent {...props} />,
    showFooter: false,
  });
}
