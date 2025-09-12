import { memo, useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  Button,
  NumberSizeableText,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { usePerpsAccountLoadingAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';

import { useHyperliquidAccount } from '../../../hooks';
import { usePerpUseChainAccount } from '../../../hooks/usePerpUseChainAccount';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';

function PerpAccountPanel() {
  const { userWebData2, accountSummary } = useHyperliquidAccount();
  const [perpsAccountLoading] = usePerpsAccountLoadingAtom();
  const { userAddress, userAccountId, activeAccountIndexedId } =
    usePerpUseChainAccount();

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

  const handleDepositOrWithdraw = useCallback(
    (actionType: 'deposit' | 'withdraw') => {
      if (!userAccountId || !userAddress) {
        return;
      }

      const params = {
        withdrawable: accountSummary.withdrawable || '0',
        userAddress,
        userAccountId,
        actionType,
      };

      showDepositWithdrawModal(params);
    },
    [userAccountId, userAddress, accountSummary.withdrawable],
  );

  if (perpsAccountLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (!userAddress) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <SizableText size="$bodySm" color="$textSubdued" mt="$3">
          Please create an EVM address first: ____{activeAccountIndexedId}
          ____{userAccountId}
        </SizableText>
      </YStack>
    );
  }

  if (!userWebData2) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <Spinner size="large" />
        <SizableText size="$bodySm" color="$textSubdued" mt="$3">
          Loading account data...
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack flex={1} gap="$2">
      {/* Header */}
      <XStack p="$4" justifyContent="space-between" alignItems="center">
        <SizableText size="$headingXs">ACCOUNT OVERVIEW</SizableText>
      </XStack>

      <YStack flex={1} px="$4" gap="$2.5">
        {/* Available Balance */}
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            Available to Trade
          </SizableText>
          <NumberSizeableText
            size="$bodySmMedium"
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {accountDataInfo.availableBalance}
          </NumberSizeableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            Current Position
          </SizableText>
          <NumberSizeableText
            size="$bodySmMedium"
            formatter="value"
            formatterOptions={{ currency: '$' }}
          >
            {accountDataInfo.currentPositionValue.toFixed()}
          </NumberSizeableText>
        </XStack>
      </YStack>

      {/* Action Buttons */}
      <XStack px="$4" pb="$4" gap="$2.5" mt="$3">
        <Button
          flex={1}
          size="medium"
          variant="secondary"
          onPress={() => handleDepositOrWithdraw('withdraw')}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText size="$bodySmMedium">Withdraw</SizableText>
        </Button>
        <Button
          flex={1}
          size="medium"
          variant="secondary"
          onPress={() => handleDepositOrWithdraw('deposit')}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText size="$bodySmMedium">Deposit</SizableText>
        </Button>
      </XStack>
    </YStack>
  );
}

const PerpAccountPanelMemo = memo(PerpAccountPanel);
export { PerpAccountPanelMemo as PerpAccountPanel };
