import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useFormatDate from '../../../hooks/useFormatDate';

interface ISwapTxHistoryListCellProps {
  item: ISwapTxHistory;
  onClickCell: () => void;
}

const SwapTxHistoryAvatar = ({
  fromUri,
  toUri,
}: {
  fromUri: string;
  toUri: string;
}) => (
  <Stack w="$10" h="$10" alignItems="flex-end" justifyContent="flex-end">
    <Stack position="absolute" left="$0" top="$0">
      <Token size="sm" tokenImageUri={fromUri} />
    </Stack>
    <Stack borderWidth={2} borderColor="$bgApp" borderRadius="$full" zIndex={1}>
      <Token size="sm" tokenImageUri={toUri} />
    </Stack>
  </Stack>
);

const SwapTxHistoryListCell = ({
  item,
  onClickCell,
}: ISwapTxHistoryListCellProps) => {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const subContent = useMemo(() => {
    const { created } = item.date;
    const dateStr = formatDate(new Date(created), {
      hideYear: true,
      onlyTime: item.status !== ESwapTxHistoryStatus.PENDING,
    });
    return (
      <XStack space="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {dateStr}
        </SizableText>
        {item.status === ESwapTxHistoryStatus.FAILED ||
        item.status === ESwapTxHistoryStatus.DISCARD ? (
          <Badge badgeType="critical" badgeSize="lg">
            {intl.formatMessage({
              id:
                item.status === ESwapTxHistoryStatus.DISCARD
                  ? ETranslations.swap_history_status_discard
                  : ETranslations.swap_history_status_failed,
            })}
          </Badge>
        ) : null}
      </XStack>
    );
  }, [formatDate, intl, item.date, item.status]);

  const title = useMemo(
    () => (
      <XStack alignItems="center" space="$1">
        <SizableText size="$bodyLgMedium">
          {item.baseInfo.fromToken.symbol.toUpperCase()}
        </SizableText>
        <Icon name="ArrowRightOutline" size="$5" color="$iconSubdued" />
        <SizableText size="$bodyLgMedium">
          {item.baseInfo.toToken.symbol.toUpperCase()}
        </SizableText>
      </XStack>
    ),
    [item.baseInfo.fromToken.symbol, item.baseInfo.toToken.symbol],
  );
  return (
    <ListItem
      onPress={onClickCell}
      userSelect="none"
      renderAvatar={
        <SwapTxHistoryAvatar
          fromUri={item.baseInfo.fromToken.logoURI ?? ''}
          toUri={item.baseInfo.toToken.logoURI ?? ''}
        />
      }
    >
      <ListItem.Text flex={1} primary={title} secondary={subContent} />
      <ListItem.Text
        align="right"
        primary={
          <SizableText color="$textSuccess">
            +
            <NumberSizeableText color="$textSuccess" formatter="balance">
              {item.baseInfo.toAmount}
            </NumberSizeableText>{' '}
            <SizableText color="$textSuccess">
              {item.baseInfo.toToken.symbol.toUpperCase()}
            </SizableText>
          </SizableText>
        }
        primaryTextProps={{
          color: '$textSuccess',
        }}
        secondary={
          <SizableText textAlign="right" size="$bodyMd" color="$textSubdued">
            -
            <NumberSizeableText
              formatter="balance"
              size="$bodyMd"
              color="$textSubdued"
            >
              {item.baseInfo.fromAmount}
            </NumberSizeableText>{' '}
            <SizableText size="$bodyMd" color="$textSubdued">
              {item.baseInfo.fromToken.symbol.toUpperCase()}
            </SizableText>
          </SizableText>
        }
      />
    </ListItem>
  );
};

export default SwapTxHistoryListCell;
