import { memo, useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
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

import type { FontSizeTokens } from 'tamagui';

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

function PerpAccountPanel({ ifOnHeader }: { ifOnHeader: boolean }) {
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
  const renderAccountValue = useCallback(
    (
      value: string,
      skeletonWidth = 60,
      textSize = '$bodySmMedium' as FontSizeTokens,
    ) => {
      if (perpsAccountLoading?.selectAccountLoading) {
        return <Skeleton width={skeletonWidth} height={16} />;
      }

      if (!userWebData2) {
        return (
          <SizableText size={textSize} color="$textSubdued">
            N/A
          </SizableText>
        );
      }

      return (
        <NumberSizeableText
          size={textSize}
          formatter="value"
          formatterOptions={{ currency: '$' }}
        >
          {value}
        </NumberSizeableText>
      );
    },
    [perpsAccountLoading?.selectAccountLoading, userWebData2],
  );
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
  if (ifOnHeader) {
    return (
      <Button
        borderRadius="$full"
        size="medium"
        variant="secondary"
        onPress={() => handleDepositOrWithdraw('deposit')}
        alignItems="center"
        justifyContent="center"
        h={32}
      >
        <XStack gap="$3" alignItems="center" justifyContent="center">
          <Icon name="WalletOutline" size="$4.5" />
          {renderAccountValue(
            accountDataInfo.accountValue ?? '',
            60,
            '$bodyMdMedium',
          )}
          <Divider
            borderWidth={0.33}
            borderBottomWidth={12}
            borderColor="$borderSubdued"
          />
          <SizableText size="$bodyMdMedium" color="$text">
            {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
          </SizableText>
        </XStack>
      </Button>
    );
  }
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
          {renderAccountValue(accountDataInfo.accountValue ?? '', 70)}
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued" cursor="default">
            {intl.formatMessage({
              id: ETranslations.perp_account_panel_withrawable_value,
            })}
          </SizableText>
          {renderAccountValue(accountDataInfo.withdrawableBalance ?? '', 60)}
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
          {renderAccountValue(accountDataInfo.maintenanceMargin, 70)}
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
