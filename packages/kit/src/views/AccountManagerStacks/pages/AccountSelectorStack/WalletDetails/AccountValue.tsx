import { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Spotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';

function AccountValue(accountValue: {
  accountId: string;
  currency: string;
  value: string;
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

  return (
    <Currency
      hideValue
      numberOfLines={1}
      flexShrink={1}
      size="$bodyMd"
      color="$textSubdued"
      sourceCurrency={currency}
    >
      {value}
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
        value: string | undefined;
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
