import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IUserNonFundingLedgerUpdate } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { calcCellAlign, getColumnStyle } from '../utils';

import type { IColumnConfig } from '../List/CommonTableListView';

const balanceFormatter: INumberFormatProps = {
  formatter: 'balance',
  formatterOptions: {
    currency: '$',
  },
};

interface IAccountRowProps {
  update: IUserNonFundingLedgerUpdate;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  isMobile?: boolean;
  index: number;
}

// Type display config map - TODO: Replace with i18n
const TYPE_CONFIG = new Map([
  [
    'deposit',
    { text: 'Deposit', icon: 'ArrowBottomOutline', isIncrease: true },
  ],
  [
    'withdraw',
    { text: 'Withdraw', icon: 'ArrowTopOutline', isIncrease: false },
  ],
  [
    'internalTransferIn',
    { text: 'Transfer In', icon: 'ArrowBottomOutline', isIncrease: true },
  ],
  [
    'internalTransferOut',
    { text: 'Transfer Out', icon: 'ArrowTopOutline', isIncrease: false },
  ],
  [
    'accountClassTransfer',
    {
      text: 'Account Transfer',
      icon: 'ArrowsRightLeftOutline',
      isIncrease: null,
    },
  ],
  [
    'rewardsClaim',
    { text: 'Rewards Claim', icon: 'GiftOutline', isIncrease: true },
  ],
  [
    'subAccountTransferIn',
    {
      text: 'Sub-account Transfer In',
      icon: 'FolderUserOutline',
      isIncrease: true,
    },
  ],
  [
    'subAccountTransferOut',
    {
      text: 'Sub-account Transfer Out',
      icon: 'FolderUserOutline',
      isIncrease: false,
    },
  ],
  [
    'vaultDeposit',
    { text: 'Vault Deposit', icon: 'BankOutline', isIncrease: false },
  ],
  [
    'vaultWithdraw',
    { text: 'Vault Withdraw', icon: 'BankOutline', isIncrease: true },
  ],
  [
    'vaultCreate',
    { text: 'Vault Create', icon: 'BankOutline', isIncrease: false },
  ],
  [
    'vaultDistribution',
    {
      text: 'Vault Distribution',
      icon: 'HandCoinsOutline',
      isIncrease: true,
    },
  ],
  [
    'spotTransferIn',
    { text: 'Spot Transfer In', icon: 'SendOutline', isIncrease: true },
  ],
  [
    'spotTransferOut',
    { text: 'Spot Transfer Out', icon: 'SendOutline', isIncrease: false },
  ],
  ['sendIn', { text: 'Send In', icon: 'SendOutline', isIncrease: true }],
  ['sendOut', { text: 'Send Out', icon: 'SendOutline', isIncrease: false }],
  [
    'liquidation',
    { text: 'Liquidation', icon: 'ClockAlertOutline', isIncrease: false },
  ],
]);

const AccountRow = memo(
  ({
    update,
    cellMinWidth,
    columnConfigs,
    isMobile,
    index,
  }: IAccountRowProps) => {
    const [currentUser] = usePerpsActiveAccountAtom();

    const { time, delta } = update;

    // Determine display type (handle transfer direction for types with user/destination)
    const displayType = useMemo(() => {
      if (
        delta.type === 'internalTransfer' ||
        delta.type === 'subAccountTransfer' ||
        delta.type === 'spotTransfer' ||
        delta.type === 'send'
      ) {
        const isOut =
          'user' in delta &&
          currentUser?.accountAddress &&
          delta.user.toLowerCase() === currentUser.accountAddress.toLowerCase();

        if (delta.type === 'internalTransfer') {
          return isOut ? 'internalTransferOut' : 'internalTransferIn';
        }
        if (delta.type === 'subAccountTransfer') {
          return isOut ? 'subAccountTransferOut' : 'subAccountTransferIn';
        }
        if (delta.type === 'spotTransfer') {
          return isOut ? 'spotTransferOut' : 'spotTransferIn';
        }
        if (delta.type === 'send') {
          return isOut ? 'sendOut' : 'sendIn';
        }
      }
      return delta.type;
    }, [delta, currentUser?.accountAddress]);

    const typeConfig = TYPE_CONFIG.get(displayType) || {
      text: delta.type,
      icon: 'QuestionMarkCircleOutline',
      isIncrease: null,
    };

    const actionText = typeConfig.text;

    const amount = useMemo(() => {
      if (
        (delta.type === 'spotTransfer' || delta.type === 'send') &&
        'usdcValue' in delta
      ) {
        return delta.usdcValue;
      }
      if (
        delta.type === 'vaultWithdraw' &&
        'netWithdrawnUsd' in delta &&
        delta.netWithdrawnUsd
      ) {
        return delta.netWithdrawnUsd;
      }
      if (
        delta.type === 'vaultWithdraw' &&
        'requestedUsd' in delta &&
        delta.requestedUsd
      ) {
        return delta.requestedUsd;
      }
      if (delta.type === 'liquidation' && 'liquidatedNtlPos' in delta) {
        return delta.liquidatedNtlPos;
      }
      if ('usdc' in delta) {
        return delta.usdc;
      }
      if ('amount' in delta) {
        return delta.amount;
      }
      return '0';
    }, [delta]);

    const fee = useMemo(() => {
      if (delta.type === 'vaultWithdraw') {
        const commission = 'commission' in delta ? Number(delta.commission) : 0;
        const closingCost =
          'closingCost' in delta ? Number(delta.closingCost) : 0;
        const totalFee = commission + closingCost;
        return totalFee > 0 ? String(totalFee) : null;
      }
      if ('fee' in delta && delta.fee) {
        return delta.fee;
      }
      return null;
    }, [delta]);

    // Mobile: show total amount (including fee for withdrawals/transfers out)
    const totalAmount = useMemo(() => {
      if (isMobile && fee && typeConfig.isIncrease === false) {
        return new BigNumber(amount).plus(fee).toFixed();
      }
      return amount;
    }, [amount, fee, isMobile, typeConfig.isIncrease]);

    const status = 'Completed';

    const dateInfo = useMemo(() => {
      const timeDate = new Date(time);
      const date = formatTime(timeDate, {
        formatTemplate: 'yyyy-LL-dd',
      });
      const timeStr = formatTime(timeDate, {
        formatTemplate: 'HH:mm:ss',
      });
      return { date, time: timeStr };
    }, [time]);

    const iconColor = useMemo(() => {
      if (typeConfig.isIncrease === true) return '$iconSuccess';
      if (typeConfig.isIncrease === false) return '$iconCritical';
      return '$icon';
    }, [typeConfig.isIncrease]);

    const textColor = useMemo(() => {
      if (typeConfig.isIncrease === true) return '$textSuccess';
      if (typeConfig.isIncrease === false) return '$textCritical';
      return '$text';
    }, [typeConfig.isIncrease]);

    const signPrefix = useMemo(() => {
      if (typeConfig.isIncrease === true) return '+ ';
      if (typeConfig.isIncrease === false) return '- ';
      return '';
    }, [typeConfig.isIncrease]);

    if (isMobile) {
      return (
        <ListItem
          mx="$5"
          my="$2"
          p="$4"
          backgroundColor="$bgSubdued"
          flexDirection="row"
          alignItems="center"
          borderRadius="$3"
          gap="$3"
        >
          <XStack
            width="$10"
            height="$10"
            borderRadius="$full"
            backgroundColor="$bgApp"
            alignItems="center"
            justifyContent="center"
          >
            <Icon name={typeConfig.icon as any} size="$6" color={iconColor} />
          </XStack>
          <YStack flex={1} gap="$1">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyLgMedium">{actionText}</SizableText>
              <SizableText size="$bodyLgMedium" color={textColor}>
                {signPrefix}
                {numberFormat(totalAmount, balanceFormatter)}
              </SizableText>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodySm" color="$textSuccess">
                {status}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {dateInfo.date} {dateInfo.time}
              </SizableText>
            </XStack>
          </YStack>
        </ListItem>
      );
    }

    return (
      <XStack
        flex={1}
        py="$1.5"
        px="$3"
        alignItems="center"
        hoverStyle={{ bg: '$bgHover' }}
        minWidth={cellMinWidth}
        {...(index % 2 === 1 && {
          backgroundColor: '$bgSubdued',
        })}
      >
        {/* Time */}
        <YStack
          {...getColumnStyle(columnConfigs[0])}
          justifyContent="center"
          alignItems={calcCellAlign(columnConfigs[0].align)}
          pl="$2"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {dateInfo.date}
          </SizableText>
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color="$textSubdued"
          >
            {dateInfo.time}
          </SizableText>
        </YStack>

        {/* Status */}
        <XStack
          {...getColumnStyle(columnConfigs[1])}
          justifyContent={calcCellAlign(columnConfigs[1].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color="$textSuccess"
          >
            {status}
          </SizableText>
        </XStack>

        {/* Action */}
        <XStack
          {...getColumnStyle(columnConfigs[2])}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {actionText}
          </SizableText>
        </XStack>

        {/* Amount */}
        <XStack
          {...getColumnStyle(columnConfigs[3])}
          justifyContent={calcCellAlign(columnConfigs[3].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color={textColor}
          >
            {signPrefix}
            {numberFormat(amount, balanceFormatter)}
          </SizableText>
        </XStack>

        {/* Fee */}
        <XStack
          {...getColumnStyle(columnConfigs[4])}
          justifyContent={calcCellAlign(columnConfigs[4].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color={fee ? '$textCritical' : undefined}
          >
            {fee ? numberFormat(fee, balanceFormatter) : '-'}
          </SizableText>
        </XStack>
      </XStack>
    );
  },
);

AccountRow.displayName = 'AccountRow';

export { AccountRow };
