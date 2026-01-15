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

const ICON_COLOR = '$icon';

const TRANSFER_TYPES = new Set([
  'internalTransfer',
  'subAccountTransfer',
  'spotTransfer',
]);

interface IAccountRowProps {
  update: IUserNonFundingLedgerUpdate;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  isMobile?: boolean;
  index: number;
}

type ITypeConfig = {
  text: string;
  isIncrease: boolean | null;
};

type ITypeConfigRaw = {
  translationId?: ETranslations;
  text?: string;
  isIncrease: boolean | null;
};

const TYPE_CONFIG_DATA = new Map<string, ITypeConfigRaw>([
  [
    'deposit',
    {
      translationId: ETranslations.perp_trade_deposit,
      isIncrease: true,
    },
  ],
  [
    'withdraw',
    {
      translationId: ETranslations.perp_trade_withdraw,
      isIncrease: false,
    },
  ],
  [
    'internalTransferIn',
    {
      translationId: ETranslations.global_receive,
      isIncrease: true,
    },
  ],
  [
    'internalTransferOut',
    {
      translationId: ETranslations.global_send,
      isIncrease: false,
    },
  ],
  [
    'accountClassTransfer',
    {
      translationId: ETranslations.perp_account_action_tranfer,
      isIncrease: null,
    },
  ],
  [
    'rewardsClaim',
    {
      translationId: ETranslations.perp_account_action_rewards,
      isIncrease: true,
    },
  ],
  [
    'subAccountTransferIn',
    {
      translationId: ETranslations.perp_account_action_sub_transfer,
      isIncrease: true,
    },
  ],
  [
    'subAccountTransferOut',
    {
      translationId: ETranslations.perp_account_action_sub_transfer,
      isIncrease: false,
    },
  ],
  [
    'vaultDeposit',
    {
      translationId: ETranslations.perp_account_action_vault_transfer_deposit,
      isIncrease: false,
    },
  ],
  [
    'vaultWithdraw',
    {
      translationId: ETranslations.perp_account_action_vault_transfer_withdraw,
      isIncrease: true,
    },
  ],
  [
    'vaultCreate',
    {
      translationId: ETranslations.perp_account_action_vault_transfer_create,
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
    'send',
    {
      translationId: ETranslations.perp_account_action_tranfer,
      isIncrease: true,
    },
  ],
  [
    'liquidation',
    {
      translationId: ETranslations.perp_account_history_liquidation,
      isIncrease: false,
    },
  ],
]);

const getTypeConfig = (displayType: string): ITypeConfig => {
  const config = TYPE_CONFIG_DATA.get(displayType);
  if (!config) {
    return {
      text: displayType,
      isIncrease: null,
    };
  }

  return {
    text: config.translationId
      ? appLocale.intl.formatMessage({ id: config.translationId })
      : config.text || displayType,
    isIncrease: config.isIncrease,
  };
};

const getDisplayType = (
  deltaType: string,
  delta: IUserNonFundingLedgerUpdate['delta'],
  currentAddress?: string | null,
): string => {
  if (!TRANSFER_TYPES.has(deltaType)) {
    return deltaType;
  }

  const isOut =
    'user' in delta &&
    currentAddress &&
    delta.user.toLowerCase() === currentAddress.toLowerCase();

  const typeMap: Record<string, { out: string; in: string }> = {
    internalTransfer: { out: 'internalTransferOut', in: 'internalTransferIn' },
    subAccountTransfer: {
      out: 'subAccountTransferOut',
      in: 'subAccountTransferIn',
    },
    spotTransfer: { out: 'spotTransferOut', in: 'spotTransferIn' },
  };

  return isOut ? typeMap[deltaType].out : typeMap[deltaType].in;
};

const calculateAmount = (
  delta: IUserNonFundingLedgerUpdate['delta'],
  displayType: string,
): string => {
  let rawAmount = '0';

  if (delta.type === 'spotTransfer' && 'usdcValue' in delta) {
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
    (TRANSFER_TYPES.has(delta.type) || delta.type === 'deposit') &&
    displayType.endsWith('In');

  if (isRecipient && 'fee' in delta && delta.fee) {
    return new BigNumber(rawAmount).minus(delta.fee).toFixed();
  }

  return rawAmount;
};

const calculateFee = (
  delta: IUserNonFundingLedgerUpdate['delta'],
): string | null => {
  if (delta.type === 'vaultWithdraw') {
    const commission = 'commission' in delta ? Number(delta.commission) : 0;
    const closingCost = 'closingCost' in delta ? Number(delta.closingCost) : 0;
    const totalFee = commission + closingCost;
    return totalFee > 0 ? String(totalFee) : null;
  }
  if ('fee' in delta && delta.fee) {
    return delta.fee;
  }
  return null;
};

const getIconName = (isIncrease: boolean | null): string => {
  if (isIncrease === true) return 'ArrowBottomOutline';
  if (isIncrease === false) return 'ArrowTopOutline';
  return 'QuestionmarkOutline';
};

const getTextColor = (isIncrease: boolean | null): string => {
  if (isIncrease === true) return '$green11';
  if (isIncrease === false) return '$red11';
  return '$text';
};

const getSignPrefix = (isIncrease: boolean | null): string => {
  if (isIncrease === true) return '+ ';
  if (isIncrease === false) return '- ';
  return '';
};

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

    const displayType = useMemo(
      () => getDisplayType(delta.type, delta, currentUser?.accountAddress),
      [delta, currentUser?.accountAddress],
    );

    const typeConfig = useMemo(() => {
      const config = getTypeConfig(displayType);

      if (delta.type === 'accountClassTransfer' && 'toPerp' in delta) {
        return {
          ...config,
          isIncrease: delta.toPerp,
        };
      }

      return config;
    }, [displayType, delta]);

    const amount = useMemo(
      () => calculateAmount(delta, displayType),
      [delta, displayType],
    );

    const fee = useMemo(() => calculateFee(delta), [delta]);

    const totalAmount = useMemo(() => {
      if (isMobile && fee && typeConfig.isIncrease === false) {
        return new BigNumber(amount).plus(fee).toFixed();
      }
      return amount;
    }, [amount, fee, isMobile, typeConfig.isIncrease]);

    const statusInfo = useMemo(() => {
      const isPending = 'status' in delta && delta.status === 'pending';
      return {
        color: isPending ? '$yellow11' : '$green11',
        text: appLocale.intl.formatMessage({
          id: isPending
            ? ETranslations.global_pending
            : ETranslations.perp_status_comlete,
        }),
      };
    }, [delta]);

    const dateInfo = useMemo(() => {
      const timeDate = new Date(time);
      return {
        date: formatTime(timeDate, { formatTemplate: 'yyyy-LL-dd' }),
        time: formatTime(timeDate, { formatTemplate: 'HH:mm:ss' }),
      };
    }, [time]);

    const iconName = getIconName(typeConfig.isIncrease);
    const textColor = getTextColor(typeConfig.isIncrease);
    const signPrefix = getSignPrefix(typeConfig.isIncrease);

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
            <Icon name={iconName as any} size="$6" color={ICON_COLOR} />
          </XStack>
          <YStack flex={1} gap="$1">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMdMedium">{typeConfig.text}</SizableText>
              <SizableText size="$bodyMdMedium" color={textColor}>
                {signPrefix}
                {numberFormat(totalAmount, balanceFormatter)}
              </SizableText>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodySm" color={statusInfo.color}>
                {statusInfo.text}
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
            color={statusInfo.color}
          >
            {statusInfo.text}
          </SizableText>
        </XStack>

        {/* Action */}
        <XStack
          {...getColumnStyle(columnConfigs[2])}
          justifyContent={calcCellAlign(columnConfigs[2].align)}
          alignItems="center"
        >
          <SizableText numberOfLines={1} ellipsizeMode="tail" size="$bodySm">
            {typeConfig.text}
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
            color={fee && Number(fee) !== 0 ? '$red11' : undefined}
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
