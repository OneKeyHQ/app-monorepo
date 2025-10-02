import { memo, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  DebugRenderTracker,
  Icon,
  IconButton,
  SizableText,
  Tooltip,
  XStack,
  YStack,
  useClipboard,
  useInTabDialog,
} from '@onekeyhq/components';
import { openHyperLiquidExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountMmrAtom,
  usePerpsActiveAccountSummaryAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsAccountNumberValue } from '../components/PerpsAccountNumberValue';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

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

function PerpAccountMMRView() {
  const [{ mmrPercent }] = usePerpsActiveAccountMmrAtom();
  const intl = useIntl();
  if (mmrPercent) {
    // return (
    //   <XStack justifyContent="space-between">
    //     <SizableText size="$bodySm" color="$textSubdued" cursor="default">
    //       Cross Margin Ratio
    //     </SizableText>
    //     <SizableText size="$bodySmMedium" color="$textSubdued">
    //       {mmrPercent}%
    //     </SizableText>
    //   </XStack>
    // );

    return (
      <XStack justifyContent="space-between">
        <Tooltip
          placement="top"
          renderContent={intl.formatMessage({
            id: ETranslations.perp_account_cross_margin_ration_tip,
          })}
          renderTrigger={
            <DashText
              size="$bodySm"
              color="$textSubdued"
              cursor="help"
              dashColor="$textDisabled"
              dashThickness={0.5}
            >
              {intl.formatMessage({
                id: ETranslations.perp_account_cross_margin_ration,
              })}
            </DashText>
          }
        />
        <SizableText
          size="$bodySmMedium"
          color={parseFloat(mmrPercent) <= 50 ? '$green11' : '$red11'}
        >
          {mmrPercent}%
        </SizableText>
      </XStack>
    );
  }
  return null;
}

function PerpAccountPanel() {
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const userAddress = selectedAccount.accountAddress;
  const dialogInTab = useInTabDialog();
  const intl = useIntl();
  const { copyText } = useClipboard();

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
              <DashText
                size="$bodySm"
                color="$textSubdued"
                cursor="help"
                dashColor="$textDisabled"
                dashThickness={0.5}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_value,
                })}
              </DashText>
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
        <XStack justifyContent="space-between">
          <Tooltip
            placement="top"
            renderContent={intl.formatMessage({
              id: ETranslations.perp_account_panel_account_maintenance_margin_tooltip,
            })}
            renderTrigger={
              <DashText
                size="$bodySm"
                color="$textSubdued"
                cursor="help"
                dashColor="$textDisabled"
                dashThickness={0.5}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_account_panel_account_maintenance_margin,
                })}
              </DashText>
            }
          />
          <PerpsAccountNumberValue
            value={accountSummary?.crossMaintenanceMarginUsed ?? ''}
            skeletonWidth={70}
          />
        </XStack>
        <PerpAccountMMRView />
        {userAddress ? (
          <XStack justifyContent="space-between">
            <SizableText size="$bodySm" color="$textSubdued" cursor="default">
              {intl.formatMessage({
                id: ETranslations.copy_address_modal_title,
              })}
            </SizableText>

            <XStack gap="$1" alignItems="center">
              <SizableText
                size="$bodySmMedium"
                cursor="pointer"
                onPress={() => {
                  copyText(userAddress ?? '');
                }}
              >
                {userAddress
                  ? accountUtils.shortenAddress({
                      address: userAddress,
                      leadingLength: 6,
                      trailingLength: 4,
                    })
                  : ''}
              </SizableText>
              <IconButton
                icon="OpenOutline"
                color="$iconSubdued"
                variant="tertiary"
                cursor="pointer"
                iconSize="$3.5"
                onPress={() => {
                  if (userAddress) {
                    void openHyperLiquidExplorerUrl({
                      address: userAddress,
                      openInExternal: true,
                    });
                  }
                }}
              />
            </XStack>
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
              showDepositWithdrawModal(
                {
                  actionType: 'deposit',
                  withdrawable: accountSummary?.withdrawable || '0',
                },
                dialogInTab,
              )
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
              showDepositWithdrawModal(
                {
                  actionType: 'withdraw',
                  withdrawable: accountSummary?.withdrawable || '0',
                },
                dialogInTab,
              )
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
