import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Dialog, SizableText, YStack } from '@onekeyhq/components';
import {
  EAmountInputMode,
  EBulkSendMode,
  type IAmountInputError,
  type IAmountInputValues,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import {
  BulkSendAmountsInputContext,
  useBulkSendAmountsInputContext,
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

function DialogAmountPreview({
  tokenSymbol,
  onMaxPress,
}: {
  tokenSymbol: string;
  onMaxPress: () => void;
}) {
  const { amountInputMode, tokenDetails, totalTokenAmount, totalFiatAmount } =
    useBulkSendAmountsInputContext();

  // Format fiat value with $ prefix for display
  const formattedFiatValue =
    totalFiatAmount !== '0'
      ? `$${parseFloat(totalFiatAmount).toFixed(2)}`
      : '$0';

  // Don't show preview for Custom mode
  if (amountInputMode === EAmountInputMode.Custom) {
    return (
      <YStack alignItems="center" justifyContent="center" p="$5">
        <SizableText
          size="$bodyLg"
          color="$textSubdued"
          textAlign="center"
          maxWidth={256}
        >
          Each transfer will use the amount you entered.
        </SizableText>
      </YStack>
    );
  }

  // Don't show preview for Range mode (cannot calculate exact total)
  if (amountInputMode === EAmountInputMode.Range) {
    return (
      <AmountPreview
        type={amountInputMode}
        totalAmount={undefined}
        totalFiatValue={undefined}
        availableBalance={tokenDetails?.balanceParsed ?? '0'}
        tokenSymbol={tokenSymbol}
        onMaxPress={onMaxPress}
      />
    );
  }

  return (
    <AmountPreview
      type={amountInputMode}
      totalAmount={totalTokenAmount !== '0' ? totalTokenAmount : undefined}
      totalFiatValue={totalTokenAmount !== '0' ? formattedFiatValue : undefined}
      availableBalance={tokenDetails?.balanceParsed ?? '0'}
      tokenSymbol={tokenSymbol}
      onMaxPress={onMaxPress}
    />
  );
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

  // Use shared validation logic
  const isAmountValid = useMemo(
    () =>
      calculateIsAmountValid({
        amountInputMode,
        amountInputErrors,
        amountInputValues,
        transfersInfo,
        balanceParsed: tokenDetails?.balanceParsed ?? '0',
      }),
    [
      amountInputMode,
      amountInputErrors,
      amountInputValues,
      transfersInfo,
      tokenDetails?.balanceParsed,
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

  const handleMaxPress = useCallback(() => {
    if (!tokenDetails?.balanceParsed) return;
    const balance = tokenDetails.balanceParsed;
    const maxPerAddress = new BigNumber(balance)
      .dividedBy(transfersInfo.length)
      .toFixed(tokenInfo.decimals, BigNumber.ROUND_DOWN);

    setAmountInputValues((prev) => ({
      ...prev,
      specifiedAmount: maxPerAddress,
    }));
    setAmountInputErrors((prev) => ({
      ...prev,
      specifiedAmount: undefined,
    }));
  }, [tokenDetails?.balanceParsed, transfersInfo.length, tokenInfo.decimals]);

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
        <AmountInputSection />
        <DialogAmountPreview
          tokenSymbol={tokenInfo.symbol}
          onMaxPress={handleMaxPress}
        />
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
