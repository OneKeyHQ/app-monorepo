import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Dialog, SizableText, YStack } from '@onekeyhq/components';
import {
  EAmountInputMode,
  EBulkSendMode,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import {
  BulkSendAmountsInputContext,
  calculateIsAmountValid,
  type IAmountInputError,
  type IAmountInputValues,
} from './Context';
import { AmountInputSection } from './AmountInput';
import { AmountPreview } from './AmountPreview';

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
  amountInputMode,
  tokenDetails,
  tokenSymbol,
  onMaxPress,
  amountInputValues,
  receiverCount,
}: {
  amountInputMode: EAmountInputMode;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  tokenSymbol: string;
  onMaxPress: () => void;
  amountInputValues: IAmountInputValues;
  receiverCount: number;
}) {
  const { totalAmount, totalFiatValue } = useMemo(() => {
    if (amountInputMode === EAmountInputMode.Specified) {
      const amount = new BigNumber(amountInputValues.specifiedAmount || '0');
      const total = amount.times(receiverCount);
      const fiat =
        tokenDetails?.price && !total.isZero()
          ? `$${total.times(tokenDetails.price).toFixed(2)}`
          : '$0';
      return {
        totalAmount: total.isZero() ? '0' : total.toFixed(),
        totalFiatValue: fiat,
      };
    }
    return {
      totalAmount: undefined,
      totalFiatValue: undefined,
    };
  }, [
    amountInputMode,
    amountInputValues.specifiedAmount,
    receiverCount,
    tokenDetails?.price,
  ]);

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

  return (
    <AmountPreview
      type={amountInputMode}
      totalAmount={totalAmount}
      totalFiatValue={totalFiatValue}
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
      setTokenDetails: () => {},
      tokenDetailsState: {
        initialized: true,
        isRefreshing: false,
      },
      setTokenDetailsState: () => {},
      bulkSendMode: EBulkSendMode.OneToMany,
      transfersInfo,
      setTransfersInfo: () => {},
      amountInputMode,
      setAmountInputMode,
      amountInputValues,
      setAmountInputValues,
      amountInputErrors,
      setAmountInputErrors,
      isAmountValid,
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
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={contextValue}>
      <YStack>
        <AmountInputSection />
        <DialogAmountPreview
          amountInputMode={amountInputMode}
          tokenDetails={tokenDetails}
          tokenSymbol={tokenInfo.symbol}
          onMaxPress={handleMaxPress}
          amountInputValues={amountInputValues}
          receiverCount={transfersInfo.length}
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
