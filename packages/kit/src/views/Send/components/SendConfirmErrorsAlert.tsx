import { useIntl } from 'react-intl';

import { Box, VStack } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import type { Token } from '@onekeyhq/engine/src/types/token';

export function SendConfirmErrorsAlert({
  nativeToken,
  isWatchingAccount,
  balanceInsufficient,
  isNetworkNotMatched,
  isAccountNotMatched,
}: {
  nativeToken?: Token;
  isWatchingAccount?: boolean;
  balanceInsufficient?: boolean;
  isNetworkNotMatched?: boolean;
  isAccountNotMatched?: boolean;
}) {
  const errors = [];
  const intl = useIntl();
  if (isAccountNotMatched) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__mismatched_account',
        })}
      />,
    );
  }
  if (isNetworkNotMatched) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'msg__mismatched_networks',
        })}
      />,
    );
  }
  if (isWatchingAccount) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'form__error_trade_with_watched_acocunt',
        })}
      />,
    );
  }
  if (balanceInsufficient) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage(
          { id: 'form__amount_invalid' },
          {
            0: nativeToken?.symbol ?? '',
          },
        )}
      />,
    );
  }
  if (!errors || !errors.length) {
    return null;
  }
  return (
    <VStack testID="SendConfirmErrorsAlert" space={2} pb={4}>
      {errors.map((err, idx) => (
        <Box key={idx}>{err}</Box>
      ))}
    </VStack>
  );
}
