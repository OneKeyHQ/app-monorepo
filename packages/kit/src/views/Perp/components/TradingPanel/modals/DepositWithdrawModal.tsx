import { useCallback, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ISegmentControlProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Input,
  SegmentControl,
  SizableText,
  Skeleton,
  Toast,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { perpsSelectedAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsSelectedAccount } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAW_AMOUNT,
  USDC_TOKEN_INFO,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';

export type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

interface IDepositWithdrawParams {
  withdrawable: string;
  actionType: IPerpsDepositWithdrawActionType;
}

interface IDepositWithdrawContentProps {
  params: IDepositWithdrawParams;
  selectedAccount: IPerpsSelectedAccount;
  onClose?: () => void;
}

function DepositWithdrawContent({
  params,
  selectedAccount,
  onClose,
}: IDepositWithdrawContentProps) {
  // const [selectedAction, setSelectedAction] = useState<IActionType>(
  //   params.actionType,
  // );
  const [selectedAction, setSelectedAction] =
    useState<IPerpsDepositWithdrawActionType>(params.actionType);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinAmountError, setShowMinAmountError] = useState(false);

  const { serviceAccount } = backgroundApiProxy;
  const { result: accountResult } = usePromiseResult(async () => {
    const isOtherAccount = accountUtils.isOthersAccount({
      accountId: selectedAccount.accountId ?? '',
    });
    let indexedAccount: IDBIndexedAccount | undefined;
    let account: INetworkAccount | undefined;
    const wallet = await serviceAccount.getWalletSafe({
      walletId: accountUtils.getWalletIdFromAccountId({
        accountId: selectedAccount.accountId ?? '',
      }),
    });
    if (isOtherAccount && selectedAccount.accountId) {
      account = await serviceAccount.getAccount({
        accountId: selectedAccount.accountId,
        networkId: PERPS_NETWORK_ID,
      });
    } else if (selectedAccount.indexedAccountId) {
      indexedAccount = await serviceAccount.getIndexedAccount({
        id: selectedAccount.indexedAccountId,
      });
    }

    console.log('accountResult--', {
      wallet,
      account,
      indexedAccount,
      isOtherAccount,
    });

    return {
      wallet,
      account,
      indexedAccount,
      isOtherAccount,
    };
  }, [
    selectedAccount.indexedAccountId,
    selectedAccount.accountId,
    serviceAccount,
  ]);

  const { normalizeTxConfirm } = useSignatureConfirm({
    accountId: selectedAccount.accountId || '',
    networkId: PERPS_NETWORK_ID,
  });

  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;

  const { result: usdcBalance, isLoading: balanceLoading } = usePromiseResult(
    async () => {
      if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
        return '0';
      }

      try {
        const tokenDetails =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: PERPS_NETWORK_ID,
            contractAddress: USDC_TOKEN_INFO.address,
            accountId: selectedAccount.accountId,
            accountAddress: selectedAccount.accountAddress,
          });
        return tokenDetails?.[0]?.balanceParsed || '0';
      } catch (error) {
        console.error(
          '[DepositWithdrawModal] Failed to fetch USDC balance:',
          error,
        );
        return '0';
      }
    },
    [selectedAccount.accountId, selectedAccount.accountAddress],
    {
      checkIsMounted: true,
      debounced: 1000,
    },
  );
  const availableBalance = useMemo(() => {
    if (selectedAction === 'withdraw') {
      return new BigNumber(params.withdrawable || '0').toFixed(2);
    }
    return new BigNumber(usdcBalance || '0').toFixed(2);
  }, [selectedAction, params.withdrawable, usdcBalance]);
  const isValidAmount = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');

    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    if (selectedAction === 'deposit') {
      return (
        amountBN.lte(balanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_DEPOSIT_AMOUNT))
      );
    }

    if (selectedAction === 'withdraw') {
      return (
        amountBN.lte(balanceBN) &&
        (!showMinAmountError || amountBN.gte(MIN_WITHDRAW_AMOUNT))
      );
    }

    return true;
  }, [amount, availableBalance, selectedAction, showMinAmountError]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    const amountBN = new BigNumber(amount || '0');
    if (amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinAmountError && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
        return `Minimum deposit is ${MIN_DEPOSIT_AMOUNT} USDC`;
      }
    }

    if (selectedAction === 'withdraw') {
      if (showMinAmountError && amountBN.lt(MIN_WITHDRAW_AMOUNT)) {
        return `Minimum withdraw is ${MIN_WITHDRAW_AMOUNT} USDC`;
      }
    }

    return '';
  }, [amount, selectedAction, showMinAmountError]);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setAmount(value);
        // Clear minimum amount error when user changes amount
        if (showMinAmountError) {
          setShowMinAmountError(false);
        }
      }
    },
    [showMinAmountError],
  );

  const handleAmountBlur = useCallback(() => {
    if (amount) {
      const amountBN = new BigNumber(amount);
      if (!amountBN.isNaN() && amountBN.gt(0)) {
        if (selectedAction === 'deposit' && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
          setShowMinAmountError(true);
        } else if (
          selectedAction === 'withdraw' &&
          amountBN.lt(MIN_WITHDRAW_AMOUNT)
        ) {
          setShowMinAmountError(true);
        }
      }
    }
  }, [selectedAction, amount]);

  const handleMaxPress = useCallback(() => {
    if (availableBalance) {
      setAmount(availableBalance);
    }
  }, [availableBalance]);

  const handleConfirm = useCallback(async () => {
    if (!isValidAmount || !selectedAccount.accountAddress) return;

    try {
      setIsSubmitting(true);

      if (selectedAction === 'deposit') {
        await normalizeTxConfirm({
          onSuccess: () => {
            // TODO wait tx confirmed then check account status
            void backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
          },
          transfersInfo: [
            {
              from: selectedAccount.accountAddress,
              to: HYPERLIQUID_DEPOSIT_ADDRESS,
              amount,
              tokenInfo: USDC_TOKEN_INFO,
            },
          ],
        });

        Toast.success({
          title: 'Deposit Initiated',
          message: `${amount} USDC deposit transaction has been submitted`,
        });

        onClose?.();
      } else {
        await withdraw({
          userAccountId: selectedAccount.accountId || '',
          amount,
          destination: selectedAccount.accountAddress,
        });

        onClose?.();
      }
    } catch (error) {
      console.error(`[DepositWithdrawModal.${selectedAction}] Failed:`, error);
      Toast.error({
        title: `${
          selectedAction === 'deposit' ? 'Deposit' : 'Withdraw'
        } Failed`,
        message: error instanceof Error ? error.message : 'Transaction failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidAmount,
    selectedAccount.accountAddress,
    selectedAccount.accountId,
    selectedAction,
    amount,
    normalizeTxConfirm,
    onClose,
    withdraw,
  ]);

  const isInsufficientBalance = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');
    return amountBN.gt(balanceBN) && amountBN.gt(0);
  }, [amount, availableBalance]);
  const intl = useIntl();
  const buttonText = useMemo(() => {
    if (isInsufficientBalance)
      return intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    return selectedAction === 'deposit'
      ? intl.formatMessage({ id: ETranslations.perp_trade_deposit })
      : intl.formatMessage({ id: ETranslations.perp_trade_withdraw });
  }, [isInsufficientBalance, selectedAction, intl]);

  return (
    <YStack
      gap="$4"
      p="$1"
      style={{
        marginTop: -22,
      }}
    >
      <XStack alignItems="center" gap="$2" pb="$3">
        <AccountAvatar
          size="small"
          account={
            accountResult?.isOtherAccount ? accountResult?.account : undefined
          }
          indexedAccount={
            accountResult?.isOtherAccount
              ? undefined
              : accountResult?.indexedAccount
          }
          wallet={accountResult?.wallet}
        />
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
          {accountResult?.isOtherAccount
            ? accountResult?.account?.name
            : accountResult?.indexedAccount?.name}
        </SizableText>
      </XStack>
      <SegmentControl
        height={38}
        segmentControlItemStyleProps={{
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
        }}
        value={selectedAction}
        onChange={setSelectedAction as ISegmentControlProps['onChange']}
        options={[
          {
            label: intl.formatMessage({
              id: ETranslations.perp_trade_deposit,
            }),
            value: 'deposit',
          },
          {
            label: intl.formatMessage({
              id: ETranslations.perp_trade_withdraw,
            }),
            value: 'withdraw',
          },
        ]}
      />
      <XStack
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$3"
        px="$3"
        bg="$bgSubdued"
        alignItems="center"
        gap="$3"
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {selectedAction === 'withdraw'
            ? intl.formatMessage({ id: ETranslations.perp_withdraw_chain })
            : intl.formatMessage({ id: ETranslations.perp_deposit_chain })}
        </SizableText>
        <Input
          flex={1}
          value="Arbitrum One"
          onChangeText={() => {}}
          keyboardType="default"
          readonly
          borderWidth={0}
          size="medium"
          fontSize={getFontSize('$bodyMd')}
          containerProps={{
            flex: 1,
            borderWidth: 0,
            bg: 'transparent',
            p: 0,
          }}
          InputComponentStyle={{
            p: 0,
            bg: 'transparent',
            justifyContent: 'flex-end',
          }}
          alignContent="flex-end"
          textAlign="right"
        />
      </XStack>

      <YStack gap="$2">
        <XStack
          borderWidth="$px"
          borderColor={errorMessage ? '$red7' : '$borderSubdued'}
          borderRadius="$3"
          px="$3"
          bg="$bgSubdued"
          alignItems="center"
          gap="$3"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.send_nft_amount })}
          </SizableText>
          <Input
            alignItems="center"
            flex={1}
            placeholder={intl.formatMessage({
              id: ETranslations.form_amount_placeholder,
            })}
            value={amount}
            onChangeText={handleAmountChange}
            onBlur={handleAmountBlur}
            keyboardType="decimal-pad"
            disabled={isSubmitting}
            borderWidth={0}
            size="medium"
            fontSize={getFontSize('$bodyMd')}
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: 'transparent',
              p: 0,
            }}
            InputComponentStyle={{
              p: 0,
              bg: 'transparent',
              justifyContent: 'flex-end',
            }}
            textAlign="right"
            maxLength={12}
          />
          <XStack alignItems="center">
            <SizableText size="$bodyMd">USDC</SizableText>
          </XStack>
        </XStack>

        {errorMessage ? (
          <SizableText size="$bodySm" color="$red10">
            {errorMessage}
          </SizableText>
        ) : null}
      </YStack>
      {/* Available Balance & You Will Get */}
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {selectedAction === 'withdraw'
              ? intl.formatMessage({
                  id: ETranslations.perp_trade_withdrawable,
                })
              : intl.formatMessage({
                  id: ETranslations.perp_available_balance,
                })}
          </SizableText>
          <XStack alignItems="center" gap="$1">
            {balanceLoading ? (
              <Skeleton w={80} h={14} />
            ) : (
              <SizableText
                cursor="pointer"
                onPress={handleMaxPress}
                color="$text"
                size="$bodyMd"
              >
                {availableBalance || '0.00'}{' '}
                <SizableText size="$bodyMd" color="$green11">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_custom_filters_max,
                  })}
                </SizableText>
              </SizableText>
            )}
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.perp_you_will_get })}
          </SizableText>
          <SizableText color="$text" size="$bodyMd">
            ${amount || '0'} on{' '}
            {selectedAction === 'deposit' ? 'Hyperliquid' : 'Arbitrum One'}
          </SizableText>
        </XStack>
      </YStack>

      <Button
        variant="primary"
        size="medium"
        disabled={!isValidAmount || isSubmitting || balanceLoading}
        loading={isSubmitting}
        onPress={handleConfirm}
      >
        {buttonText}
      </Button>
    </YStack>
  );
}

export async function showDepositWithdrawModal(params: IDepositWithdrawParams) {
  const selectedAccount = await perpsSelectedAccountAtom.get();
  if (!selectedAccount.accountId || !selectedAccount.accountAddress) {
    console.error('[DepositWithdrawModal] Missing required parameters');
  }

  const dialogInstance = Dialog.show({
    renderContent: (
      <PerpsProviderMirror>
        <DepositWithdrawContent
          params={params}
          selectedAccount={selectedAccount}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
