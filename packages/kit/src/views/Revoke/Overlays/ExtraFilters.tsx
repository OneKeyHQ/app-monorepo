import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, VStack } from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../../Overlay/AccountValueSettings';

type Props = {
  includeUnverifiedTokens: boolean;
  includeZeroBalancesTokens: boolean;
  onChange: (
    filter: Pick<
      Props,
      'includeZeroBalancesTokens' | 'includeUnverifiedTokens'
    >,
  ) => void;
};

const ExtraFilters: FC<Props> = (props) => {
  const intl = useIntl();
  const { includeZeroBalancesTokens, includeUnverifiedTokens, onChange } =
    props;
  const [zeroBalancesSwitchValue, setZeroBalancesSwitchValue] = useState(
    includeZeroBalancesTokens,
  );
  const [unverifiedTokensSwitchValue, setUnverifiedTokensSwitchValue] =
    useState(includeUnverifiedTokens);

  useEffect(() => {
    onChange({
      includeUnverifiedTokens: unverifiedTokensSwitchValue,
      includeZeroBalancesTokens: zeroBalancesSwitchValue,
    });
  }, [zeroBalancesSwitchValue, unverifiedTokensSwitchValue, onChange]);

  return (
    <VStack>
      <Switch
        isChecked={unverifiedTokensSwitchValue}
        label={intl.formatMessage({
          id: 'form__include_unverified_tokens',
        })}
        isFullMode
        onToggle={() =>
          setUnverifiedTokensSwitchValue(!unverifiedTokensSwitchValue)
        }
      />
      <Box h="6" />
      <Switch
        isChecked={zeroBalancesSwitchValue}
        label={intl.formatMessage({ id: 'form__include_zero_balances' })}
        isFullMode
        onToggle={() => setZeroBalancesSwitchValue(!zeroBalancesSwitchValue)}
      />
    </VStack>
  );
};

const showExtraFilters = (props: Props) => {
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay}>
      <ExtraFilters {...props} />
    </BottomSheetSettings>
  ));
};
export default showExtraFilters;
