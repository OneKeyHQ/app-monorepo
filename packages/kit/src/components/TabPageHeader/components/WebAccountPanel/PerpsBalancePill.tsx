import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Spinner, XStack } from '@onekeyhq/components';
import { PerpsAccountNumberValue } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/components/PerpsAccountNumberValue';
import { useShowDepositWithdrawModal } from '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal';
import { useShowPortfolio } from '@onekeyhq/kit/src/views/Perp/hooks/useShowPortfolio';
import {
  usePerpsActiveAccountAtom,
  usePerpsComputedAccountValueAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { GestureResponderEvent } from 'react-native';

export function PerpsBalancePill({ userAddress }: { userAddress?: string }) {
  const intl = useIntl();
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const { showPortfolio } = useShowPortfolio();
  const { showDepositWithdrawModal, isDepositDisabled } =
    useShowDepositWithdrawModal();

  const isForThisAccount =
    !!userAddress &&
    perpsActiveAccount?.accountAddress?.toLowerCase() ===
      userAddress.toLowerCase();
  const accountValue = isForThisAccount
    ? computedValue?.accountValue
    : undefined;
  const isLoading = isForThisAccount ? computedValue?.isLoading : false;

  if (accountValue === undefined) {
    if (isLoading) {
      return (
        <XStack ai="center" jc="center" px="$2" h={26}>
          <Spinner size="small" />
        </XStack>
      );
    }
    return null;
  }

  const isEmptyAccount = new BigNumber(accountValue).lte(0);

  const handlePress = (e: GestureResponderEvent) => {
    e.stopPropagation();
    if (isEmptyAccount) {
      if (isDepositDisabled) {
        return;
      }
      void showDepositWithdrawModal('deposit');
    } else {
      void showPortfolio();
    }
  };

  return (
    <XStack
      ai="center"
      jc="center"
      gap="$1"
      px="$2"
      h={26}
      borderRadius="$full"
      bg={isEmptyAccount ? '$brand9' : '$neutral4'}
      onPress={handlePress}
      cursor={isEmptyAccount && isDepositDisabled ? 'default' : 'pointer'}
      opacity={isEmptyAccount && isDepositDisabled ? 0.5 : 1}
      hoverStyle={{ opacity: 0.85 }}
      pressStyle={{ opacity: 0.7 }}
      testID="web-account-selector-perps-pill"
    >
      {isEmptyAccount ? (
        <SizableText size="$bodyLgMedium" color="$textOnColor">
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </SizableText>
      ) : (
        <PerpsAccountNumberValue
          value={accountValue}
          textSize="$bodyLgMedium"
        />
      )}
    </XStack>
  );
}
