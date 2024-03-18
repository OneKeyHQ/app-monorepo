import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
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
        {item.status === ESwapTxHistoryStatus.FAILED ? (
          <Badge badgeType="critical" badgeSize="lg">
            {intl.formatMessage({ id: 'transaction__failed' })}
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
        primary={`+${
          item.baseInfo.toAmount
        } ${item.baseInfo.toToken.symbol.toUpperCase()}`}
        primaryTextProps={{
          color: '$textSuccess',
        }}
        secondary={`-${
          item.baseInfo.fromAmount
        } ${item.baseInfo.fromToken.symbol.toUpperCase()}`}
      />
    </ListItem>
  );
};

export default SwapTxHistoryListCell;
