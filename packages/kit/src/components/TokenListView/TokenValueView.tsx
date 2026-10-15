import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { displayFiatValueOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { Currency } from '../Currency';

import { useTokenValueSlice } from './useTokenFiatField';

type IProps = {
  $key: string;
  // Row network; see TokenBalanceView.
  networkId?: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, networkId, ...rest } = props;
  // 方案B: subscribe to the value slice only ({ fiatValue, balanceParsed,
  // currency }); `has` distinguishes "no fiat" (old `!token`) from a present
  // token. Seam handled inside the hook.
  const intl = useIntl();
  const { has, fiatValue, balanceParsed, currency, balanceStatus } =
    useTokenValueSlice($key, networkId);

  // See TokenBalanceView: no fiat record means render nothing, not "-".
  if (!has) {
    return null;
  }

  // A scanned chain says why its figure is missing or still growing, in the
  // value line so the row keeps its shape.
  if (balanceStatus === 'notEnabled' || balanceStatus === 'partial') {
    const { hideValue: _hideValue, ...textProps } = rest;
    return (
      <SizableText {...textProps}>
        {intl.formatMessage({
          id:
            balanceStatus === 'notEnabled'
              ? ETranslations.privacy_balance_privacy_off__title
              : ETranslations.global_syncing,
        })}
      </SizableText>
    );
  }

  return (
    <Currency
      formatter="value"
      sourceCurrency={currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {displayFiatValueOrUnavailable(fiatValue, balanceParsed)}
    </Currency>
  );
}

export default memo(TokenValueView);
