import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DebugRenderTracker,
  IconButton,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMMR } from '../../../hooks/useMMR';
import { PerpSettingsButton } from '../../PerpSettingsButton';
import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';

export function PerpAccountDebugInfo() {
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [perpsSelectedAccount] = usePerpsActiveAccountAtom();

  if (!platformEnv.isDev) {
    return null;
  }

  return (
    <>
      <SizableText>S:{perpsSelectedAccount.accountAddress}</SizableText>
      <SizableText>W:{accountSummary?.accountAddress}</SizableText>
    </>
  );
}

function PerpAccountPanel() {
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const mmr = useMMR();
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const userAddress = selectedAccount.accountAddress;

  const intl = useIntl();

  //     if (!userWebData2) {
  //       return (
  //         <SizableText size={textSize} color="$textSubdued">
  //           N/A
  //         </SizableText>
  //       );
  //     }

  //     return (
  //       <NumberSizeableText
  //         size={textSize}
  //         formatter="value"
  //         formatterOptions={{ currency: '$' }}
  //       >
  //         {value}
  //       </NumberSizeableText>
  //     );
  //   },
  //   [perpsAccountLoading?.selectAccountLoading, userWebData2],
  // );
  // const handleDepositOrWithdraw = useCallback(
  //   async (actionType: 'deposit' | 'withdraw') => {
  //     if (!userAccountId || !userAddress) {
  //       return;
  //     }

  //     const params = {
  //       withdrawable: accountSummary.withdrawable || '0',
  //       actionType,
  //     };

  //     await showDepositWithdrawModal(params);
  //   },
  //   [userAccountId, userAddress, accountSummary.withdrawable],
  // );

  const content = (
    <YStack flex={1} gap="$4" pt="$4" px="$2.5">
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.perp_trade_account_overview,
          })}
        </SizableText>
      </XStack>
      <YStack flex={1} gap="$2.5">
        {/* Available Balance */}
        <XStack justifyContent="space-between">
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_account_panel_account_value_tooltip,
            })}
            renderTrigger={
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                cursor="default"
                borderBottomWidth="$px"
                borderTopWidth={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                borderBottomColor="$border"
                borderStyle="dashed"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_value,
                })}
              </SizableText>
            }
          />
          <PerpsAccountNumberValue
            value={accountSummary?.accountValue ?? ''}
            skeletonWidth={70}
          />
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued" cursor="default">
            {intl.formatMessage({
              id: ETranslations.perp_account_panel_withrawable_value,
            })}
          </SizableText>
          <PerpsAccountNumberValue
            value={accountSummary?.withdrawable ?? ''}
            skeletonWidth={60}
          />
        </XStack>
        {mmr ? (
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued" cursor="default">
              Cross Margin Ratio
            </SizableText>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {mmr.multipliedBy(100).toFixed(2)}%
            </SizableText>
          </XStack>
        ) : null}
        <XStack justifyContent="space-between">
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_account_panel_account_maintenance_margin_tooltip,
            })}
            renderTrigger={
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                cursor="default"
                borderBottomWidth="$px"
                borderTopWidth={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                borderBottomColor="$border"
                borderStyle="dashed"
              >
                {intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_maintenance_margin,
                })}
              </SizableText>
            }
          />
          <PerpsAccountNumberValue
            value={accountSummary?.crossMaintenanceMarginUsed ?? ''}
            skeletonWidth={70}
          />
        </XStack>
        {mmr ? (
          <XStack justifyContent="space-between">
            <Tooltip
              placement="top"
              renderContent={intl.formatMessage({
                id: ETranslations.perp_account_cross_margin_ration_tip,
              })}
              renderTrigger={
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  cursor="default"
                  borderBottomWidth="$px"
                  borderTopWidth={0}
                  borderLeftWidth={0}
                  borderRightWidth={0}
                  borderBottomColor="$border"
                  borderStyle="dashed"
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_account_cross_margin_ration,
                  })}
                </SizableText>
              }
            />

            <SizableText size="$bodySmMedium" color="$text">
              {mmr.multipliedBy(100).toFixed(2)}%
            </SizableText>
          </XStack>
        ) : null}
      </YStack>
      {/* Action Buttons */}
      {userAddress ? (
        <XStack gap="$2.5">
          <Button
            borderRadius="$3"
            flex={1}
            size="medium"
            variant="secondary"
            onPress={() =>
              showDepositWithdrawModal({
                actionType: 'deposit',
                withdrawable: accountSummary?.withdrawable || '0',
              })
            }
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
            onPress={() =>
              showDepositWithdrawModal({
                actionType: 'withdraw',
                withdrawable: accountSummary?.withdrawable || '0',
              })
            }
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
  return (
    <DebugRenderTracker name="PerpAccountPanel" position="top-right">
      {content}
    </DebugRenderTracker>
  );
}

const PerpAccountPanelMemo = memo(PerpAccountPanel);
export { PerpAccountPanelMemo as PerpAccountPanel };
