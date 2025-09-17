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
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsSelectedAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useHyperliquidAccount } from '../../../hooks';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';

export function PerpAccountDebugInfo() {
  const { currentUser } = useHyperliquidAccount();
  const [perpsSelectedAccount] = usePerpsSelectedAccountAtom();

  if (!platformEnv.isDev) {
    return null;
  }

  return (
    <>
      <SizableText>S:{perpsSelectedAccount.accountAddress}</SizableText>
      <SizableText>W:{currentUser}</SizableText>
    </>
  );
}

function PerpAccountPanel() {
  const { userWebData2, accountSummary } = useHyperliquidAccount();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [selectedAccount] = usePerpsSelectedAccountAtom();
  const userAddress = selectedAccount.accountAddress;
  const userAccountId = selectedAccount.accountId;

  const accountDataInfo = useMemo(() => {
    const withdrawableBalance = accountSummary.withdrawable;
    const accountValue = accountSummary.accountValue;
    if (userWebData2) {
      const maintenanceMargin =
        userWebData2.clearinghouseState.crossMaintenanceMarginUsed || '0';
    }
    return {
      withdrawableBalance,
      accountValue,
      maintenanceMargin: userWebData2
        ? userWebData2.clearinghouseState.crossMaintenanceMarginUsed || '0'
        : '0',
    };
  }, [accountSummary.withdrawable, userWebData2, accountSummary.accountValue]);
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
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_account_panel_account_value_tooltip,
            })}
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued" cursor="default">
                {intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_value,
                })}
              </SizableText>
            }
          />
          {perpsAccountLoading?.selectAccountLoading || !userWebData2 ? (
            <Skeleton width={70} height={16} />
          ) : (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {accountDataInfo.accountValue}
            </NumberSizeableText>
          )}
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued" cursor="default">
            {intl.formatMessage({
              id: ETranslations.perp_account_panel_withrawable_value,
            })}
          </SizableText>
          {perpsAccountLoading?.selectAccountLoading || !userWebData2 ? (
            <Skeleton width={60} height={16} />
          ) : (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {accountDataInfo.withdrawableBalance}
            </NumberSizeableText>
          )}
        </XStack>
        <XStack justifyContent="space-between">
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_account_panel_account_maintenance_margin_tooltip,
            })}
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued" cursor="default">
                {intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_maintenance_margin,
                })}
              </SizableText>
            }
          />
          {perpsAccountLoading?.selectAccountLoading || !userWebData2 ? (
            <Skeleton width={60} height={16} />
          ) : (
            <NumberSizeableText
              size="$bodySmMedium"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {accountDataInfo.maintenanceMargin}
            </NumberSizeableText>
          )}
        </XStack>
      </YStack>
      {/* Action Buttons */}
      {userAddress ? (
        <XStack px="$4" pb="$4" gap="$2.5" mt="$3">
          <Button
            borderRadius="$3"
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
            borderRadius="$3"
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
      ) : null}
    </YStack>
  );
}

const PerpAccountPanelMemo = memo(PerpAccountPanel);
export { PerpAccountPanelMemo as PerpAccountPanel };
