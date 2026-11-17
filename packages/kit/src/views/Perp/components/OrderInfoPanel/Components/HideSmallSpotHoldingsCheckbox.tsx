import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox } from '@onekeyhq/components';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MIN_VISIBLE_SPOT_HOLDING_VALUE_USD } from '../utils';

function HideSmallSpotHoldingsCheckbox({
  isMobile = false,
}: {
  isMobile?: boolean;
}) {
  const intl = useIntl();
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const handleChange = useCallback(
    (value: boolean | 'indeterminate') => {
      setPerpsCustomSettings((previous) => ({
        ...previous,
        hideSmallSpotHoldings: value === true,
      }));
    },
    [setPerpsCustomSettings],
  );

  return (
    <Checkbox
      testID="perp-hide-small-spot-holdings-checkbox"
      label={intl.formatMessage(
        {
          id: ETranslations.perp_holdings_hide_below_amount__action,
        },
        { amount: `$${MIN_VISIBLE_SPOT_HOLDING_VALUE_USD}` },
      )}
      labelProps={{ fontSize: isMobile ? '$bodyXs' : '$bodySm' }}
      containerProps={{
        p: '$0',
        alignItems: 'center',
        cursor: isMobile ? undefined : 'pointer',
      }}
      width="$3.5"
      height="$3.5"
      borderWidth={1.5}
      value={perpsCustomSettings.hideSmallSpotHoldings ?? false}
      onChange={handleChange}
    />
  );
}

export { HideSmallSpotHoldingsCheckbox };
