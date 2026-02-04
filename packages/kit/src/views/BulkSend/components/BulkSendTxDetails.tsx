import { useCallback, useMemo } from 'react';

import {
  type IYStackProps,
  Icon,
  IconButton,
  Input,
  SizableText,
  Stack,
  Toast,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IInputAddOnProps } from '@onekeyhq/components/src/forms/Input/InputAddOnItem';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EBulkSendMode,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

// Fixed width for input field to ensure consistent layout
const INPUT_WIDTH = 130;
// Fixed width for address to prevent wrapping
const ADDRESS_WIDTH = 120;

type IProps = {
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

// Filter input to only allow numbers and decimal point
function filterNumericInput(text: string): string {
  // Remove all characters except digits and decimal point
  let filtered = text.replace(/[^0-9.]/g, '');
  // Ensure only one decimal point
  const parts = filtered.split('.');
  if (parts.length > 2) {
    filtered = `${parts[0]}.${parts.slice(1).join('')}`;
  }
  return filtered;
}

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
  const media = useMedia();
  // On small screens, use shorter address format (6 leading + 4 trailing)
  const shortenedAddress = accountUtils.shortenAddress({
    address,
    leadingLength: media.gtMd ? 8 : 6,
    trailingLength: media.gtMd ? 6 : 4,
  });
  const isSend = type === 'send';
  const hasAddressError = !!addressError;
  const hasAmountError = !!amountError;

  const handleAmountChange = useCallback(
    (text: string) => {
      // Filter to only allow numeric input
      const filteredText = filterNumericInput(text);
      onAmountChange?.(filteredText);
    },
    [onAmountChange],
  );

  // Show error toast on mobile when tapping error icon
  const handleErrorIconPress = useCallback(() => {
    if (platformEnv.isNative && amountError) {
      Toast.error({ title: amountError });
    }
  }, [amountError]);

  const inputAddOns = useMemo<IInputAddOnProps[]>(
    () => [{ label: tokenSymbol }],
    [tokenSymbol],
  );

  const errorLeftAddOnProps = useMemo<IInputAddOnProps | undefined>(() => {
    if (!hasAmountError) return undefined;
    return {
      iconName: 'ErrorOutline',
      iconColor: '$iconCritical',
      onPress: handleErrorIconPress,
      tooltipProps: platformEnv.isNative
        ? undefined
        : {
            renderContent: amountError,
            placement: 'top',
          },
    };
  }, [hasAmountError, amountError, handleErrorIconPress]);

  const renderAmount = () => {
    if (editMode) {
      return (
        <Input
          width={INPUT_WIDTH}
          value={amount}
          onChangeText={handleAmountChange}
          placeholder="0"
          keyboardType="decimal-pad"
          error={hasAmountError}
          leftAddOnProps={errorLeftAddOnProps}
          addOns={inputAddOns}
          textAlign="right"
          containerProps={{
            width: INPUT_WIDTH,
            borderWidth: 0,
            bg: '$bgSubdued',
          }}
        />
      );
    }

    const displayAmount = isSend ? `-${amount}` : `+${amount}`;
    const textColor = isSend ? '$text' : '$textSuccess';

    return (
      <SizableText
        size="$bodyMdMedium"
        color={textColor}
        textAlign="right"
        flexShrink={0}
      >
        {`${displayAmount} ${tokenSymbol}`}
      </SizableText>
    );
  };

  // Render address with tooltip
  const renderAddress = () => {
    const addressText = (
      <SizableText
        size="$bodyMdMedium"
        color={hasAddressError ? '$textCritical' : '$text'}
        numberOfLines={1}
      >
        {shortenedAddress}
      </SizableText>
    );

    // On mobile, show tooltip on press; on desktop, show on hover
    return (
      <Tooltip
        renderTrigger={addressText}
        renderContent={address}
        placement="top"
      />
    );
  };

  return (
    <XStack gap="$3" py="$2" alignItems={editMode ? 'center' : 'flex-start'}>
      <YStack
        justifyContent="center"
        flexShrink={0}
        width={ADDRESS_WIDTH}
        minWidth={ADDRESS_WIDTH}
      >
        {renderAddress()}
        {hasAddressError ? (
          <XStack gap="$1" alignItems="center">
            <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
            <SizableText size="$bodyMd" color="$textCritical" numberOfLines={1}>
              {addressError}
            </SizableText>
          </XStack>
        ) : null}
      </YStack>

      <Stack flex={1} alignItems="flex-end">
        {renderAmount()}
      </Stack>

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

function BulkSendTxDetails(props: IProps) {
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
      // Delete in descending order to avoid index shifting issues
      [...indices]
        .toSorted((a, b) => b - a)
        .forEach((index) => {
          onDeleteTransfer?.(index);
        });
    },
    [onDeleteTransfer],
  );

  const handleDeleteReceiver = useCallback(
    (indices: number[]) => {
      // Delete in descending order to avoid index shifting issues
      [...indices]
        .toSorted((a, b) => b - a)
        .forEach((index) => {
          onDeleteTransfer?.(index);
        });
    },
    [onDeleteTransfer],
  );

  const handleAmountChange = useCallback(
    (index: number, amount: string) => onAmountChange?.(index, amount),
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
            editMode={Boolean(editMode && canEditSender)}
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
            amountError={getTransferError(receiver.indices, 'amount')}
            editMode={Boolean(editMode && canEditReceiver)}
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
