import { memo, useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsSelectedAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHyperliquidAccount } from '../../../hooks';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';

function PerpAccountPanel() {
  const { userWebData2, accountSummary } = useHyperliquidAccount();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [selectedAccount] = usePerpsSelectedAccountAtom();
  const userAddress = selectedAccount.accountAddress;
  const userAccountId = selectedAccount.accountId;

  const accountDataInfo = useMemo(() => {
    const availableBalance = accountSummary.withdrawable;
    let currentPositionValue = new BigNumber(0);
    if (userWebData2) {
      currentPositionValue =
        userWebData2.clearinghouseState.assetPositions.reduce(
          (acc, curr) =>
            acc.plus(new BigNumber(curr.position.positionValue || 0)),
          new BigNumber(0),
        );
    }
    return { availableBalance, currentPositionValue };
  }, [accountSummary.withdrawable, userWebData2]);
  const intl = useIntl();
  const handleDepositOrWithdraw = useCallback(
    async (actionType: 'deposit' | 'withdraw') => {
      if (!userAccountId || !userAddress) {
        return;
      }

      const params = {
        withdrawable: accountSummary.withdrawable || '0',
        actionType,
      };

      await showDepositWithdrawModal(params);
    },
    [userAccountId, userAddress, accountSummary.withdrawable],
  );

  return (
    <YStack flex={1} gap="$1.5">
      {/* Header */}
      <XStack p="$4" justifyContent="space-between" alignItems="center">
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.perp_trade_account_overview,
          })}
        </SizableText>
      </XStack>
      <YStack flex={1} px="$4" gap="$2.5">
        {/* Available Balance */}
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_account_overview_available,
            })}
          </SizableText>
          {perpsAccountLoading || !userWebData2 ? (
            <Skeleton width={70} height={16} />
          ) : (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {accountDataInfo.availableBalance}
            </NumberSizeableText>
          )}
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_trade_current_position,
            })}
          </SizableText>
          {perpsAccountLoading || !userWebData2 ? (
            <Skeleton width={60} height={16} />
          ) : (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {accountDataInfo.currentPositionValue.toFixed()}
            </NumberSizeableText>
          )}
        </XStack>
      </YStack>
      {/* Action Buttons */}
      {userAddress ? (
        <XStack px="$4" pb="$4" gap="$2.5" mt="$3">
          <Button
            flex={1}
            size="medium"
            variant="secondary"
            onPress={() => handleDepositOrWithdraw('deposit')}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
            </SizableText>
          </Button>
          <Button
            flex={1}
            size="medium"
            variant="secondary"
            onPress={() => handleDepositOrWithdraw('withdraw')}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$bodySmMedium" textAlign="center">
              {intl.formatMessage({ id: ETranslations.perp_trade_withdraw })}
            </SizableText>
          </Button>
        </XStack>
      ) : (
        <XStack
          flex={1}
          justifyContent="flex-start"
          alignItems="center"
          mt="$3"
          px="$4"
          gap="$1.5"
        >
          <Icon name="InfoCircleOutline" size="$3.5" color="$icon" />
          <SizableText size="$bodySm" color="$text">
            {intl.formatMessage({
              id: ETranslations.perp_account_create,
            })}
          </SizableText>
        </XStack>
      )}
    </YStack>
  );
}

const PerpAccountPanelMemo = memo(PerpAccountPanel);
export { PerpAccountPanelMemo as PerpAccountPanel };
