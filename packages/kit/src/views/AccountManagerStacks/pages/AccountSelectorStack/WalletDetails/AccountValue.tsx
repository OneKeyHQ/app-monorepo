import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Spotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

function AccountValue(accountValue: {
  showSpotlight?: boolean;
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
  const intl = useIntl();

  return (
    <Spotlight
      isVisible={accountValue?.showSpotlight}
      message={intl.formatMessage({
        id: ETranslations.spotlight_enable_account_asset_message,
      })}
      tourName={ESpotlightTour.allNetworkAccountValue}
    >
      <Currency
        numberOfLines={1}
        flexShrink={1}
        size="$bodyMd"
        color="$textSubdued"
        sourceCurrency={currency}
      >
        {value}
      </Currency>
    </Spotlight>
  );
}

export { AccountValue };
