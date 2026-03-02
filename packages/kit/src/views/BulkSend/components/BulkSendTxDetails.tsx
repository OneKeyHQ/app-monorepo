import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EBulkSendMode,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import { filterNumericInput } from '../utils';

const INPUT_WIDTH = 130;
const ADDRESS_WIDTH = 120;

const INITIAL_BATCH = 20;
const BATCH_SIZE = 50;
const BATCH_INTERVAL = 100;

// Renders items in batches on native to avoid blocking the UI thread
function useProgressiveList<T>(items: T[]): T[] {
  const [visibleCount, setVisibleCount] = useState(
    platformEnv.isNative ? Math.min(INITIAL_BATCH, items.length) : items.length,
  );
  const prevLengthRef = useRef(items.length);

  useEffect(() => {
    if (!platformEnv.isNative) {
      setVisibleCount(items.length);
      return;
    }

    if (items.length !== prevLengthRef.current) {
      prevLengthRef.current = items.length;
      setVisibleCount(Math.min(INITIAL_BATCH, items.length));
    }
  }, [items.length]);

  useEffect(() => {
    if (!platformEnv.isNative || visibleCount >= items.length) return;

    const timer = setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, items.length));
    }, BATCH_INTERVAL);

    return () => clearTimeout(timer);
  }, [visibleCount, items.length]);

  return useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
}

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
  indices?: number[];
  canDelete?: boolean;
  onDeleteTransfers?: (indices: number[]) => void;
  onAmountChangeByIndex?: (index: number, amount: string) => void;
};

function TransferListItemBase({
  address,
  amount,
  tokenSymbol,
  type,
  addressError,
  amountError,
  editMode,
  deleteDisabled,
  indices,
  canDelete,
  onDeleteTransfers,
  onAmountChangeByIndex,
}: ITransferListItemProps) {
  const media = useMedia();
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
      const filteredText = filterNumericInput(text);
      if (onAmountChangeByIndex && indices?.length === 1) {
        onAmountChangeByIndex(indices[0], filteredText);
      }
    },
    [onAmountChangeByIndex, indices],
  );

  const handleDelete = useCallback(() => {
    if (onDeleteTransfers && canDelete && indices) {
      onDeleteTransfers(indices);
    }
  }, [onDeleteTransfers, canDelete, indices]);

  const showDeleteButton = canDelete && onDeleteTransfers && indices;

  const handleErrorIconPress = useCallback(() => {
    if (platformEnv.isNative && amountError) {
      Toast.error({ title: amountError });
    }
  }, [amountError]);

  const inputAddOns = useMemo<IInputAddOnProps[]>(
    () => [{ label: tokenSymbol }],
    [tokenSymbol],
  );

  const renderAmount = () => {
    if (editMode) {
      return (
        <XStack alignItems="center" gap="$2">
          {hasAmountError ? (
            <Tooltip
              renderTrigger={
                <Stack onPress={handleErrorIconPress}>
                  <Icon name="ErrorOutline" size="$5" color="$iconCritical" />
                </Stack>
              }
              renderContent={amountError}
              placement="top"
              {...(platformEnv.isNative && { open: false })}
            />
          ) : null}
          <Input
            width={INPUT_WIDTH}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0"
            keyboardType="decimal-pad"
            addOns={inputAddOns}
            textAlign="right"
            containerProps={{
              width: INPUT_WIDTH,
              borderWidth: 0,
              bg: '$bgSubdued',
            }}
          />
        </XStack>
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

  const renderAddress = () => {
    if (media.gtMd) {
      return (
        <SizableText
          size="$bodyMdMedium"
          color={hasAddressError ? '$textCritical' : '$text'}
        >
          {address}
        </SizableText>
      );
    }

    const addressText = (
      <SizableText
        size="$bodyMdMedium"
        color={hasAddressError ? '$textCritical' : '$text'}
        numberOfLines={1}
      >
        {shortenedAddress}
      </SizableText>
    );

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
        {...(!media.gtMd && {
          width: ADDRESS_WIDTH,
          minWidth: ADDRESS_WIDTH,
        })}
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

      {showDeleteButton ? (
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          size="small"
          disabled={deleteDisabled}
          onPress={handleDelete}
        />
      ) : null}
    </XStack>
  );
}

function arraysEqual(a?: number[], b?: number[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const TransferListItem = memo(
  TransferListItemBase,
  (prev, next) =>
    prev.address === next.address &&
    prev.amount === next.amount &&
    prev.tokenSymbol === next.tokenSymbol &&
    prev.type === next.type &&
    prev.addressError === next.addressError &&
    prev.amountError === next.amountError &&
    prev.editMode === next.editMode &&
    prev.deleteDisabled === next.deleteDisabled &&
    prev.canDelete === next.canDelete &&
    prev.onDeleteTransfers === next.onDeleteTransfers &&
    prev.onAmountChangeByIndex === next.onAmountChangeByIndex &&
    arraysEqual(prev.indices, next.indices),
);

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

  const intl = useIntl();

  const isDeleteDisabled = transfersInfo.length <= 1;

  const canEditSender =
    bulkSendMode === EBulkSendMode.ManyToOne ||
    bulkSendMode === EBulkSendMode.ManyToMany;
  const canEditReceiver =
    bulkSendMode === EBulkSendMode.OneToMany ||
    bulkSendMode === EBulkSendMode.ManyToMany;

  const tokenSymbol = tokenInfo.symbol;

  // Group transfers by unique from/to addresses, summing amounts
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
      const existingSender = senderMap.get(transfer.from);
      if (existingSender) {
        existingSender.amount = new BigNumber(existingSender.amount || '0')
          .plus(transfer.amount || '0')
          .toFixed();
        existingSender.indices.push(index);
      } else {
        senderMap.set(transfer.from, {
          address: transfer.from,
          amount: transfer.amount ?? '',
          indices: [index],
        });
      }

      const existingReceiver = receiverMap.get(transfer.to);
      if (existingReceiver) {
        existingReceiver.amount = new BigNumber(existingReceiver.amount || '0')
          .plus(transfer.amount || '0')
          .toFixed();
        existingReceiver.indices.push(index);
      } else {
        receiverMap.set(transfer.to, {
          address: transfer.to,
          amount: transfer.amount ?? '',
          indices: [index],
        });
      }
    });

    return {
      senders: Array.from(senderMap.values()),
      receivers: Array.from(receiverMap.values()),
    };
  }, [transfersInfo]);

  const visibleSenders = useProgressiveList(senders);
  const visibleReceivers = useProgressiveList(receivers);

  const handleDeleteTransfers = useCallback(
    (indices: number[]) => {
      // Delete in descending order to avoid index shifting
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
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.wallet_bulk_send_section_tx_details,
          })}
        </SizableText>
      </XStack>

      <TransferSection
        title={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_section_sending_address,
        })}
        count={senders.length}
      >
        {visibleSenders.map((sender) => (
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
            indices={sender.indices}
            canDelete={
              !!onDeleteTransfer && canEditSender
                ? !isDeleteDisabled
                : undefined
            }
            onDeleteTransfers={handleDeleteTransfers}
            onAmountChangeByIndex={handleAmountChange}
          />
        ))}
        {visibleSenders.length < senders.length ? (
          <SizableText size="$bodyMd" color="$textSubdued" py="$2">
            ...
          </SizableText>
        ) : null}
      </TransferSection>

      <TransferSection
        title={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_section_receiving_address,
        })}
        count={receivers.length}
      >
        {visibleReceivers.map((receiver) => (
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
            indices={receiver.indices}
            canDelete={
              !!onDeleteTransfer && canEditReceiver
                ? !isDeleteDisabled
                : undefined
            }
            onDeleteTransfers={handleDeleteTransfers}
            onAmountChangeByIndex={handleAmountChange}
          />
        ))}
        {visibleReceivers.length < receivers.length ? (
          <SizableText size="$bodyMd" color="$textSubdued" py="$2">
            ...
          </SizableText>
        ) : null}
      </TransferSection>
    </YStack>
  );
}

export default BulkSendTxDetails;
