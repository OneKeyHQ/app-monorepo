import { useCallback, useMemo } from 'react';

import {
  type IYStackProps,
  Icon,
  IconButton,
  Input,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IInputAddOnProps } from '@onekeyhq/components/src/forms/Input/InputAddOnItem';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EBulkSendMode,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

type Props = {
  tokenInfo: IToken;
  editMode: boolean;
  transfersInfo: ITransferInfo[];
  transferInfoErrors?: ITransferInfoErrors;
  bulkSendMode?: EBulkSendMode;
  onDeleteTransfer?: (index: number) => void;
  onAmountChange?: (index: number, amount: string) => void;
  containerProps?: IYStackProps;
};

type ITransferListItemProps = {
  address: string;
  amount: string;
  tokenSymbol: string;
  type: 'send' | 'receive';
  addressError?: string;
  amountError?: string;
  editMode: boolean;
  deleteDisabled?: boolean;
  onDelete?: () => void;
  onAmountChange?: (amount: string) => void;
};

function TransferListItem({
  address,
  amount,
  tokenSymbol,
  type,
  addressError,
  amountError,
  editMode,
  deleteDisabled,
  onDelete,
  onAmountChange,
}: ITransferListItemProps) {
  const shortenedAddress = accountUtils.shortenAddress({ address });
  const isSend = type === 'send';
  const hasAddressError = !!addressError;
  const hasAmountError = !!amountError;

  const handleAmountChange = useCallback(
    (text: string) => {
      onAmountChange?.(text);
    },
    [onAmountChange],
  );

  const inputAddOns = useMemo<IInputAddOnProps[]>(() => {
    const addOns: IInputAddOnProps[] = [
      {
        label: tokenSymbol,
      },
    ];
    return addOns;
  }, [tokenSymbol]);

  const errorInputAddOns = useMemo<IInputAddOnProps[]>(() => {
    const addOns: IInputAddOnProps[] = [
      {
        iconName: 'ErrorOutline',
        iconColor: '$iconCritical',
        tooltipProps: {
          renderContent: amountError,
          placement: 'top',
        },
      },
    ];
    return addOns;
  }, [amountError]);

  const renderAmount = () => {
    if (editMode) {
      return (
        <Input
          flex={1}
          value={amount}
          onChangeText={handleAmountChange}
          placeholder="0"
          keyboardType="decimal-pad"
          error={hasAmountError}
          addOns={hasAmountError ? errorInputAddOns : inputAddOns}
        />
      );
    }

    const displayAmount = isSend ? `-${amount}` : `+${amount}`;
    const textColor = isSend ? '$text' : '$textSuccess';

    return (
      <NumberSizeableText
        size="$bodyMdMedium"
        color={textColor}
        textAlign="right"
        flexShrink={0}
        formatter="balance"
        formatterOptions={{ tokenSymbol, showPlusMinusSigns: true }}
      >
        {displayAmount}
      </NumberSizeableText>
    );
  };

  return (
    <XStack
      gap="$3"
      py="$2"
      alignItems={editMode ? 'center' : 'flex-start'}
    >
      <YStack justifyContent="center" flexShrink={0}>
        <SizableText
          size="$bodyMdMedium"
          color={hasAddressError ? '$textCritical' : '$text'}
        >
          {shortenedAddress}
        </SizableText>
        {hasAddressError ? (
          <XStack gap="$1" alignItems="center">
            <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
            <SizableText size="$bodyMd" color="$textCritical">
              {addressError}
            </SizableText>
          </XStack>
        ) : null}
      </YStack>

      <Stack flex={1}>{renderAmount()}</Stack>

      {onDelete ? (
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          size="small"
          disabled={deleteDisabled}
          onPress={onDelete}
        />
      ) : null}
    </XStack>
  );
}

type ITransferSectionProps = {
  title: string;
  count: number;
  children: React.ReactNode;
};

function TransferSection({ title, count, children }: ITransferSectionProps) {
  return (
    <YStack>
      <XStack py="$1">
        <SizableText size="$headingSm" color="$textSubdued">
          {title} ({count})
        </SizableText>
      </XStack>
      {children}
    </YStack>
  );
}

function BulkSendTxDetails(props: Props) {
  const {
    tokenInfo,
    editMode,
    transfersInfo,
    transferInfoErrors,
    bulkSendMode,
    onDeleteTransfer,
    onAmountChange,
    containerProps,
  } = props;

  // Disable delete when only one transfer exists
  const isDeleteDisabled = transfersInfo.length <= 1;

  // Permission rules based on bulk send mode
  const canEditSender =
    bulkSendMode === EBulkSendMode.ManyToOne ||
    bulkSendMode === EBulkSendMode.ManyToMany;
  const canEditReceiver =
    bulkSendMode === EBulkSendMode.OneToMany ||
    bulkSendMode === EBulkSendMode.ManyToMany;

  const tokenSymbol = tokenInfo.symbol;

  // Group transfers by unique from addresses (senders) and to addresses (receivers)
  const { senders, receivers } = useMemo(() => {
    const senderMap = new Map<
      string,
      { address: string; amount: string; indices: number[] }
    >();
    const receiverMap = new Map<
      string,
      { address: string; amount: string; indices: number[] }
    >();

    transfersInfo.forEach((transfer, index) => {
      // Aggregate senders
      const existingSender = senderMap.get(transfer.from);
      if (existingSender) {
        existingSender.indices.push(index);
      } else {
        senderMap.set(transfer.from, {
          address: transfer.from,
          amount: transfer.amount,
          indices: [index],
        });
      }

      // Aggregate receivers
      const existingReceiver = receiverMap.get(transfer.to);
      if (existingReceiver) {
        existingReceiver.indices.push(index);
      } else {
        receiverMap.set(transfer.to, {
          address: transfer.to,
          amount: transfer.amount,
          indices: [index],
        });
      }
    });

    return {
      senders: Array.from(senderMap.values()),
      receivers: Array.from(receiverMap.values()),
    };
  }, [transfersInfo]);

  const handleDeleteSender = useCallback(
    (indices: number[]) => {
      // Delete all transfers from this sender
      indices.forEach((index) => {
        onDeleteTransfer?.(index);
      });
    },
    [onDeleteTransfer],
  );

  const handleDeleteReceiver = useCallback(
    (indices: number[]) => {
      // Delete all transfers to this receiver
      indices.forEach((index) => {
        onDeleteTransfer?.(index);
      });
    },
    [onDeleteTransfer],
  );

  const handleAmountChange = useCallback(
    (index: number, amount: string) => {
      onAmountChange?.(index, amount);
    },
    [onAmountChange],
  );

  // Get error for a specific transfer index
  const getTransferError = useCallback(
    (indices: number[], field: 'from' | 'to' | 'amount') => {
      for (const index of indices) {
        const error = transferInfoErrors?.[index];
        if (error?.[field]) {
          return error[field];
        }
      }
      return undefined;
    },
    [transferInfoErrors],
  );

  return (
    <YStack gap="$3" {...containerProps}>
      <XStack py="$1">
        <SizableText size="$headingLg">Transaction details</SizableText>
      </XStack>

      <TransferSection title="Sending address" count={senders.length}>
        {senders.map((sender) => (
          <TransferListItem
            key={sender.address}
            address={sender.address}
            amount={sender.amount}
            tokenSymbol={tokenSymbol}
            type="send"
            addressError={getTransferError(sender.indices, 'from')}
            amountError={getTransferError(sender.indices, 'amount')}
            editMode={editMode && canEditSender}
            deleteDisabled={isDeleteDisabled}
            onDelete={
              onDeleteTransfer && canEditSender && !isDeleteDisabled
                ? () => handleDeleteSender(sender.indices)
                : undefined
            }
            onAmountChange={
              editMode && canEditSender && sender.indices.length === 1
                ? (amount) => handleAmountChange(sender.indices[0], amount)
                : undefined
            }
          />
        ))}
      </TransferSection>

      <TransferSection title="Receiving address" count={receivers.length}>
        {receivers.map((receiver) => (
          <TransferListItem
            key={receiver.address}
            address={receiver.address}
            amount={receiver.amount}
            tokenSymbol={tokenSymbol}
            type="receive"
            addressError={getTransferError(receiver.indices, 'to')}
            editMode={editMode && canEditReceiver}
            deleteDisabled={isDeleteDisabled}
            onDelete={
              onDeleteTransfer && canEditReceiver && !isDeleteDisabled
                ? () => handleDeleteReceiver(receiver.indices)
                : undefined
            }
            onAmountChange={
              editMode && canEditReceiver && receiver.indices.length === 1
                ? (amount) => handleAmountChange(receiver.indices[0], amount)
                : undefined
            }
          />
        ))}
      </TransferSection>
    </YStack>
  );
}

export default BulkSendTxDetails;
