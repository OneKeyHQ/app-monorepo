import { useCallback, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';

import type { ISegmentControlProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Input,
  NumberSizeableText,
  SegmentControl,
  SizableText,
  Skeleton,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/actions';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HYPERLIQUID_DEPOSIT_ADDRESS,
  MIN_DEPOSIT_AMOUNT,
  USDC_TOKEN_INFO,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';

type IActionType = 'deposit' | 'withdraw';

interface IDepositWithdrawParams {
  withdrawable: string;
  userAddress: string;
  userAccountId: string;
  actionType: IActionType;
}

interface IDepositWithdrawContentProps {
  params: IDepositWithdrawParams;
  onClose?: () => void;
}

function DepositWithdrawContent({
  params,
  onClose,
}: IDepositWithdrawContentProps) {
  const [selectedAction, setSelectedAction] = useState<IActionType>(
    params.actionType,
  );
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinDepositError, setShowMinDepositError] = useState(false);

  const { normalizeTxConfirm } = useSignatureConfirm({
    networkId: 'evm--42161',
    accountId: params.userAccountId,
  });

  const hyperliquidActions = useHyperliquidActions();
  const { withdraw } = hyperliquidActions.current;

  const { result: usdcBalance, isLoading: balanceLoading } =
    usePromiseResult(async () => {
      if (!params.userAccountId || !params.userAddress) {
        return '0';
      }

      try {
        const tokenDetails =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: 'evm--42161',
            contractAddress: USDC_TOKEN_INFO.address,
            accountId: params.userAccountId,
            accountAddress: params.userAddress,
          });
        return tokenDetails?.[0]?.balanceParsed || '0';
      } catch (error) {
        console.error(
          '[DepositWithdrawModal] Failed to fetch USDC balance:',
          error,
        );
        return '0';
      }
    }, [params.userAccountId, params.userAddress]);
  const availableBalance = useMemo(() => {
    if (selectedAction === 'withdraw') {
      return params.withdrawable;
    }
    return usdcBalance;
  }, [selectedAction, params.withdrawable, usdcBalance]);
  const isValidAmount = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');

    if (amountBN.isNaN() || amountBN.lte(0)) return false;

    if (selectedAction === 'deposit') {
      return (
        amountBN.lte(balanceBN) &&
        (!showMinDepositError || amountBN.gte(MIN_DEPOSIT_AMOUNT))
      );
    }

    if (selectedAction === 'withdraw') {
      return amountBN.lte(balanceBN);
    }

    return true;
  }, [amount, availableBalance, selectedAction, showMinDepositError]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    const amountBN = new BigNumber(amount || '0');
    if (amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinDepositError && amountBN.lt(MIN_DEPOSIT_AMOUNT)) {
        return `Minimum deposit is ${MIN_DEPOSIT_AMOUNT} USDC`;
      }
    }

    return '';
  }, [amount, selectedAction, showMinDepositError]);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setAmount(value);
        // Clear minimum deposit error when user changes amount
        if (showMinDepositError) {
          setShowMinDepositError(false);
        }
      }
    },
    [showMinDepositError],
  );

  const handleMaxPress = useCallback(() => {
    if (availableBalance) {
      setAmount(availableBalance);
    }
  }, [availableBalance]);

  const handleConfirm = useCallback(async () => {
    if (!isValidAmount || !params.userAddress) return;

    // Check minimum deposit amount on submit
    if (
      selectedAction === 'deposit' &&
      new BigNumber(amount).lt(MIN_DEPOSIT_AMOUNT)
    ) {
      setShowMinDepositError(true);
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedAction === 'deposit') {
        await normalizeTxConfirm({
          transfersInfo: [
            {
              from: params.userAddress,
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
          userAccountId: params.userAccountId,
          amount,
          destination: params.userAddress as `0x${string}`,
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
    params.userAddress,
    amount,
    selectedAction,
    normalizeTxConfirm,
    withdraw,
    params.userAccountId,
    onClose,
  ]);

  const isInsufficientBalance = useMemo(() => {
    const amountBN = new BigNumber(amount || '0');
    const balanceBN = new BigNumber(availableBalance || '0');
    return amountBN.gt(balanceBN) && amountBN.gt(0);
  }, [amount, availableBalance]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return `${
        selectedAction === 'deposit' ? 'Depositing' : 'Withdrawing'
      }...`;
    }
    if (isInsufficientBalance) return 'Insufficient balance';
    return selectedAction === 'deposit' ? 'Deposit' : 'Withdraw';
  }, [isSubmitting, isInsufficientBalance, selectedAction]);

  return (
    <YStack
      gap="$4"
      p="$1"
      style={{
        marginTop: -22,
      }}
    >
      {/* Tab Switch */}
      <SegmentControl
        value={selectedAction}
        onChange={setSelectedAction as ISegmentControlProps['onChange']}
        options={[
          { label: 'Deposit', value: 'deposit' },
          { label: 'Withdraw', value: 'withdraw' },
        ]}
      />
      {/* Chain and Token Info */}
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {selectedAction === 'deposit' ? 'Deposit Chain' : 'Withdraw Chain'}
          </SizableText>
          <Badge size="small" variant="gray">
            Arbitrum One
          </Badge>
        </XStack>
      </YStack>

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
            Pay
          </SizableText>
          <Input
            flex={1}
            placeholder="0"
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            disabled={isSubmitting}
            borderWidth={0}
            size="medium"
            fontSize="$bodyLg"
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: 'transparent',
              p: 0,
            }}
            InputComponentStyle={{
              p: 0,
              bg: 'transparent',
            }}
            alignContent="flex-end"
          />
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              USDC
            </SizableText>
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
          <SizableText size="$bodySm" color="$textSubdued">
            {selectedAction === 'withdraw'
              ? 'Withdrawable'
              : 'Available balance'}
          </SizableText>
          <XStack alignItems="center" gap="$1">
            {balanceLoading ? (
              <Skeleton w={80} h={14} />
            ) : (
              <NumberSizeableText
                onPress={handleMaxPress}
                color="$textSubdued"
                size="$bodySm"
                fontWeight="500"
                formatter="balance"
                formatterOptions={{
                  tokenSymbol: selectedAction === 'withdraw' ? 'USD' : 'USDC',
                }}
              >
                {availableBalance || '0'}
              </NumberSizeableText>
            )}
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            You will get
          </SizableText>
          <SizableText color="$textSubdued" size="$bodySm" fontWeight="500">
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

export function showDepositWithdrawModal(params: IDepositWithdrawParams) {
  if (!params.userAccountId || !params.userAddress) {
    console.error('[DepositWithdrawModal] Missing required parameters');
    return;
  }

  const dialogInstance = Dialog.show({
    renderContent: (
      <PerpsProviderMirror storeName={EJotaiContextStoreNames.perps}>
        <DepositWithdrawContent
          params={params}
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
