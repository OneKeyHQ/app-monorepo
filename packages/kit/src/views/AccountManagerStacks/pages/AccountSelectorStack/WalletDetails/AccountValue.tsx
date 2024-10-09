import { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Spotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

function AccountValue(accountValue: {
  accountId: string;
  currency: string;
  value: Record<string, string> | string;
}) {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const isActiveAccount =
    activeAccountValue?.accountId === accountValue?.accountId;

  const { currency, value } = useMemo(() => {
    if (activeAccountValue && isActiveAccount) {
      return activeAccountValue;
    }
    return accountValue;
  }, [accountValue, activeAccountValue, isActiveAccount]);

  const accountValueString = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    }
    return Object.values(value).reduce(
      (acc, v) => new BigNumber(acc ?? '0').plus(v ?? '0').toFixed(),
      '0',
    );
  }, [value]);

  return (
    <Currency
      hideValue
      numberOfLines={1}
      flexShrink={1}
      size="$bodyMd"
      color="$textSubdued"
      sourceCurrency={currency}
    >
      {accountValueString}
    </Currency>
  );
}

function AccountValueWithSpotlight({
  accountValue,
  isOthersUniversal,
  index,
}: {
  accountValue:
    | {
        accountId: string;
        currency: string | undefined;
        value: Record<string, string> | string | undefined;
      }
    | undefined;
  isOthersUniversal: boolean;
  index: number;
}) {
  const isFocused = useIsFocused();
  const shouldShowSpotlight = isFocused && !isOthersUniversal && index === 0;
  const intl = useIntl();
  return (
    <Spotlight
      delayMs={300}
      containerProps={{ flexShrink: 1 }}
      isVisible={shouldShowSpotlight}
      message={intl.formatMessage({
        id: ETranslations.spotlight_enable_account_asset_message,
      })}
      tourName={ESpotlightTour.allNetworkAccountValue}
    >
      {accountValue && accountValue.currency ? (
        <AccountValue
          accountId={accountValue.accountId}
          currency={accountValue.currency}
          value={accountValue.value ?? ''}
        />
      ) : (
        <NumberSizeableTextWrapper
          formatter="value"
          hideValue
          size="$bodyMd"
          color="$textDisabled"
        >
          --
        </NumberSizeableTextWrapper>
      )}
    </Spotlight>
  );
}

export { AccountValue, AccountValueWithSpotlight };
