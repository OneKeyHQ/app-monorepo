import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapLimitOrderStatus } from '@onekeyhq/shared/types/swap/types';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useFormatDate from '../../../hooks/useFormatDate';

interface ILimitOrderListItemProps {
  item: IFetchLimitOrderRes;
  onClickCell: () => void;
  onCancel: () => void;
}

const LimitOrderListItemAvatar = ({
  fromUri,
  toUri,
}: {
  fromUri: string;
  toUri: string;
}) => (
  <YStack w="$5" h="$10" gap="$2" alignItems="center" justifyContent="center">
    <Stack>
      <Token size="sm" tokenImageUri={fromUri} />
    </Stack>
    <Stack>
      <Token size="sm" tokenImageUri={toUri} />
    </Stack>
  </YStack>
);

const LimitOrderListItem = ({
  item,
  onClickCell,
  onCancel,
}: ILimitOrderListItemProps) => {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const statusText = useMemo(() => {
    if (item.status === ESwapLimitOrderStatus.FULFILLED) {
      return (
        <SizableText size="$bodySm" color="$textSuccess">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_success,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.CANCELLED) {
      return (
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_canceled,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.EXPIRED) {
      return (
        <SizableText size="$bodySm" color="$textCritical">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_cancelling,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.OPEN) {
      return (
        <SizableText size="$bodySm" color="$textSuccess">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_canceled,
          })}
        </SizableText>
      );
    }
    if (item.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING) {
      return (
        <SizableText size="$bodySm" color="$textSuccess">
          {intl.formatMessage({
            id: ETranslations.swap_history_status_pending,
          })}
        </SizableText>
      );
    }
    return null;
  }, [intl, item.status]);

  const expirationTitle = useMemo(() => {
    const dateStr = formatDate(new Date(item.expiredAt), {
      hideYear: true,
      onlyTime: true,
    });
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {dateStr}
      </SizableText>
    );
  }, [formatDate, item.expiredAt]);

  const actionButton = useMemo(() => {
    if (item.status === ESwapLimitOrderStatus.OPEN) {
      return <Button onPress={onCancel}>Cancel</Button>;
    }
    return null;
  }, [item.status, onCancel]);

  const progressStatus = useMemo(() => {
    const percentage =
      item.status === ESwapLimitOrderStatus.FULFILLED ? 100 : 0;
    return (
      <XStack>
        <Progress size="small" value={percentage} />
        <SizableText size="$bodySm" color="$textSubdued">
          {percentage}%
        </SizableText>
      </XStack>
    );
  }, [item.status]);

  return (
    <ListItem
      onPress={onClickCell}
      userSelect="none"
      renderAvatar={
        <LimitOrderListItemAvatar
          fromUri={item.fromTokenInfo?.logoURI ?? ''}
          toUri={item.toTokenInfo?.logoURI ?? ''}
        />
      }
    >
      <Divider />
      <YStack
        w="$5"
        h="$10"
        gap="$2"
        alignItems="center"
        justifyContent="center"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {`+ ${item.toAmount} ${item.toTokenInfo?.symbol ?? ''}`}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {`- ${item.fromAmount} ${item.fromTokenInfo?.symbol ?? ''}`}
        </SizableText>
      </YStack>
      <SizableText size="$bodyMd" color="$textSubdued">
        1 btc = 10000 usdt
      </SizableText>
      <YStack>
        {statusText}
        {progressStatus}
      </YStack>
      <YStack>
        {expirationTitle}
        {actionButton}
      </YStack>
    </ListItem>
  );
};

export default LimitOrderListItem;
