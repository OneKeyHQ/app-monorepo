import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
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
const getTypeConfig = () =>
  new Map([
    [
      'deposit',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_trade_deposit,
        }),
        isIncrease: true,
      },
    ],
    [
      'withdraw',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_trade_withdraw,
        }),
        isIncrease: false,
      },
    ],
    [
      'internalTransferIn',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.global_receive,
        }),
        isIncrease: true,
      },
    ],
    [
      'internalTransferOut',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.global_send,
        }),
        isIncrease: false,
      },
    ],
    [
      'accountClassTransfer',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_tranfer,
        }),
        isIncrease: null,
      },
    ],
    [
      'rewardsClaim',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_rewards,
        }),
        isIncrease: true,
      },
    ],
    [
      'subAccountTransferIn',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_sub_transfer,
        }),
        isIncrease: true,
      },
    ],
    [
      'subAccountTransferOut',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_sub_transfer,
        }),
        isIncrease: false,
      },
    ],
    [
      'vaultDeposit',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_vault_transfer_deposit,
        }),
        isIncrease: false,
      },
    ],
    [
      'vaultWithdraw',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_vault_transfer_withdraw,
        }),
        isIncrease: true,
      },
    ],
    [
      'vaultCreate',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_action_vault_transfer_create,
        }),
        isIncrease: false,
      },
    ],
    [
      'vaultDistribution',
      {
        text: 'Vault Distribution',
        isIncrease: true,
      },
    ],
    [
      'spotTransferIn',
      {
        text: 'Spot Transfer In',
        isIncrease: true,
      },
    ],
    [
      'spotTransferOut',
      {
        text: 'Spot Transfer Out',
        isIncrease: false,
      },
    ],
    [
      'sendIn',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.global_receive,
        }),
        isIncrease: true,
      },
    ],
    [
      'sendOut',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.global_send,
        }),
        isIncrease: false,
      },
    ],
    [
      'liquidation',
      {
        text: appLocale.intl.formatMessage({
          id: ETranslations.perp_account_history_liquidation,
        }),
        isIncrease: false,
      },
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

    const typeConfig = useMemo(() => {
      const TYPE_CONFIG = getTypeConfig();
      const config = TYPE_CONFIG.get(displayType) || {
        text: delta.type,
        icon: 'QuestionMarkCircleOutline',
        isIncrease: null,
      };

      // Dynamic isIncrease for accountClassTransfer based on toPerp
      if (delta.type === 'accountClassTransfer' && 'toPerp' in delta) {
        return {
          ...config,
          isIncrease: delta.toPerp,
        };
      }

      return config;
    }, [displayType, delta]);

    const actionText = typeConfig.text;

    const amount = useMemo(() => {
      let rawAmount = '0';

      if (
        (delta.type === 'spotTransfer' || delta.type === 'send') &&
        'usdcValue' in delta
      ) {
        rawAmount = delta.usdcValue;
      } else if (
        delta.type === 'vaultWithdraw' &&
        'netWithdrawnUsd' in delta &&
        delta.netWithdrawnUsd
      ) {
        rawAmount = delta.netWithdrawnUsd;
      } else if (
        delta.type === 'vaultWithdraw' &&
        'requestedUsd' in delta &&
        delta.requestedUsd
      ) {
        rawAmount = delta.requestedUsd;
      } else if (delta.type === 'liquidation' && 'accountValue' in delta) {
        rawAmount = delta.accountValue;
      } else if ('usdc' in delta) {
        rawAmount = delta.usdc;
      } else if ('amount' in delta) {
        rawAmount = delta.amount;
      }

      const isRecipient =
        (delta.type === 'internalTransfer' ||
          delta.type === 'subAccountTransfer' ||
          delta.type === 'spotTransfer' ||
          delta.type === 'send') &&
        displayType.endsWith('In');

      if (isRecipient && 'fee' in delta && delta.fee) {
        return new BigNumber(rawAmount).minus(delta.fee).toFixed();
      }

      return rawAmount;
    }, [delta, displayType]);

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

    // Mobile: show total amount
    const totalAmount = useMemo(() => {
      if (isMobile && fee && typeConfig.isIncrease === false) {
        return new BigNumber(amount).plus(fee).toFixed();
      }
      return amount;
    }, [amount, fee, isMobile, typeConfig.isIncrease]);

    const iconName = useMemo(() => {
      if (typeConfig.isIncrease === true) return 'ArrowBottomOutline';
      if (typeConfig.isIncrease === false) return 'ArrowTopOutline';
      return 'QuestionmarkOutline';
    }, [typeConfig.isIncrease]);

    const status = appLocale.intl.formatMessage({
      id: ETranslations.perp_status_comlete,
    });

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

    const iconColor = '$icon';

    const textColor = useMemo(() => {
      if (typeConfig.isIncrease === true) return '$green11';
      if (typeConfig.isIncrease === false) return '$red11';
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
            <Icon name={iconName as any} size="$6" color={iconColor} />
          </XStack>
          <YStack flex={1} gap="$1">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMdMedium">{actionText}</SizableText>
              <SizableText size="$bodyMdMedium" color={textColor}>
                {signPrefix}
                {numberFormat(totalAmount, balanceFormatter)}
              </SizableText>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodySm" color="$green11">
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
            color="$green11"
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
            color={fee && Number(fee) !== 0 ? '$textCritical' : undefined}
          >
            {fee && Number(fee) !== 0
              ? numberFormat(fee, balanceFormatter)
              : '-'}
          </SizableText>
        </XStack>
      </XStack>
    );
  },
);

AccountRow.displayName = 'AccountRow';

export { AccountRow };
