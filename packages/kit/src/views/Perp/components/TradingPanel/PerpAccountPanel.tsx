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
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsSelectedAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useHyperliquidAccount } from '../../hooks/useHyperliquid';

import { showDepositWithdrawModal } from './modals/DepositWithdrawModal';

import type { IPerpsDepositWithdrawActionType } from './modals/DepositWithdrawModal';

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
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { userWebData2, accountSummary, currentUser } = useHyperliquidAccount();
  const [perpsSelectedAccount] = usePerpsSelectedAccountAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();

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
    async (actionType: IPerpsDepositWithdrawActionType) => {
      if (!activeAccount?.account?.id || !activeAccount?.account?.address) {
        return;
      }

      await showDepositWithdrawModal({
        withdrawable: accountDataInfo.availableBalance || '0',
        actionType,
      });
    },
    [activeAccount, accountDataInfo.availableBalance],
  );

  if (perpsAccountLoading?.selectAccountLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (!perpsSelectedAccount?.accountAddress) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
        <SizableText size="$bodySm" color="$textSubdued" mt="$3">
          Please create an EVM address first: ____
          {perpsSelectedAccount?.indexedAccountId}
          ____{perpsSelectedAccount?.accountId}
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
    <YStack flex={1} gap="$3">
      {/* Header */}
      <XStack p="$4" justifyContent="space-between" alignItems="center">
        <SizableText size="$headingLg" fontWeight="600">
          ACCOUNT OVERVIEW
        </SizableText>
      </XStack>

      <YStack flex={1} px="$4">
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            Account Address
          </SizableText>
          <SizableText size="$bodyMd">
            {accountUtils.shortenAddress({
              address: perpsSelectedAccount?.accountAddress,
            })}
          </SizableText>
        </XStack>

        {/* Available Balance */}
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            Available to Trade
          </SizableText>
          <NumberSizeableText
            size="$bodyMd"
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {accountDataInfo.availableBalance}
          </NumberSizeableText>
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            Current Position
          </SizableText>
          <NumberSizeableText
            size="$bodyMd"
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {accountDataInfo.currentPositionValue.toFixed()}
          </NumberSizeableText>
        </XStack>
      </YStack>

      {/* Action Buttons */}
      <XStack px="$4" pb="$4" space="$2" mt="$4">
        <Button
          flex={1}
          size="medium"
          variant="secondary"
          onPress={() => handleDepositOrWithdraw('withdraw')}
        >
          <SizableText size="$bodySm">Withdraw</SizableText>
        </Button>
        <Button
          flex={1}
          size="medium"
          variant="secondary"
          onPress={() => handleDepositOrWithdraw('deposit')}
        >
          <SizableText size="$bodySm">Deposit</SizableText>
        </Button>
      </XStack>
    </YStack>
  );
}

const PerpAccountPanelMemo = memo(PerpAccountPanel);
export { PerpAccountPanelMemo as PerpAccountPanel };
