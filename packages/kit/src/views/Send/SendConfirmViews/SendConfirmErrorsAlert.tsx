import React from 'react';

import { useIntl } from 'react-intl';

import { Box, VStack } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import { Token } from '@onekeyhq/engine/src/types/token';

export function SendConfirmErrorsAlert({
  nativeToken,
  isWatchingAccount,
  balanceInsufficient,
}: {
  nativeToken: Token;
  isWatchingAccount: boolean;
  balanceInsufficient: boolean;
}) {
  const errors = [];
  const intl = useIntl();
  if (isWatchingAccount) {
    errors.push(
      <FormErrorMessage
        isAlertStyle
        message={intl.formatMessage({
          id: 'form__error_trade_with_watched_acocunt' as any,
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
  return (
    <VStack space={2} pb={4}>
      {errors.map((err, idx) => (
        <Box key={idx}>{err}</Box>
      ))}
    </VStack>
  );
}
