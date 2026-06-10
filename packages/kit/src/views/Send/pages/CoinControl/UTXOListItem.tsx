import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Badge,
  Checkbox,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IUtxoInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import type { IntlShape } from 'react-intl';

// Sort options used by both selectable and read-only UTXO lists.
export enum EUtxoSortType {
  NewestFirst = 'newestFirst',
  OldestFirst = 'oldestFirst',
  SmallestFirst = 'smallestFirst',
  LargestFirst = 'largestFirst',
}

export function formatUtxoBlockTime(
  blockTime: number | undefined,
  confirmations: number | undefined,
  intl: IntlShape,
): string {
  if (blockTime) {
    return formatDate(new Date(blockTime));
  }
  if (confirmations === 0) {
    return intl.formatMessage({ id: ETranslations.global_pending });
  }
  return '-';
}

export function generateUtxoKey(txid: string, vout: number): string {
  return `${txid}:${vout}`;
}

// BIP44/49/84/86 paths look like m/<purpose>'/<coin>'/<account>'/<change>/<index>.
// The second-to-last component is 0 for receive and 1 for change.
export function isChangeUtxoPath(path: string | undefined): boolean {
  if (!path) return false;
  const parts = path.split('/');
  if (parts.length < 2) return false;
  return parts[parts.length - 2] === '1';
}

type IUtxoListItemProps = {
  item: IUtxoInfo;
  index: number;
  decimals: number;
  symbol: string;
  intl: IntlShape;
  isSelected?: boolean;
  onToggle?: (utxoKey: string) => void;
  readOnly?: boolean;
  isChange?: boolean;
  changeLabel?: string;
  isClaimed?: boolean;
  claimedLabel?: string;
};

const UTXOListItemInner = ({
  item,
  index,
  isSelected = false,
  onToggle,
  decimals,
  symbol,
  intl,
  readOnly,
  isChange,
  changeLabel,
  isClaimed,
  claimedLabel,
}: IUtxoListItemProps) => {
  const handlePress = useCallback(() => {
    if (readOnly || !onToggle) return;
    onToggle(generateUtxoKey(item.txid, item.vout));
  }, [item.txid, item.vout, onToggle, readOnly]);

  const formattedInfo = useMemo(
    () => formatUtxoBlockTime(item.blockTime, item.confirmations, intl),
    [item.blockTime, item.confirmations, intl],
  );

  const formattedAmount = useMemo(
    () => new BigNumber(item.value).shiftedBy(-decimals).toFixed(),
    [item.value, decimals],
  );

  const shortenedAddress = useMemo(
    () => accountUtils.shortenAddress({ address: item.address }),
    [item.address],
  );

  return (
    <XStack
      px="$5"
      py="$1"
      gap={readOnly ? '$2' : '$3'}
      ai="center"
      onPress={readOnly ? undefined : handlePress}
      {...(readOnly
        ? {}
        : {
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
          })}
    >
      {readOnly ? null : (
        <XStack ai="center" gap="$2" w={80} $md={{ w: 60 }}>
          <Checkbox
            testID="send-shortened-address-checkbox"
            value={isSelected}
            onChange={handlePress}
            shouldStopPropagation
          />
          <SizableText size="$bodyMd" color="$text">
            {index + 1}
          </SizableText>
        </XStack>
      )}

      <SizableText
        size="$bodyMd"
        color="$text"
        textAlign={readOnly ? 'left' : 'right'}
        minWidth={120}
      >
        {formattedAmount} {symbol}
      </SizableText>

      <YStack flex={1} ai="flex-end">
        <XStack ai="center" gap="$1.5">
          {isClaimed && claimedLabel ? (
            <Badge badgeType="warning" badgeSize="sm">
              <Badge.Text>{claimedLabel}</Badge.Text>
            </Badge>
          ) : null}
          {isChange && changeLabel ? (
            <Badge badgeType="default" badgeSize="sm">
              <Badge.Text>{changeLabel}</Badge.Text>
            </Badge>
          ) : null}
          <SizableText size="$bodyMd" color="$text">
            {shortenedAddress}
          </SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          {formattedInfo}
        </SizableText>
      </YStack>
    </XStack>
  );
};

export const UTXOListItem = memo(UTXOListItemInner);
UTXOListItem.displayName = 'UTXOListItem';
