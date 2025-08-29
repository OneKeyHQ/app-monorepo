import { useCallback, useMemo, useState, useEffect } from 'react';

import {
  YStack,
  XStack,
  SizableText,
  Input,
  Button,
  Dialog,
  Toast,
  Badge,
  Spinner,
  NumberSizeableText,
  SegmentControl,
  ISegmentControlProps,
  Skeleton,
} from '@onekeyhq/components';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '../../../../hooks/useSignatureConfirm';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';

const USDC_TOKEN_INFO = {
  address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC',
  isNative: false,
};

const HYPERLIQUID_DEPOSIT_ADDRESS = '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7';
const MIN_DEPOSIT_AMOUNT = 5;

type ActionType = 'deposit' | 'withdraw';

interface IDepositWithdrawContentProps {
  activeAccount: any;
  onClose?: () => void;
}

function DepositWithdrawContent({ activeAccount, onClose }: IDepositWithdrawContentProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>('deposit');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMinDepositError, setShowMinDepositError] = useState(false);

  const { normalizeTxConfirm } = useSignatureConfirm({
    networkId: 'evm--42161',
    accountId: activeAccount!.account!.id,
  });

  const { result: usdcBalance, isLoading: balanceLoading } = usePromiseResult(async () => {
    if (!activeAccount?.account?.id || !activeAccount?.account?.address) {
      return '0';
    }

    try {
      const tokenDetails = await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: 'evm--42161',
        contractAddress: USDC_TOKEN_INFO.address,
        accountId: activeAccount.account.id,
        accountAddress: activeAccount.account.address,
      });

      return tokenDetails?.[0]?.balanceParsed || '0';
    } catch (error) {
      console.error('[DepositWithdrawModal] Failed to fetch USDC balance:', error);
      return '0';
    }
  }, [activeAccount?.account?.id, activeAccount?.account?.address]);

  const numAmount = parseFloat(amount || '0');
  const numBalance = parseFloat(usdcBalance || '0');

  const isValidAmount = useMemo(() => {
    if (isNaN(numAmount) || numAmount <= 0) return false;

    if (selectedAction === 'deposit') {
      return numAmount <= numBalance && (!showMinDepositError || numAmount >= MIN_DEPOSIT_AMOUNT);
    }

    return true;
  }, [numAmount, selectedAction, numBalance, showMinDepositError]);

  const errorMessage = useMemo(() => {
    if (!amount) return '';

    if (isNaN(numAmount) || numAmount <= 0) {
      return '';
    }

    if (selectedAction === 'deposit') {
      if (showMinDepositError && numAmount < MIN_DEPOSIT_AMOUNT) {
        return `Minimum deposit is ${MIN_DEPOSIT_AMOUNT} USDC`;
      }
    }

    return '';
  }, [amount, numAmount, selectedAction, numBalance, showMinDepositError]);

  const handleAmountChange = useCallback((value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      // Clear minimum deposit error when user changes amount
      if (showMinDepositError) {
        setShowMinDepositError(false);
      }
    }
  }, [showMinDepositError]);

  const handleMaxPress = useCallback(() => {
    if (selectedAction === 'deposit' && usdcBalance) {
      setAmount(usdcBalance);
    }
  }, [selectedAction, usdcBalance]);

  const handleConfirm = useCallback(async () => {
    if (!isValidAmount || !activeAccount?.account?.address) return;

    // Check minimum deposit amount on submit
    if (selectedAction === 'deposit' && numAmount < MIN_DEPOSIT_AMOUNT) {
      setShowMinDepositError(true);
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedAction === 'deposit') {
        await normalizeTxConfirm({
          transfersInfo: [
            {
              from: activeAccount.account.address,
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
        Toast.message({
          title: 'Withdraw Coming Soon',
          message: 'Withdraw functionality will be available soon',
        });
      }
    } catch (error) {
      console.error(`[DepositWithdrawModal.${selectedAction}] Failed:`, error);
      Toast.error({
        title: `${selectedAction === 'deposit' ? 'Deposit' : 'Withdraw'} Failed`,
        message: error instanceof Error ? error.message : 'Transaction failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isValidAmount, activeAccount, amount, selectedAction, normalizeTxConfirm, onClose]);

  const isInsufficientBalance = selectedAction === 'deposit' && numAmount > numBalance && numAmount > 0;

  return (
    <YStack gap="$4" p="$1" style={{
      marginTop: -22
    }}>
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
            alignContent='flex-end'
          />
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              USDC
            </SizableText>
          </XStack>
        </XStack>

        {errorMessage && (
          <SizableText size="$bodySm" color="$red10">
            {errorMessage}
          </SizableText>
        )}
      </YStack>
      {/* Available Balance & You Will Get */}
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            Available balance
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
                formatterOptions={{ tokenSymbol: 'USDC' }}
              >
                {usdcBalance || '0'}
              </NumberSizeableText>
            )}
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodySm" color="$textSubdued">
            You will get
          </SizableText>
          <SizableText color="$textSubdued" size="$bodySm" fontWeight="500">
            ${amount || '0'} on {selectedAction === 'deposit' ? 'Hyperliquid' : 'Arbitrum One'}
          </SizableText>
        </XStack>
      </YStack>

      {/* Submit Button */}
      <Button
        size="medium"
        disabled={!isValidAmount || isSubmitting || balanceLoading}
        onPress={handleConfirm}
        backgroundColor={
          isInsufficientBalance ? '$neutral7' :
            (!isValidAmount || isSubmitting || balanceLoading) ? '$neutral7' :
              selectedAction === 'deposit' ? '$green9' : '$blue9'
        }
      >
        <SizableText color={isInsufficientBalance ? "$blackA10" : "$white"} fontWeight="600">
          {isSubmitting ? (
            `${selectedAction === 'deposit' ? 'Depositing' : 'Withdrawing'}...`
          ) : isInsufficientBalance ? (
            'Insufficient balance'
          ) : (
            selectedAction === 'deposit' ? 'Deposit' : 'Withdraw'
          )}
        </SizableText>
      </Button>
    </YStack>
  );
}

export function showDepositWithdrawModal(activeAccount: any) {
  if (!activeAccount?.account?.id) {
    console.error('[DepositWithdrawModal] No active account available');
    return;
  }

  let dialogInstance: any;

  const handleClose = () => {
    dialogInstance?.close();
  };

  dialogInstance = Dialog.show({
    // title: 'Account 1',
    renderContent: (
      <DepositWithdrawContent
        activeAccount={activeAccount}
        onClose={handleClose}
      />
    ),
    showFooter: false,
    onClose: handleClose,
  });

  return dialogInstance;
}